import { NextResponse } from 'next/server';

// This API route's only job is to communicate with the Python service.
// It does not interact with Firebase.

async function processWithTranscriptionService(audioFile: File, voiceprints: Record<string, number[]>) {
    const serviceUrl = process.env.TRANSCRIPTION_SERVICE_URL || "http://localhost:5002/process-audio";
    if (!serviceUrl) {
        throw new Error("TRANSCRIPTION_SERVICE_URL is not configured in .env.local");
    }

    const formData = new FormData();
    formData.append('audioFile', audioFile);
    formData.append('enrolled_voiceprints_json', JSON.stringify(voiceprints));

    console.log("Sending audio and voiceprints to Python transcription service...");
    const response = await fetch(serviceUrl, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Error from transcription service:", errorBody);
        throw new Error(`Transcription service failed with status ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ Successfully received processed data from transcription service.");
    return result;
}

export async function POST(request: Request) {
  console.log("--- ✅ /api/transcribe-meeting endpoint reached! ---");
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audioFile') as File;
    const voiceprintsJson = formData.get('voiceprints') as string;

    // This check is now looking for 'voiceprints' instead of 'teamId'
    if (!audioFile || !voiceprintsJson) {
      return NextResponse.json({ message: 'audioFile and voiceprints are required.' }, { status: 400 });
    }

    const enrolledVoiceprints = JSON.parse(voiceprintsJson);

    // 1. Call the Python service to get the transcript
    const processedData = await processWithTranscriptionService(audioFile, enrolledVoiceprints);
    
    // 2. Return the processed data directly to the client
    return NextResponse.json(processedData);

  } catch (error) {
    console.log("Error in /api/transcribe-meeting:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json({ message: 'An internal server error occurred.', error: errorMessage }, { status: 500 });
  }
}

