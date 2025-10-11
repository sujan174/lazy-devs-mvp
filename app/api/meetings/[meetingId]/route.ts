// ==============================================
// app/api/meetings/[meetingId]/route.ts
// ==============================================

import { NextResponse } from 'next/server';
import { fetchMeetingById, updateMeetingSpeakers, deleteMeeting } from '@/lib/firebase-admin';

// GET - Fetch a single meeting
export async function GET(
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

    const meeting = await fetchMeetingById(meetingId);

    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ meeting });
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

    await updateMeetingSpeakers(meetingId, speakerResolutions);

    return NextResponse.json({ 
      success: true,
      message: 'Speakers updated successfully' 
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