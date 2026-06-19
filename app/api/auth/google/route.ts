import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  // Sandbox bypass if credentials are placeholder
  if (!clientId || clientId === 'placeholder-google-client-id' || !clientSecret || clientSecret === 'placeholder-google-client-secret') {
    console.log('Google OAuth client ID or secret is missing. Redirecting to sandbox callback...');
    return NextResponse.redirect(`${redirectUri}?code=sandbox_google_oauth_bypass_code`);
  }

  const googleOAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=email%20profile&access_type=offline&prompt=select_account`;

  return NextResponse.redirect(googleOAuthUrl);
}
