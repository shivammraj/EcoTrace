import { NextResponse } from 'next/server';
import { calculateFootprint, DEFAULT_FACTORS } from '@/lib/calculator';
import { calculatorInputSchema } from '@/lib/validation';
import db from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = calculatorInputSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid calculator inputs', details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = result.data;

    // Load emission factors from DB (with fallback to default constants if DB is not seeded/running)
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
      console.warn('Could not load emission factors from database, falling back to local defaults:', dbError);
    }

    const calculatorResult = calculateFootprint(input, factors);

    return NextResponse.json(calculatorResult);
  } catch (error) {
    console.error('Carbon calculation API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during footprint calculation.' },
      { status: 500 }
    );
  }
}
