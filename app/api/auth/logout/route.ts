import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';
import { hashToken } from '@/lib/auth';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const rawRefreshToken = cookieStore.get('refresh_token')?.value;

    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      // Delete token from database (ignore errors if it's already gone or DB is down)
      try {
        await db.refreshToken.deleteMany({
          where: { tokenHash },
        });
      } catch (dbError) {
        console.warn('Database error during token invalidation on logout:', dbError);
      }
    }

    // Clear the cookie
    cookieStore.set('refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return NextResponse.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during logout.' },
      { status: 500 }
    );
  }
}
