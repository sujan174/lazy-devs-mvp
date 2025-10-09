import { NextResponse } from 'next/server';

/**
 * Calls the external Python microservice to generate a voiceprint embedding.
 * @param audioFile The audio file blob to be processed.
 * @param name The name of the user to associate with the voiceprint.
 * @returns A promise that resolves to a voiceprint embedding (a float array).
 */
async function generateVoiceprint(audioFile: File, name: string): Promise<number[]> {
  const pythonServiceUrl = process.env.NEXT_PUBLIC_VOICEPRINT_SERVICE_URL;
  if (!pythonServiceUrl) {
    throw new Error("VOICEPRINT_SERVICE_URL is not configured in .env.local");
  }

  console.log(`Sending audio to Python voiceprint service for user: ${name}`);
  
  const formData = new FormData();
  formData.append('audioFile', audioFile);
  formData.append('name', name);

  const response = await fetch(pythonServiceUrl, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Error from voiceprint service:", errorBody);
    throw new Error(`Voiceprint generation failed with status ${response.status}`);
  }

  const result = await response.json();
  console.log("Voiceprint generation successful.");
  return result.embedding;
}


export async function POST(request: Request) {
  console.log("--- ✅ /api/register-user endpoint was successfully reached! ---");

  try {
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const audioFile = formData.get('audioFile') as File;

    if (!name || !audioFile) {
      return NextResponse.json({ message: 'Name and audio file are required.' }, { status: 400 });
    }

    // 1. Generate the voiceprint.
    const voiceprint = await generateVoiceprint(audioFile, name);

    // 2. Return the generated voiceprint to the client.
    return NextResponse.json({ voiceprint });

  } catch (error) {
    console.error("Error in /api/register-user:", error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}

