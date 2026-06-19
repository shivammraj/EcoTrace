import * as jose from 'jose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production-123456'
);

// Hash password using bcryptjs with cost factor >= 10
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Compare password with hash
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate random secure token (for refresh tokens)
export function generateRandomToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

// Hash refresh token using SHA-256
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Sign Access Token (JWT, 15m expiration)
export async function signAccessToken(payload: { userId: string; email: string; name: string }): Promise<string> {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(JWT_SECRET);
}

// Verify Access Token (returns payload if valid, null otherwise)
export async function verifyAccessToken(token: string): Promise<{ userId: string; email: string; name: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    return payload as { userId: string; email: string; name: string };
  } catch {
    return null;
  }
}
