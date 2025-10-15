// ==============================================
// app/api/meetings/route.ts
// ==============================================

import { NextResponse } from 'next/server';
import { saveMeetingToDB, fetchTeamMeetings } from '@/lib/firebase-admin';

// POST - Save a new meeting
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      teamId, 
      meetingTitle, 
      transcript, 
      speakerMap, 
      unresolvedSpeakers,
      uploadedBy 
    } = body;

    // Validation
    if (!teamId || !meetingTitle || !transcript) {
      return NextResponse.json(
        { error: 'Missing required fields: teamId, meetingTitle, transcript' },
        { status: 400 }
      );
    }

    if (!Array.isArray(transcript) || transcript.length === 0) {
      return NextResponse.json(
        { error: 'Transcript must be a non-empty array' },
        { status: 400 }
      );
    }

    console.log(`📝 API: Saving meeting "${meetingTitle}" for team ${teamId}`);
    
    const meetingId = await saveMeetingToDB({
      teamId,
      meetingTitle,
      transcript,
      speakerMap: speakerMap || {},
      unresolvedSpeakers: unresolvedSpeakers || [],
      uploadedBy,
    });

    return NextResponse.json({ 
      success: true,
      meetingId,
      message: 'Meeting saved successfully' 
    });
  } catch (error) {
    console.error('Error in meetings POST API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to save meeting', details: errorMessage },
      { status: 500 }
    );
  }
}

// GET - Fetch meetings for a team
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json(
        { error: 'teamId query parameter is required' },
        { status: 400 }
      );
    }

    console.log(`📋 API: Fetching meetings for team ${teamId}`);
    const meetings = await fetchTeamMeetings(teamId);

    return NextResponse.json({ 
      meetings,
      count: meetings.length 
    });
  } catch (error) {
    console.error('Error in meetings GET API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch meetings', details: errorMessage },
      { status: 500 }
    );
  }
}