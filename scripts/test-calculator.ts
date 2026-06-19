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
