import { NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { calculateFootprint, DEFAULT_FACTORS } from '@/lib/calculator';
import { calculatorInputSchema } from '@/lib/validation';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getAuthUser(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  return await verifyAccessToken(token);
}

// POST: Save a footprint calculation as database entries
export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = calculatorInputSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = result.data;

    // Load emission factors from DB
    let factors = DEFAULT_FACTORS;
    try {
      const dbFactors = await db.emissionFactor.findMany();
      if (dbFactors.length > 0) {
        factors = dbFactors.reduce((acc, current) => {
          acc[current.subcategory] = Number(current.factor);
          return acc;
        }, {} as Record<string, number>);
      }
    } catch (dbError) {
      console.warn('DB error reading factors in save entry:', dbError);
    }

    // Run the calculation
    const calcResult = calculateFootprint(input, factors);

    // Prepare date string (YYYY-MM-DD) for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Save as individual entries — each call creates a NEW set of entries with a unique timestamp
    const entryDate = new Date(); // full timestamp so each save is a unique date entry
    await db.$transaction([
      db.emissionEntry.create({
        data: {
          userId: user.userId,
          category: 'transport',
          subcategory: input.transport.mode,
          inputValue: input.transport.weeklyKm ?? 0,
          co2Kg: calcResult.breakdown.transport,
          entryDate,
        },
      }),
      db.emissionEntry.create({
        data: {
          userId: user.userId,
          category: 'energy',
          subcategory: `electricity_grid_in+cooking_${input.energy.cookingFuel}`,
          inputValue: input.energy.monthlyKwh,
          co2Kg: calcResult.breakdown.energy,
          entryDate,
        },
      }),
      db.emissionEntry.create({
        data: {
          userId: user.userId,
          category: 'diet',
          subcategory: `diet_${input.diet}`,
          inputValue: 1,
          co2Kg: calcResult.breakdown.diet,
          entryDate,
        },
      }),
      db.emissionEntry.create({
        data: {
          userId: user.userId,
          category: 'waste',
          subcategory: input.waste,
          inputValue: 1,
          co2Kg: calcResult.breakdown.waste,
          entryDate,
        },
      }),
    ]);

    return NextResponse.json({
      message: 'Calculation saved successfully',
      result: calcResult,
    });
  } catch (error) {
    console.error('Save carbon entry error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while saving entry.' },
      { status: 500 }
    );
  }
}

// GET: Fetch paginated historical entries
export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    // Fetch entries grouped by date
    // Prisma doesn't natively support distinct pagination over Date columns easily, so we can fetch user entries ordered by date,
    // and group them on the application side.
    const allEntries = await db.emissionEntry.findMany({
      where: { userId: user.userId },
      orderBy: { entryDate: 'desc' },
    });

    // Group entries by date
    const groupedMap = new Map<string, any[]>();
    for (const entry of allEntries) {
      const dateStr = entry.entryDate.toISOString().split('T')[0];
      if (!groupedMap.has(dateStr)) {
        groupedMap.set(dateStr, []);
      }
      groupedMap.get(dateStr)!.push(entry);
    }

    const groupedArray = Array.from(groupedMap.entries()).map(([date, items]) => {
      const breakdown = {
        transport: 0,
        energy: 0,
        diet: 0,
        waste: 0,
      };
      let total = 0;

      for (const item of items) {
        const cat = item.category as 'transport' | 'energy' | 'diet' | 'waste';
        const co2 = Number(item.co2Kg);
        breakdown[cat] = co2;
        total += co2;
      }

      return {
        date,
        totalAnnualCo2Kg: total,
        breakdown,
        items: items.map(i => ({
          category: i.category,
          subcategory: i.subcategory,
          inputValue: Number(i.inputValue),
          co2Kg: Number(i.co2Kg),
        })),
      };
    });

    // Paginate grouped dates
    const paginatedHistory = groupedArray.slice(skip, skip + limit);

    return NextResponse.json({
      history: paginatedHistory,
      totalCount: groupedArray.length,
      page,
      limit,
    });
  } catch (error) {
    console.error('Fetch entries error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while fetching entries.' },
      { status: 500 }
    );
  }
}

// DELETE: Remove all entries for a specific date (YYYY-MM-DD)
export async function DELETE(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date'); // e.g. '2026-06-19'
    if (!dateStr) {
      return NextResponse.json({ error: 'Missing date parameter' }, { status: 400 });
    }

    // Match all entries whose entryDate starts with this date prefix
    const dayStart = new Date(dateStr);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateStr);
    dayEnd.setHours(23, 59, 59, 999);

    const { count } = await db.emissionEntry.deleteMany({
      where: {
        userId: user.userId,
        entryDate: { gte: dayStart, lte: dayEnd },
      },
    });

    return NextResponse.json({ message: `Deleted ${count} entries for ${dateStr}` });
  } catch (error) {
    console.error('Delete entries error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while deleting entries.' },
      { status: 500 }
    );
  }
}
