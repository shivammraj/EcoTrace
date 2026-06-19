import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyAccessToken(token);

    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized: Token expired or invalid' }, { status: 401 });
    }

    // Fetch fresh user profile from DB
    try {
      const user = await db.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          points: true,
          createdAt: true,
        },
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      return NextResponse.json({ user });
    } catch (dbError) {
      // Fallback to JWT payload details if DB is temporarily unreachable
      console.error('Database connection error in /api/auth/me, returning fallback payload:', dbError);
      return NextResponse.json({
        user: {
          id: payload.userId,
          email: payload.email,
          name: payload.name,
          avatarUrl: null,
          points: 0,
          isOfflineFallback: true,
        },
      });
    }
  } catch (error) {
    console.error('Me endpoint error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred retrieving user profile.' },
      { status: 500 }
    );
  }
}
