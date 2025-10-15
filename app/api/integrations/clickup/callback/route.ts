import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { encrypt } from '@/lib/encryption';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  
  // --- FIX: Get the teamId from the 'state' parameter ---
  // ClickUp will return the same 'state' value that we sent in the connect URL.
  const teamId = searchParams.get('state');

  if (!code) {
    console.error("ClickUp callback error: Authorization code not found.");
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/settings?integration=error&reason=no_code`);
  }
  if (!teamId) {
    console.error("ClickUp callback error: State parameter (teamId) not found.");
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/settings?integration=error&reason=no_state`);
  }

  try {
    // 1. Exchange the authorization code for an access token
    const clientId = process.env.CLICKUP_CLIENT_ID;
    const clientSecret = process.env.CLICKUP_CLIENT_SECRET;
    
    const response = await fetch('https://api.clickup.com/api/v2/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      console.error("ClickUp token exchange failed:", errorBody);
      throw new Error('Failed to exchange code for access token.');
    }

    const { access_token } = await response.json();
    
    // 2. Encrypt the token and save it to the correct team's document using the teamId from state
    const encryptedToken = encrypt(access_token);
    const teamDocRef = adminDb.collection('teams').doc(teamId);
    
    // Using set with merge is a safe way to create/update nested fields
    await teamDocRef.set({
      integrations: {
        clickup: {
          accessToken: encryptedToken,
          connectedAt: new Date(),
        }
      }
    }, { merge: true });

    console.log(`✅ Successfully connected ClickUp for team: ${teamId}`);

    // 3. Redirect user back to the settings page with a success message
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/settings?integration=success`);

  } catch (error) {
    console.error("ClickUp callback error:", error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/settings?integration=error`);
  }
}

