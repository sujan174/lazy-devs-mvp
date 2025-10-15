import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { decrypt } from '@/lib/encryption';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    // Await params (Next.js 15 requirement)
    const { meetingId } = await params;
    
    if (!meetingId) {
      return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 });
    }

    console.log(`[API] Starting action generation for meeting: ${meetingId}`);

    // 1. Fetch the meeting document to get transcript and teamId
    const meetingRef = adminDb.collection('meetings').doc(meetingId);
    const meetingDoc = await meetingRef.get();
    
    if (!meetingDoc.exists) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }
    
    const meetingData = meetingDoc.data();
    const teamId = meetingData?.teamId;
    const transcriptArray = meetingData?.transcript || [];
    
    console.log('[API] Meeting data:', {
      hasTeamId: !!teamId,
      teamId: teamId,
      transcriptLength: transcriptArray.length,
      hasTranscript: transcriptArray.length > 0
    });
    
    if (!teamId) {
      console.error('[API] Missing teamId in meeting document');
      return NextResponse.json({ error: 'Meeting is missing teamId.' }, { status: 400 });
    }
    
    if (transcriptArray.length === 0) {
      console.error('[API] Meeting has no transcript');
      return NextResponse.json({ error: 'Meeting has no transcript data.' }, { status: 400 });
    }

    // 2. Fetch the team document to get the encrypted ClickUp token
    const teamDoc = await adminDb.collection('teams').doc(teamId).get();
    
    if (!teamDoc.exists) {
      console.error('[API] Team not found:', teamId);
      return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
    }
    
    const teamData = teamDoc.data();
    const encryptedToken = teamData?.integrations?.clickup?.accessToken;
    
    // Use space ID from Firestore, fallback to environment variable
    let clickupSpaceId = teamData?.integrations?.clickup?.spaceId;
    
    if (!clickupSpaceId) {
      clickupSpaceId = process.env.CLICKUP_SPACE_ID;
      console.log('[API] Using ClickUp Space ID from environment variable');
    } else {
      console.log('[API] Using ClickUp Space ID from team configuration');
    }

    console.log('[API] ClickUp configuration:', {
      hasToken: !!encryptedToken,
      hasSpaceId: !!clickupSpaceId,
      spaceIdSource: teamData?.integrations?.clickup?.spaceId ? 'firestore' : 'env'
    });

    if (!encryptedToken) {
      console.error('[API] ❌ Missing ClickUp access token');
      return NextResponse.json({ 
        error: 'ClickUp access token is not configured. Please connect ClickUp in team settings.'
      }, { status: 400 });
    }
    
    if (!clickupSpaceId) {
      console.error('[API] ❌ Missing ClickUp space ID in both Firestore and environment');
      return NextResponse.json({ 
        error: 'ClickUp space ID is not configured. Please add CLICKUP_SPACE_ID to your environment variables.'
      }, { status: 400 });
    }
    
    console.log('[API] ✅ ClickUp configuration validated successfully');
    
    // 3. Decrypt the token
    const clickupToken = decrypt(encryptedToken);

    // 4. Prepare the data and call the Python "Agent Hive" microservice
    console.log(`[API] Calling Actions microservice for space: ${clickupSpaceId}`);

    const agentServiceUrl = process.env.ACTIONS_SERVICE_URL;
    
    if (!agentServiceUrl) {
      throw new Error("ACTIONS_SERVICE_URL is not configured.");
    }
    
    const fullTranscriptText = transcriptArray
      .map((t: any) => `${t.speaker}: ${t.text}`)
      .join('\n');

    const agentResponse = await fetch(agentServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clickupToken}`
      },
      body: JSON.stringify({
        space_id: clickupSpaceId,
        transcript: fullTranscriptText,
      }),
    });

    if (!agentResponse.ok) {
      const errorBody = await agentResponse.text();
      console.error(`[API] Agent Hive service failed: ${errorBody}`);
      throw new Error(`Agent Hive service failed: ${errorBody}`);
    }
    
    const agentData = await agentResponse.json();
    console.log('[API] Raw agent response:', JSON.stringify(agentData).substring(0, 500));
    
    // Extract actions from the response
    let actions = agentData?.actions || agentData?.ai_response || agentData;
    
    // If the response is a string (Gemini's raw output), parse it
    if (typeof actions === 'string') {
      console.log('[API] Response is a string, parsing...');
      
      // Remove markdown code blocks if present
      let cleanedResponse = actions.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/i, '').replace(/```\s*$/i, '');
      }
      
      try {
        actions = JSON.parse(cleanedResponse);
        console.log('[API] Successfully parsed JSON from string');
      } catch (parseError) {
        console.error('[API] Failed to parse JSON:', parseError);
        console.error('[API] Cleaned response:', cleanedResponse.substring(0, 500));
        throw new Error('Failed to parse AI response as JSON');
      }
    }
    
    // Ensure actions is an array
    if (!Array.isArray(actions)) {
      console.log('[API] Actions is not an array, wrapping it');
      actions = [actions];
    }
    
    console.log(`[API] Parsed ${actions.length} actions from response`);

    // 5. Update the meeting document in Firestore with the generated actions
    await meetingRef.update({
      actions: actions,
      status: 'completed',
      updatedAt: new Date(),
    });

    console.log(`[API] ✅ Successfully generated and saved ${actions.length} actions for meeting ${meetingId}`);

    return NextResponse.json({ success: true, actions });

  } catch (error) {
    console.error('[API] Error generating actions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      error: 'Failed to generate actions', 
      details: errorMessage 
    }, { status: 500 });
  }
}