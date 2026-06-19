import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';
import { generateRandomToken, hashToken, signAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!code) {
      return NextResponse.redirect(`${appUrl}/?error=google_oauth_failed`);
    }

    let email = '';
    let name = '';
    let oauthId = '';
    let avatarUrl = '';

    if (code === 'sandbox_google_oauth_bypass_code') {
      // Sandbox bypass
      email = 'google.sandbox.user@ecotrace.org';
      name = 'Green Citizen (Sandbox)';
      oauthId = 'sandbox-google-oauth-id-123456';
      avatarUrl = '';
    } else {
      // Exchange code for Google tokens
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = `${appUrl}/api/auth/google/callback`;

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId!,
          client_secret: clientSecret!,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const errData = await tokenResponse.json();
        console.error('Failed to exchange authorization code:', errData);
        return NextResponse.redirect(`${appUrl}/?error=google_token_exchange_failed`);
      }

      const tokens = await tokenResponse.json();

      // Retrieve user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userInfoResponse.ok) {
        console.error('Failed to fetch Google user info');
        return NextResponse.redirect(`${appUrl}/?error=google_user_info_failed`);
      }

      const googleUser = await userInfoResponse.json();
      email = googleUser.email;
      name = googleUser.name || googleUser.given_name || 'Google User';
      oauthId = googleUser.id;
      avatarUrl = googleUser.picture || '';
    }

    // Process user in DB
    let user;
    try {
      user = await db.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (user) {
        // User exists, link Google OAuth if not already linked
        user = await db.user.update({
          where: { id: user.id },
          data: {
            oauthProvider: 'google',
            oauthId,
            avatarUrl: user.avatarUrl || avatarUrl,
          },
        });
      } else {
        // Create new OAuth user
        user = await db.user.create({
          data: {
            email: email.toLowerCase(),
            name,
            oauthProvider: 'google',
            oauthId,
            avatarUrl,
          },
        });
      }
    } catch (dbError) {
      console.error('Database connection error in OAuth callback:', dbError);
      return NextResponse.redirect(`${appUrl}/?error=database_connection_failed`);
    }

    // Generate credentials
    const accessToken = await signAccessToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const rawRefreshToken = generateRandomToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Store refresh token
    await db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Set refresh token cookie
    const cookieStore = await cookies();
    cookieStore.set('refresh_token', rawRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });

    // Redirect to dashboard, forwarding the access token in query
    return NextResponse.redirect(`${appUrl}/dashboard?token=${encodeURIComponent(accessToken)}`);
  } catch (error) {
    console.error('Google OAuth callback handler error:', error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${appUrl}/?error=unexpected_oauth_error`);
  }
}
