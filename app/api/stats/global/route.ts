import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // ── Real DB aggregates ──────────────────────────────────────────────────
    const [
      totalUsers,
      totalEntries,
      co2Aggregate,
    ] = await Promise.all([
      db.user.count(),
      db.emissionEntry.count(),
      db.emissionEntry.aggregate({ _sum: { co2Kg: true } }),
    ]);

    // Total tracked CO₂ across all users (kg)
    const totalTrackedKg = Math.round(Number(co2Aggregate._sum.co2Kg ?? 0));

    // Average footprint per entry (kg CO₂e)
    const avgFootprintKg = totalEntries > 0
      ? Math.round(totalTrackedKg / totalEntries)
      : 0;

    // Entries saved today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const entriesToday = await db.emissionEntry.count({
      where: { createdAt: { gte: todayStart } },
    });

    // New users this week
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const usersThisWeek = await db.user.count({
      where: { createdAt: { gte: weekAgo } },
    });

    return NextResponse.json({
      // Legacy fields kept for backward compatibility
      totalCalculations: totalEntries,
      totalSavedKg: totalTrackedKg,
      averageReductionPercent: 18, // static benchmark

      // Rich real data
      totalUsers,
      totalEntries,
      totalTrackedKg,
      avgFootprintKg,
      entriesToday,
      usersThisWeek,
    });
  } catch (error) {
    console.error('Fetch global stats error:', error);
    // Graceful fallback — never crash the home page
    return NextResponse.json({
      totalCalculations: 0,
      totalSavedKg: 0,
      averageReductionPercent: 0,
      totalUsers: 0,
      totalEntries: 0,
      totalTrackedKg: 0,
      avgFootprintKg: 0,
      entriesToday: 0,
      usersThisWeek: 0,
    });
  }
}
