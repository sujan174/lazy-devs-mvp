import { NextResponse } from 'next/server';

// This API route's only job is to communicate with the Python service.
// It does not interact with Firebase.

interface ProcessedData {
  transcript: Array<{
    speaker: string;
    text: string;
    start_ms: number;
    end_ms: number;
  }>;
  speaker_map: Record<string, string>;
  unresolved_speakers: Array<{
    label: string;
    audio_snippet_b64: string;
  }>;
}

async function processWithTranscriptionService(
  audioFile: File, 
  voiceprints: Record<string, number[]>
): Promise<ProcessedData> {
  const serviceUrl = process.env.TRANSCRIPTION_SERVICE_URL || "http://localhost:5002/process-audio";
  
  if (!serviceUrl) {
    throw new Error("TRANSCRIPTION_SERVICE_URL is not configured in .env.local");
  }

  const formData = new FormData();
  // IMPORTANT: Match the field names that Python FastAPI expects
  formData.append('audio_file', audioFile);  // Changed from 'audioFile' to 'audio_file'
  formData.append('enrolled_voiceprints_json', JSON.stringify(voiceprints));

  console.log("📤 Sending audio and voiceprints to Python transcription service...");
  console.log(`   Service URL: ${serviceUrl}`);
  console.log(`   Audio file: ${audioFile.name} (${audioFile.size} bytes)`);
  console.log(`   Enrolled speakers: ${Object.keys(voiceprints).length}`);

  try {
    const response = await fetch(serviceUrl, {
      method: 'POST',
      body: formData,
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(300000), // 5 minutes timeout
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("❌ Error from transcription service:", errorBody);
      throw new Error(`Transcription service failed with status ${response.status}: ${errorBody}`);
    }

    const result = await response.json();
    console.log("✅ Successfully received processed data from transcription service.");
    console.log(`   Transcript segments: ${result.transcript?.length || 0}`);
    console.log(`   Unresolved speakers: ${result.unresolved_speakers?.length || 0}`);
    
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Transcription service request timed out after 5 minutes');
    }
    throw error;
  }
}

export async function POST(request: Request) {
  console.log("--- ✅ /api/transcribe-meeting endpoint reached! ---");
  
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audioFile') as File;
    const voiceprintsJson = formData.get('voiceprints') as string;

    // Validate required fields
    if (!audioFile) {
      console.error("❌ Missing audioFile in request");
      return NextResponse.json(
        { message: 'audioFile is required.' }, 
        { status: 400 }
      );
    }

    if (!voiceprintsJson) {
      console.error("❌ Missing voiceprints in request");
      return NextResponse.json(
        { message: 'voiceprints are required.' }, 
        { status: 400 }
      );
    }

    // Validate audio file
    if (audioFile.size === 0) {
      console.error("❌ Audio file is empty");
      return NextResponse.json(
        { message: 'Audio file is empty.' }, 
        { status: 400 }
      );
    }

    // Parse and validate voiceprints
    let enrolledVoiceprints: Record<string, number[]>;
    try {
      enrolledVoiceprints = JSON.parse(voiceprintsJson);
      
      if (typeof enrolledVoiceprints !== 'object' || enrolledVoiceprints === null) {
        throw new Error('Voiceprints must be an object');
      }

      if (Object.keys(enrolledVoiceprints).length === 0) {
        console.warn("⚠️ No enrolled voiceprints provided - all speakers will be unresolved");
      }
    } catch (parseError) {
      console.error("❌ Failed to parse voiceprints JSON:", parseError);
      return NextResponse.json(
        { message: 'Invalid voiceprints JSON format.' }, 
        { status: 400 }
      );
    }

    // 1. Call the Python service to get the transcript
    const processedData = await processWithTranscriptionService(audioFile, enrolledVoiceprints);
    
    // 2. Return the processed data directly to the client
    return NextResponse.json(processedData);

  } catch (error) {
    console.error("❌ Error in /api/transcribe-meeting:", error);
    
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    
    // Provide more specific error status codes
    let statusCode = 500;
    if (errorMessage.includes('timed out')) {
      statusCode = 504; // Gateway Timeout
    } else if (errorMessage.includes('not configured')) {
      statusCode = 503; // Service Unavailable
    } else if (errorMessage.includes('failed with status')) {
      statusCode = 502; // Bad Gateway
    }
    
    return NextResponse.json(
      { 
        message: 'An internal server error occurred.', 
        error: errorMessage 
      }, 
      { status: statusCode }
    );
  }
}

// Optional: Add a health check endpoint
export async function GET() {
  const serviceUrl = process.env.TRANSCRIPTION_SERVICE_URL || "http://localhost:8000/health";
  
  try {
    const response = await fetch(serviceUrl.replace('/process-audio', '/health'), {
      signal: AbortSignal.timeout(5000), // 5 second timeout for health check
    });
    
    if (response.ok) {
      const health = await response.json();
      return NextResponse.json({ 
        status: 'healthy',
        transcriptionService: health 
      });
    }
    
    return NextResponse.json(
      { status: 'unhealthy', error: 'Transcription service not responding' },
      { status: 503 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: 'Cannot reach transcription service' },
      { status: 503 }
    );
  }
}