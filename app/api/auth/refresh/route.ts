import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';
import { generateRandomToken, hashToken, signAccessToken } from '@/lib/auth';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const rawRefreshToken = cookieStore.get('refresh_token')?.value;

    if (!rawRefreshToken) {
      return NextResponse.json({ error: 'Refresh token missing' }, { status: 401 });
    }

    const tokenHash = hashToken(rawRefreshToken);

    // Look up token in database
    let storedToken;
    try {
      storedToken = await db.refreshToken.findFirst({
        where: { tokenHash },
        include: { user: true },
      });
    } catch (dbError) {
      console.error('Database connection error in refresh:', dbError);
      return NextResponse.json(
        { error: 'Database connection failed. Please ensure PostgreSQL is running.' },
        { status: 500 }
      );
    }

    if (!storedToken) {
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    }

    // Check expiration
    if (new Date() > storedToken.expiresAt) {
      // Clean up expired token
      await db.refreshToken.delete({ where: { id: storedToken.id } });
      return NextResponse.json({ error: 'Refresh token expired' }, { status: 401 });
    }

    const user = storedToken.user;

    // Rotate refresh token (delete old, create new)
    await db.refreshToken.delete({ where: { id: storedToken.id } });

    const newRawRefreshToken = generateRandomToken();
    const newHash = hashToken(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newHash,
        expiresAt,
      },
    });

    // Sign new access token
    const accessToken = await signAccessToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    // Set new cookie
    cookieStore.set('refresh_token', newRawRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });

    return NextResponse.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        points: user.points,
      },
    });
  } catch (error) {
    console.error('Refresh token rotation error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during token refresh.' },
      { status: 500 }
    );
  }
}
