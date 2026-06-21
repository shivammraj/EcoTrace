import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { DEFAULT_FACTORS } from '@/lib/calculator';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dbFactors = await db.emissionFactor.findMany();
    if (dbFactors.length > 0) {
      const factors = dbFactors.reduce((acc, current) => {
        acc[current.subcategory] = Number(current.factor);
        return acc;
      }, {} as Record<string, number>);
      return NextResponse.json(factors);
    }
    return NextResponse.json(DEFAULT_FACTORS);
  } catch (error) {
    console.error('Fetch factors error:', error);
    return NextResponse.json(DEFAULT_FACTORS);
  }
}
