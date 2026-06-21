import { calculateFootprint, CalculatorInput } from '../lib/calculator';

const testCases: { name: string; input: CalculatorInput; expectedTotalMin: number; expectedTotalMax: number }[] = [
  {
    name: 'Vegan, walking/cycling, no grid electricity, solar, high recycling',
    input: {
      transport: { mode: 'walk_cycle', weeklyKm: 100, flightsPerYear: 0 },
      energy: { monthlyKwh: 0, cookingFuel: 'electric', hasSolar: true },
      diet: 'vegan',
      waste: 'high_recycling',
    },
    // Diet: 2.9 * 365 = 1058.5 kg. Electricity = 0. LPG = 0. PNG = 0.
    // Base: 1058.5. Offset: 12% = 127.02. Total: ~931.
    expectedTotalMin: 925,
    expectedTotalMax: 935,
  },
  {
    name: 'Standard Indian Vegetarian household (car petrol, modest electricity, LPG, some recycling)',
    input: {
      transport: { mode: 'car_petrol', weeklyKm: 50, flightsPerYear: 2 },
      energy: { monthlyKwh: 150, cookingFuel: 'lpg', hasSolar: false },
      diet: 'vegetarian',
      waste: 'some_recycling',
    },
    // Transport: (50 * 0.19 * 52) = 494 kg. flights: 2 * 1000 * 0.25 = 500 kg. Total transport = 994 kg.
    // Energy: electricity (150 * 0.82 * 12) = 1476 kg. LPG (10 * 3 * 12) = 360 kg. Total energy = 1836 kg.
    // Diet: 3.8 * 365 = 1387 kg.
    // Base total = 994 + 1836 + 1387 = 4217 kg.
    // Offset: some_recycling (5%) = 210.85 kg.
    // Net total = 4217 - 210.85 = 4006.15 kg (~4006 kg).
    expectedTotalMin: 3995,
    expectedTotalMax: 4015,
  },
  {
    name: 'High meat, diesel car (120 km/wk, 6 flights), high electricity, commercial 15kg LPG, low recycling',
    input: {
      transport: { mode: 'car_diesel', weeklyKm: 120, flightsPerYear: 6 },
      energy: { monthlyKwh: 300, cookingFuel: 'lpg', hasSolar: false, lpgCylinderKg: 15 },
      diet: 'high_meat',
      waste: 'low_recycling',
    },
    // Transport: (120 * 0.17 * 52) = 1060.8 kg. flights: 6 * 1000 * 0.25 = 1500 kg. Total = 2560.8 kg.
    // Energy: electricity (300 * 0.82 * 12) = 2952 kg. LPG (15 * 3.0 * 12) = 540 kg. Total = 3492 kg.
    // Diet: 7.2 * 365 = 2628 kg.
    // Base total = 2560.8 + 3492 + 2628 = 8680.8 kg.
    // Offset: low_recycling (0%) = 0 kg.
    // Net total = 8680.8 kg (~8681 kg).
    expectedTotalMin: 8670,
    expectedTotalMax: 8690,
  },
  {
    name: 'Electric car user (200 km/wk), modest electricity, PNG cooking, solar active, some recycling',
    input: {
      transport: { mode: 'car_electric', weeklyKm: 200, flightsPerYear: 0 },
      energy: { monthlyKwh: 250, cookingFuel: 'png', hasSolar: true },
      diet: 'vegetarian',
      waste: 'some_recycling',
    },
    // Transport: (200 * 0.05 * 52) = 520 kg.
    // Energy: electricity (250 * 0.82 * 12 * 0.3) = 738 kg. PNG (12 * 2.02 * 12) = 290.88 kg. Total = 1028.88 kg.
    // Diet: 3.8 * 365 = 1387 kg.
    // Base total = 520 + 1028.88 + 1387 = 2935.88 kg.
    // Offset: some_recycling (5%) = 146.79 kg.
    // Net total = 2935.88 - 146.79 = 2789.09 kg (~2789 kg).
    expectedTotalMin: 2780,
    expectedTotalMax: 2795,
  },
];

let failed = false;

for (const tc of testCases) {
  console.log(`Running test case: ${tc.name}`);
  const result = calculateFootprint(tc.input);
  console.log(`  Result: ${result.totalAnnualCo2Kg} kg CO2e`);
  console.log(`  Breakdown:`, result.breakdown);
  console.log(`  Comparison:`, result.comparison);

  if (result.totalAnnualCo2Kg >= tc.expectedTotalMin && result.totalAnnualCo2Kg <= tc.expectedTotalMax) {
    console.log(`  ✅ PASSED`);
  } else {
    console.error(`  ❌ FAILED. Expected total between ${tc.expectedTotalMin} and ${tc.expectedTotalMax}, got ${result.totalAnnualCo2Kg}`);
    failed = true;
  }
  console.log('-------------------------------------------');
}

if (failed) {
  process.exit(1);
} else {
  console.log('All calculator tests passed successfully!');
  process.exit(0);
}
