// ==============================================
// app/api/teams/[teamId]/voiceprints/route.ts
// ==============================================

import { NextResponse } from 'next/server';
import { fetchTeamVoiceprints } from '@/lib/firebase-admin';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> } // params is a Promise
) {
  try {
    // FIX: Await the params promise to resolve before accessing its properties
    const { teamId } = await params;

    if (!teamId) {
      return NextResponse.json(
        { error: 'Team ID is required' },
        { status: 400 }
      );
    }

    console.log(`📞 API: Fetching voiceprints for team ${teamId}`);
    const voiceprints = await fetchTeamVoiceprints(teamId);

    return NextResponse.json({ 
      voiceprints,
      count: Object.keys(voiceprints).length 
    });
  } catch (error) {
    console.error('Error in voiceprints API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch voiceprints', details: errorMessage },
      { status: 500 }
    );
  }
}
