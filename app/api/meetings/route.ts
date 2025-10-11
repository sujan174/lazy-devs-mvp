import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { teamId, meetingTitle, transcript, speakerMap, unresolvedSpeakers } = body;
    
    // Save to Firebase/your database
    const meetingId = await saveMeetingToDB({
      teamId,
      meetingTitle,
      transcript,
      speakerMap,
      unresolvedSpeakers,
      createdAt: new Date().toISOString()
    });
    
    return NextResponse.json({ meetingId });
  } catch (error) {
    console.error('Error saving meeting:', error);
    return NextResponse.json(
      { error: 'Failed to save meeting' },
      { status: 500 }
    );
  }
}