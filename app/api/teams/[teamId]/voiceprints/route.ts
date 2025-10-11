import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    // Fetch voiceprints from your database (Firebase, etc.)
    // This is just a placeholder structure
    const voiceprints = await fetchVoiceprintsFromDB(params.teamId);
    
    return NextResponse.json({ voiceprints });
  } catch (error) {
    console.error('Error fetching voiceprints:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voiceprints' },
      { status: 500 }
    );
  }
}