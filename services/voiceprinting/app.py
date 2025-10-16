import os
import torch
import torchaudio
import tempfile
import json
import warnings
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from speechbrain.pretrained import EncoderClassifier
import soundfile as sf
from pydub import AudioSegment

# Suppress user warnings for a cleaner output
warnings.filterwarnings("ignore", category=UserWarning)

# --- AI Model Initialization ---
CLASSIFIER = None
DEVICE = "cpu"
try:
    print("🧠 Initializing SpeechBrain model...")
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    CLASSIFIER = EncoderClassifier.from_hparams(
        source="speechbrain/spkrec-ecapa-voxceleb",
        savedir="pretrained_models/spkrec-ecapa-voxceleb",
        run_opts={"device": DEVICE}
    )
    print(f"✅ SpeechBrain model loaded successfully on '{DEVICE}'.")
except Exception as e:
    print(f"🔥 FATAL: Could not load SpeechBrain model: {e}")
    # The application will still run but the endpoint will fail gracefully.

# --- FastAPI Application Setup ---
app = FastAPI(title="Voiceprint Generation Service")

def create_voiceprint(audio_file_path: str):
    """
    Processes a 16kHz mono WAV file and returns a voiceprint embedding.
    """
    if not CLASSIFIER:
        raise RuntimeError("SpeechBrain model is not available.")

    try:
        # Load the audio file
        signal, fs = torchaudio.load(audio_file_path)

        # Ensure it's mono and resampled to 16kHz
        if fs != 16000:
            resampler = torchaudio.transforms.Resample(orig_freq=fs, new_freq=16000)
            signal = resampler(signal)
        if signal.shape[0] > 1:
            signal = torch.mean(signal, dim=0, keepdim=True)
            
        # Generate the embedding
        with torch.no_grad():
            embedding = CLASSIFIER.encode_batch(signal)
            embedding = torch.nn.functional.normalize(embedding, p=2, dim=2)
            return embedding.squeeze().cpu().tolist()
    except Exception as e:
        print(f"Could not process file {audio_file_path}: {e}")
        return None

@app.post('/generate-voiceprint')
async def handle_generate_voiceprint(
    audioFile: UploadFile = File(...), 
    name: str = Form(...)
):
    """
    Accepts an audio file and a name, saves the voiceprint to a local JSON file,
    and returns the embedding.
    """
    if not CLASSIFIER:
        raise HTTPException(status_code=503, detail="Voiceprint model is not loaded.")

    temp_original_path = None
    temp_wav_path = None
    try:
        # Save the uploaded file to a temporary location
        suffix = Path(audioFile.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_original:
            content = await audioFile.read()
            temp_original.write(content)
            temp_original_path = temp_original.name

        # Convert the audio to a standardized 16kHz mono WAV format
        audio_segment = AudioSegment.from_file(temp_original_path)
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_wav:
            audio_segment.set_frame_rate(16000).set_channels(1).export(temp_wav.name, format="wav")
            temp_wav_path = temp_wav.name
        
        # Create the voiceprint from the standardized file
        embedding = create_voiceprint(temp_wav_path)
        
        if embedding:
            # Save the voiceprint to a local "database" (a folder of JSON files)
            db_dir = "voiceprints_db"
            os.makedirs(db_dir, exist_ok=True)
            safe_filename = "".join(c for c in name if c.isalnum() or c in (' ', '_')).rstrip()
            output_path = os.path.join(db_dir, f"{safe_filename}.json")
            
            with open(output_path, 'w') as f:
                json.dump(embedding, f)
            
            print(f"✅ Voiceprint for '{name}' saved to '{output_path}'")
            return {"embedding": embedding}
        else:
            raise HTTPException(status_code=500, detail="Failed to generate voiceprint after audio conversion.")
            
    except Exception as e:
        print(f"An error occurred during audio processing: {e}")
        raise HTTPException(status_code=500, detail="An internal server error occurred.")
    finally:
        # Clean up the temporary files
        if temp_original_path and os.path.exists(temp_original_path):
            os.remove(temp_original_path)
        if temp_wav_path and os.path.exists(temp_wav_path):
            os.remove(temp_wav_path)

@app.get("/health")
async def health_check():
    """Health check endpoint to confirm the service is running."""
    return {
        "status": "healthy",
        "model_loaded": CLASSIFIER is not None,
        "device": DEVICE
    }

