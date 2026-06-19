import { NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { NATIONAL_AVG_KG, GLOBAL_AVG_KG } from '@/lib/calculator';
import db from '@/lib/db';

async function getAuthUser(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  return await verifyAccessToken(token);
}

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all entries for user ordered by date desc
    const allEntries = await db.emissionEntry.findMany({
      where: { userId: user.userId },
      orderBy: { entryDate: 'desc' },
    });

    if (allEntries.length === 0) {
      return NextResponse.json({
        latestCalculation: null,
        historyTrend: [],
        comparison: {
          nationalAvgKg: NATIONAL_AVG_KG,
          globalAvgKg: GLOBAL_AVG_KG,
          percentVsNational: 0,
        },
      });
    }

    // Group by date to find the latest session and compute trends
    const groupedMap = new Map<string, any[]>();
    for (const entry of allEntries) {
      const dateStr = entry.entryDate.toISOString().split('T')[0];
      if (!groupedMap.has(dateStr)) {
        groupedMap.set(dateStr, []);
      }
      groupedMap.get(dateStr)!.push(entry);
    }

    const groupedArray = Array.from(groupedMap.entries()).map(([date, rawItems]) => {
      const breakdown = {
        transport: 0,
        energy: 0,
        diet: 0,
        waste: 0,
      };
      let total = 0;

      for (const item of rawItems) {
        const cat = item.category as 'transport' | 'energy' | 'diet' | 'waste';
        const co2 = Number(item.co2Kg);
        breakdown[cat] = co2;
        total += co2;
      }

      return {
        date,
        totalAnnualCo2Kg: total,
        breakdown,
        // Include raw items so the dashboard receipt can read subcategory / inputValue
        items: rawItems.map((item: any) => ({
          category: item.category,
          subcategory: item.subcategory,
          inputValue: Number(item.inputValue),
          co2Kg: Number(item.co2Kg),
        })),
      };
    });

    const latestSession = groupedArray[0]; // because sorted by entryDate desc
    const trend = [...groupedArray].reverse().slice(-7); // chronological, last 7 entries

    const percentVsNational = Math.round(
      ((latestSession.totalAnnualCo2Kg - NATIONAL_AVG_KG) / NATIONAL_AVG_KG) * 100
    );

    return NextResponse.json({
      latestCalculation: latestSession,
      historyTrend: trend.map(t => ({
        date: t.date,
        total: t.totalAnnualCo2Kg,
      })),
      comparison: {
        nationalAvgKg: NATIONAL_AVG_KG,
        globalAvgKg: GLOBAL_AVG_KG,
        percentVsNational,
      },
    });
  } catch (error) {
    console.error('Fetch carbon summary error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while fetching carbon summary.' },
      { status: 500 }
    );
  }
}
