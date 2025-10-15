// ==============================================
// app/api/meetings/[meetingId]/route.ts
// ==============================================

import { NextResponse } from 'next/server';
import { fetchMeetingById, updateMeetingSpeakers, deleteMeeting } from '@/lib/firebase-admin';

// GET - Fetch a single meeting with full transcript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

    if (!meetingId) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      );
    }

    const meeting = await fetchMeetingById(meetingId);

    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    // The meeting object should already contain:
    // - id, title, teamId
    // - transcript (array of utterances)
    // - speakerMap, unresolvedSpeakers
    // - createdAt, updatedAt, durationMs
    // - totalSegments, totalSpeakers, unresolvedCount
    
    console.log(`Fetched meeting ${meetingId}: ${meeting.title}, ${meeting.transcript?.length || 0} segments`);

    return NextResponse.json({ 
      meeting,
      // Optional: Add metadata for easier client-side handling
      meta: {
        hasTranscript: Array.isArray(meeting.transcript) && meeting.transcript.length > 0,
        segmentCount: meeting.transcript?.length || 0,
        speakerCount: meeting.totalSpeakers || 0,
        unresolvedCount: meeting.unresolvedCount || 0
      }
    });
  } catch (error) {
    console.error('Error fetching meeting:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch meeting', details: errorMessage },
      { status: 500 }
    );
  }
}

// PATCH - Update speaker resolutions
export async function PATCH(
  request: Request,
  { params }: { params: { meetingId: string } }
) {
  try {
    const { meetingId } = params;
    const body = await request.json();
    const { speakerResolutions } = body;

    if (!speakerResolutions || typeof speakerResolutions !== 'object') {
      return NextResponse.json(
        { error: 'speakerResolutions object is required' },
        { status: 400 }
      );
    }

    // Validate that speakerResolutions has the correct format
    // Expected: { "Unknown Speaker 1": "John Doe", "Unknown Speaker 2": "Jane Smith" }
    const isValid = Object.entries(speakerResolutions).every(
      ([key, value]) => typeof key === 'string' && typeof value === 'string'
    );

    if (!isValid) {
      return NextResponse.json(
        { error: 'speakerResolutions must be a map of string to string' },
        { status: 400 }
      );
    }

    console.log(`Updating speakers for meeting ${meetingId}:`, speakerResolutions);

    await updateMeetingSpeakers(meetingId, speakerResolutions);

    return NextResponse.json({ 
      success: true,
      message: 'Speakers updated successfully',
      updatedSpeakers: Object.keys(speakerResolutions).length
    });
  } catch (error) {
    console.error('Error updating meeting speakers:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update speakers', details: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE - Delete a meeting
export async function DELETE(
  request: Request,
  { params }: { params: { meetingId: string } }
) {
  try {
    const { meetingId } = params;

    if (!meetingId) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      );
    }

    console.log(`Deleting meeting ${meetingId}`);

    await deleteMeeting(meetingId);

    return NextResponse.json({ 
      success: true,
      message: 'Meeting deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting meeting:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to delete meeting', details: errorMessage },
      { status: 500 }
    );
  }
}