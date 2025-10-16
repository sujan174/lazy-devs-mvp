import os
import torch
import torchaudio
import warnings
from typing import Dict, Any, Tuple, Optional
import tempfile
import json
import base64
import soundfile as sf
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from pydub import AudioSegment
import assemblyai as aai
from speechbrain.pretrained import EncoderClassifier
from scipy.optimize import linear_sum_assignment
import numpy as np
from dotenv import load_dotenv
import logging
from pathlib import Path
import gc
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed

# --- Basic Configuration ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
warnings.filterwarnings("ignore", category=UserWarning)

# --- Constants ---
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB
SUPPORTED_FORMATS = {'.wav', '.mp3', '.m4a', '.flac', '.ogg', '.webm'}
CONFIDENCE_THRESHOLD = 0.50
MIN_AUDIO_LENGTH = 16000  # Samples at 16kHz = 1 second
PROCESSING_TIMEOUT = 600  # 10 minutes

# --- Helper Functions ---
def base64_to_float_tensor(base64_str: str, device: str) -> Optional[torch.Tensor]:
    """Decodes a Base64 string into a PyTorch FloatTensor."""
    try:
        decoded_bytes = base64.b64decode(base64_str)
        float_array = np.frombuffer(decoded_bytes, dtype=np.float32)
        tensor = torch.from_numpy(float_array).to(device)
        if tensor.numel() == 0 or torch.isnan(tensor).any() or torch.isinf(tensor).any():
            logger.warning("Decoded tensor is empty, NaN, or Inf.")
            return None
        return tensor
    except Exception as e:
        logger.warning(f"Could not decode base64 string: {e}")
        return None

def validate_audio_file(file_path: str) -> bool:
    """Validates audio file format and size."""
    path = Path(file_path)
    if not path.exists(): raise ValueError(f"Audio file does not exist: {file_path}")
    if path.suffix.lower() not in SUPPORTED_FORMATS: raise ValueError(f"Unsupported audio format: {path.suffix}")
    if path.stat().st_size == 0: raise ValueError("Audio file is empty")
    if path.stat().st_size > MAX_FILE_SIZE: raise ValueError(f"Audio file exceeds {MAX_FILE_SIZE // (1024*1024)}MB")
    return True

# --- Core Classes ---
class AssemblyAIHandler:
    """Handles interactions with the AssemblyAI API."""
    def __init__(self, api_key: str):
        if not api_key: raise ValueError("AssemblyAI API key is required.")
        aai.settings.api_key = api_key
        self.transcriber = aai.Transcriber()
        logger.info("AssemblyAI handler initialized.")

    def transcribe_and_extract(self, audio_path: str, temp_dir: str) -> Tuple[aai.Transcript, Dict[str, str], Dict[str, str]]:
        """Transcribes audio and extracts speaker clips."""
        logger.info(f"Starting transcription for: {audio_path}")
        validate_audio_file(audio_path)
        
        config = aai.TranscriptionConfig(speaker_labels=True, language_detection=True)
        transcript = self.transcriber.transcribe(audio_path, config)

        if transcript.status == aai.TranscriptStatus.error:
            raise RuntimeError(f"Transcription failed: {transcript.error}")
        if not transcript.utterances:
            raise ValueError("Diarization failed. Audio might be too short or have only one speaker.")

        logger.info(f"Transcription complete. Found {len(transcript.utterances)} utterances.")
        
        original_audio = AudioSegment.from_file(audio_path)
        speaker_segments = {}
        for utterance in transcript.utterances:
            speaker = utterance.speaker
            clip = original_audio[utterance.start:utterance.end]
            speaker_segments.setdefault(speaker, AudioSegment.empty())
            speaker_segments[speaker] += clip

        speaker_paths = {}
        speaker_snippets_b64 = {}
        for speaker, audio in speaker_segments.items():
            speaker_file_path = os.path.join(temp_dir, f"SPEAKER_{speaker}.wav")
            audio.export(speaker_file_path, format="wav")
            speaker_paths[speaker] = speaker_file_path
            
            snippet = audio[:5000]
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as snippet_file:
                snippet.export(snippet_file.name, format="mp3")
                with open(snippet_file.name, "rb") as f:
                    encoded = base64.b64encode(f.read()).decode('utf-8')
                    speaker_snippets_b64[speaker] = f"data:audio/mp3;base64,{encoded}"
            
        return transcript, speaker_paths, speaker_snippets_b64

class SpeechBrainIdentifier:
    """Handles voiceprint creation and speaker identification using PyTorch."""
    def __init__(self):
        # OPTIMIZATION: Prioritize Apple's Metal (MPS) for GPU on Mac, fallback to CUDA/CPU.
        if torch.backends.mps.is_available() and torch.backends.mps.is_built():
            self.device = "mps"
        elif torch.cuda.is_available():
            self.device = "cuda"
        else:
            self.device = "cpu"
        
        logger.info(f"--- PyTorch is using device: {self.device.upper()} ---")
        if self.device == "cpu":
            logger.warning("Running on CPU. Performance will be slower. For Macs, ensure you are not running inside a standard Docker container to leverage GPU.")

        self.classifier = EncoderClassifier.from_hparams(
            source="speechbrain/spkrec-ecapa-voxceleb",
            savedir="pretrained_models/spkrec-ecapa-voxceleb",
            run_opts={"device": self.device}
        )
        logger.info("SpeechBrain model loaded successfully.")

    def _clear_cache(self):
        """Clear cache to prevent memory buildup."""
        if self.device == "cuda": torch.cuda.empty_cache()
        if self.device == "mps": torch.mps.empty_cache()
        gc.collect()

    def _create_voiceprint_from_audio(self, audio_path: str) -> Optional[torch.Tensor]:
        """Creates a voiceprint embedding from an audio file using a robust method."""
        try:
            # NEW: Use pydub for robust audio loading and standardization.
            audio = AudioSegment.from_file(audio_path)
            audio = audio.set_frame_rate(16000).set_channels(1)

            # Convert to a normalized float32 numpy array.
            # Raw data is int16, so we divide by 2**15 to get floats in [-1, 1].
            samples = np.array(audio.get_array_of_samples(), dtype=np.float32) / (2**15)
            
            if samples.size == 0:
                logger.warning(f"Audio file seems to be empty after loading: {audio_path}")
                return None

            signal_tensor = torch.from_numpy(samples).unsqueeze(0).to(self.device)

            if signal_tensor.shape[1] < MIN_AUDIO_LENGTH:
                padding = torch.zeros((1, MIN_AUDIO_LENGTH - signal_tensor.shape[1]), device=self.device)
                signal_tensor = torch.cat([signal_tensor, padding], dim=1)

            with torch.no_grad():
                embedding = self.classifier.encode_batch(signal_tensor)
                normalized = torch.nn.functional.normalize(embedding, p=2, dim=2).squeeze()
                if torch.isnan(normalized).any() or torch.isinf(normalized).any():
                    logger.warning(f"Voiceprint for {audio_path} contains NaN or Inf.")
                    return None
                return normalized.cpu().clone()
        except Exception as e:
            logger.error(f"Could not create voiceprint for {audio_path}: {e}", exc_info=True)
            return None
        finally:
            self._clear_cache()

    def identify_speakers(self, unknown_clips: Dict[str, str], enrolled_voiceprints: Dict[str, torch.Tensor]) -> Dict[str, str]:
        """Finds optimal mapping of unknown speakers to enrolled speakers."""
        if not enrolled_voiceprints:
            return {label: f"Unknown Speaker {i+1}" for i, label in enumerate(sorted(unknown_clips.keys()))}

        # MODIFICATION: Process voiceprint creation sequentially for stability in Docker.
        logger.info(f"Creating voiceprints for {len(unknown_clips)} unknown speakers sequentially...")
        unknown_voiceprints = {}
        
        for i, (label, path) in enumerate(unknown_clips.items()):
            logger.info(f"({i+1}/{len(unknown_clips)}) Processing voiceprint for speaker {label}...")
            vp = self._create_voiceprint_from_audio(path)
            if vp is not None:
                unknown_voiceprints[label] = vp
                logger.info(f"({i+1}/{len(unknown_clips)}) Successfully created voiceprint for {label}.")
            else:
                logger.warning(f"({i+1}/{len(unknown_clips)}) Failed to create voiceprint for {label}.")


        if not unknown_voiceprints:
            logger.warning("No valid unknown speaker voiceprints could be created.")
            return {label: f"Unknown Speaker {i+1}" for i, label in enumerate(sorted(unknown_clips.keys()))}

        enrolled_names, unknown_labels = list(enrolled_voiceprints.keys()), list(unknown_voiceprints.keys())
        similarity_matrix = np.zeros((len(enrolled_names), len(unknown_labels)))
        cosine_similarity = torch.nn.CosineSimilarity(dim=0)

        for i, name in enumerate(enrolled_names):
            for j, label in enumerate(unknown_labels):
                enrolled_vp = enrolled_voiceprints[name].to(self.device)
                unknown_vp = unknown_voiceprints[label].to(self.device)
                similarity_matrix[i, j] = cosine_similarity(enrolled_vp, unknown_vp).item()

        row_ind, col_ind = linear_sum_assignment(1 - similarity_matrix)
        speaker_map = {}
        for r, c in zip(row_ind, col_ind):
            if similarity_matrix[r, c] > CONFIDENCE_THRESHOLD:
                speaker_map[unknown_labels[c]] = enrolled_names[r]
        
        unknown_count = 1
        for label in sorted(unknown_clips.keys()):
            if label not in speaker_map:
                speaker_map[label] = f"Unknown Speaker {unknown_count}"
                unknown_count += 1
        
        logger.info("Speaker identification complete.")
        return speaker_map

# --- Synchronous Pipeline ---
def run_transcription_pipeline(main_audio_path: str, temp_dir: str, enrolled_voiceprints: Dict[str, torch.Tensor], assembly_handler: AssemblyAIHandler, speechbrain_identifier: SpeechBrainIdentifier) -> Dict[str, Any]:
    """Runs the complete transcription and identification pipeline."""
    try:
        transcript, unknown_clips, unknown_snippets = assembly_handler.transcribe_and_extract(main_audio_path, temp_dir)
        speaker_map = speechbrain_identifier.identify_speakers(unknown_clips, enrolled_voiceprints)

        final_transcript = [{"speaker": speaker_map.get(utt.speaker, utt.speaker), "text": utt.text, "start_ms": utt.start, "end_ms": utt.end} for utt in transcript.utterances]
        unresolved_speakers = [{"label": final_name, "audio_snippet_b64": unknown_snippets.get(original_label)} for original_label, final_name in speaker_map.items() if "Unknown Speaker" in final_name]

        return {"transcript": final_transcript, "speaker_map": speaker_map, "unresolved_speakers": unresolved_speakers}
    except Exception as e:
        logger.error(f"Pipeline failed: {e}", exc_info=True)
        raise

# --- FastAPI Application ---
load_dotenv()
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")
if not ASSEMBLYAI_API_KEY: raise RuntimeError("ASSEMBLYAI_API_KEY not found.")

app = FastAPI(title="Optimized Transcription Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Initialize handlers as singletons
assembly_handler = AssemblyAIHandler(api_key=ASSEMBLYAI_API_KEY)
speechbrain_identifier = SpeechBrainIdentifier()

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "device": speechbrain_identifier.device}

@app.post("/process-audio")
async def process_audio_endpoint(audio_file: UploadFile = File(...), enrolled_voiceprints_json: str = Form(...)):
    """Main endpoint for processing audio files."""
    try:
        enrolled_voiceprints_data = json.loads(enrolled_voiceprints_json)
        device = speechbrain_identifier.device
        enrolled_voiceprints = {name: tensor for name, b64 in enrolled_voiceprints_data.items() if (tensor := base64_to_float_tensor(b64, device)) is not None}
        logger.info(f"Loaded {len(enrolled_voiceprints)} valid voiceprints.")

        with tempfile.TemporaryDirectory() as temp_dir:
            main_audio_path = os.path.join(temp_dir, audio_file.filename)
            with open(main_audio_path, "wb") as buffer:
                content = await audio_file.read()
                if not content: raise HTTPException(status_code=400, detail="Uploaded file is empty")
                buffer.write(content)

            result = await asyncio.wait_for(
                run_in_threadpool(
                    run_transcription_pipeline,
                    main_audio_path, temp_dir, enrolled_voiceprints,
                    assembly_handler, speechbrain_identifier
                ),
                timeout=PROCESSING_TIMEOUT
            )
            return result
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail=f"Processing timed out after {PROCESSING_TIMEOUT} seconds.")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format for voiceprints.")
    except Exception as e:
        logger.error(f"An error occurred: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "5002"))
    uvicorn.run(app, host="0.0.0.0", port=port)

