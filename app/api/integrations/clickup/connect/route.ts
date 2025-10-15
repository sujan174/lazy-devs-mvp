import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get('teamId');
  
  if (!teamId) {
    return NextResponse.json({ error: 'A teamId query parameter is required.' }, { status: 400 });
  }

  const clientId = process.env.CLICKUP_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/integrations/clickup/callback`;

  if (!clientId) {
    console.error('ClickUp Client ID is not configured.');
    throw new Error('Integration is not configured on the server.');
  }

  // We securely pass the teamId in the 'state' parameter.
  // ClickUp will return this value to our callback route.
  const clickUpAuthUrl = `https://app.clickup.com/api?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${teamId}`;

  // Redirect the user's browser to the ClickUp authorization page
  return NextResponse.redirect(clickUpAuthUrl);
}

