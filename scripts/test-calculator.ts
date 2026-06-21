/**
 * EcoTrace Comprehensive Test Suite
 * Covers: Carbon calculator, authentication helpers, Zod validation schemas,
 *         edge cases, boundary values, and API input/output contracts.
 *
 * Run with: npm test   (or: npx tsx scripts/test-calculator.ts)
 */

import {
  calculateFootprint,
  getTransportEmissions,
  getEnergyEmissions,
  getDietEmissions,
  getWasteAdjustment,
  CalculatorInput,
  DEFAULT_FACTORS,
  NATIONAL_AVG_KG,
  GLOBAL_AVG_KG,
} from '../lib/calculator';
import {
  hashPassword,
  comparePassword,
  generateRandomToken,
  hashToken,
  signAccessToken,
  verifyAccessToken,
} from '../lib/auth';
import {
  registerSchema,
  loginSchema,
  calculatorInputSchema,
} from '../lib/validation';

// --- Test runner helpers ---

let failed = false;
let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string): void {
  totalTests++;
  if (condition) {
    console.log('  ok  ' + message);
    passedTests++;
  } else {
    console.error('  FAIL  ' + message);
    failed = true;
  }
}

function assertRange(value: number, min: number, max: number, message: string): void {
  assert(value >= min && value <= max, message + ' (got ' + value + ', expected ' + min + '-' + max + ')');
}

function assertEqual(actual: any, expected: any, message: string): void {
  assert(actual === expected, message + ' (got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected) + ')');
}

function section(title: string): void {
  console.log('\n' + '='.repeat(60));
  console.log('  ' + title);
  console.log('='.repeat(60));
}

// --- 1. End-to-End Calculator Tests ---

section('1. CARBON CALCULATOR - END-TO-END TESTS');

const e2eTestCases: {
  name: string;
  input: CalculatorInput;
  expectedMin: number;
  expectedMax: number;
}[] = [
  {
    name: 'Vegan, walk/cycle, no electricity, solar, high recycling',
    input: {
      transport: { mode: 'walk_cycle', weeklyKm: 100, flightsPerYear: 0 },
      energy: { monthlyKwh: 0, cookingFuel: 'electric', hasSolar: true },
      diet: 'vegan',
      waste: 'high_recycling',
    },
    expectedMin: 925,
    expectedMax: 935,
  },
  {
    name: 'Standard Indian vegetarian household (car petrol, LPG, some recycling)',
    input: {
      transport: { mode: 'car_petrol', weeklyKm: 50, flightsPerYear: 2 },
      energy: { monthlyKwh: 150, cookingFuel: 'lpg', hasSolar: false },
      diet: 'vegetarian',
      waste: 'some_recycling',
    },
    expectedMin: 3995,
    expectedMax: 4015,
  },
  {
    name: 'High meat, diesel car 120km/wk + 6 flights, 15kg LPG, low recycling',
    input: {
      transport: { mode: 'car_diesel', weeklyKm: 120, flightsPerYear: 6 },
      energy: { monthlyKwh: 300, cookingFuel: 'lpg', hasSolar: false, lpgCylinderKg: 15 },
      diet: 'high_meat',
      waste: 'low_recycling',
    },
    expectedMin: 8670,
    expectedMax: 8690,
  },
  {
    name: 'Electric car 200km/wk, PNG cooking, solar active, some recycling',
    input: {
      transport: { mode: 'car_electric', weeklyKm: 200, flightsPerYear: 0 },
      energy: { monthlyKwh: 250, cookingFuel: 'png', hasSolar: true },
      diet: 'vegetarian',
      waste: 'some_recycling',
    },
    expectedMin: 2780,
    expectedMax: 2795,
  },
  {
    name: 'Motorbike 150km/wk + 1 flight, LPG, moderate meat, some recycling',
    input: {
      transport: { mode: 'motorbike', weeklyKm: 150, flightsPerYear: 1 },
      energy: { monthlyKwh: 100, cookingFuel: 'lpg', hasSolar: false },
      diet: 'moderate_meat',
      waste: 'some_recycling',
    },
    expectedMin: 4040,
    expectedMax: 4060,
  },
  {
    name: 'Bus 200km/wk, electric cooking, vegetarian, low recycling',
    input: {
      transport: { mode: 'bus', weeklyKm: 200, flightsPerYear: 0 },
      energy: { monthlyKwh: 200, cookingFuel: 'electric', hasSolar: false },
      diet: 'vegetarian',
      waste: 'low_recycling',
    },
    expectedMin: 4385,
    expectedMax: 4405,
  },
];

for (const tc of e2eTestCases) {
  console.log('\n  ' + tc.name);
  const result = calculateFootprint(tc.input);
  assertRange(result.totalAnnualCo2Kg, tc.expectedMin, tc.expectedMax, 'Total CO2e in expected range');
  assert(result.breakdown.transport >= 0, 'Transport >= 0');
  assert(result.breakdown.energy >= 0, 'Energy >= 0');
  assert(result.breakdown.diet >= 0, 'Diet >= 0');
  assert(result.breakdown.waste <= 0, 'Waste offset <= 0');
  assertEqual(result.comparison.nationalAvgKg, NATIONAL_AVG_KG, 'National avg constant correct');
  assertEqual(result.comparison.globalAvgKg, GLOBAL_AVG_KG, 'Global avg constant correct');
}

// --- 2. Unit Tests for helper functions ---

section('2. UNIT TESTS - HELPER FUNCTIONS');

console.log('\n  getTransportEmissions');
{
  const walkerResult = getTransportEmissions({ mode: 'walk_cycle', weeklyKm: 100 });
  assertEqual(walkerResult.annualCo2Kg, 0, 'Walk/cycle emits zero regardless of distance');

  const carResult = getTransportEmissions({ mode: 'car_petrol', weeklyKm: 100, flightsPerYear: 0 });
  assertRange(carResult.annualCo2Kg, 985, 995, 'Car petrol 100km/wk annual');

  const flightResult = getTransportEmissions({ mode: 'walk_cycle', weeklyKm: 0, flightsPerYear: 4 });
  assertEqual(flightResult.annualCo2Kg, 4 * 1000 * 0.25, '4 flights x 1000km x 0.25');

  const customFactors = { ...DEFAULT_FACTORS, car_petrol: 0.25 };
  const customResult = getTransportEmissions({ mode: 'car_petrol', weeklyKm: 100, flightsPerYear: 0 }, customFactors);
  assertRange(customResult.annualCo2Kg, 1295, 1305, 'Custom factor override works');
}

console.log('\n  getEnergyEmissions');
{
  const noElecResult = getEnergyEmissions({ monthlyKwh: 0, cookingFuel: 'electric', hasSolar: false });
  assertEqual(noElecResult.annualCo2Kg, 0, 'Zero electricity + electric cooking = 0');

  const solarResult = getEnergyEmissions({ monthlyKwh: 100, cookingFuel: 'electric', hasSolar: true });
  const noSolarResult = getEnergyEmissions({ monthlyKwh: 100, cookingFuel: 'electric', hasSolar: false });
  assert(solarResult.annualCo2Kg < noSolarResult.annualCo2Kg, 'Solar reduces electricity emissions');
  assertRange(solarResult.annualCo2Kg / noSolarResult.annualCo2Kg, 0.29, 0.31, 'Solar reduces by ~70%');

  const lpgResult = getEnergyEmissions({ monthlyKwh: 0, cookingFuel: 'lpg', hasSolar: false });
  assertEqual(lpgResult.annualCo2Kg, 10 * 3.0 * 12, 'Default LPG: 10kg x 3.0 x 12 months');

  const customLpg = getEnergyEmissions({ monthlyKwh: 0, cookingFuel: 'lpg', hasSolar: false, lpgCylinderKg: 14.2 });
  assertEqual(customLpg.annualCo2Kg, 14.2 * 3.0 * 12, 'Custom LPG cylinder weight overrides default');

  const pngResult = getEnergyEmissions({ monthlyKwh: 0, cookingFuel: 'png', hasSolar: false });
  assertEqual(pngResult.annualCo2Kg, 12 * 2.02 * 12, 'PNG: 12 m3/month x 2.02 x 12 months');
}

console.log('\n  getDietEmissions');
{
  assertEqual(getDietEmissions('vegan'), 2.9 * 365, 'Vegan factor x 365');
  assertEqual(getDietEmissions('high_meat'), 7.2 * 365, 'High meat factor x 365');
  assert(
    getDietEmissions('high_meat') > getDietEmissions('moderate_meat') &&
    getDietEmissions('moderate_meat') > getDietEmissions('vegetarian') &&
    getDietEmissions('vegetarian') > getDietEmissions('vegan'),
    'Diet emissions correctly ordered: high_meat > moderate_meat > vegetarian > vegan'
  );
}

console.log('\n  getWasteAdjustment');
{
  const base = 4000;
  assertEqual(getWasteAdjustment('low_recycling', base), 0, 'Low recycling = 0 offset');
  assertEqual(getWasteAdjustment('some_recycling', base), base * 0.05, 'Some recycling = 5% offset');
  assertEqual(getWasteAdjustment('high_recycling', base), base * 0.12, 'High recycling = 12% offset');
  assertEqual(getWasteAdjustment('low_recycling', 0), 0, 'Zero base = zero adjustment');
}

console.log('\n  calculateFootprint - structural integrity');
{
  const input: CalculatorInput = {
    transport: { mode: 'car_petrol', weeklyKm: 80, flightsPerYear: 1 },
    energy: { monthlyKwh: 150, cookingFuel: 'lpg', hasSolar: false },
    diet: 'moderate_meat',
    waste: 'some_recycling',
  };
  const result = calculateFootprint(input);

  assert(result.totalAnnualCo2Kg >= 0, 'Total is never negative');
  assert(Number.isInteger(result.totalAnnualCo2Kg), 'Total is rounded to integer');
  assert(Number.isInteger(result.breakdown.transport), 'Transport is integer');
  assert(Number.isInteger(result.breakdown.energy), 'Energy is integer');
  assert(Number.isInteger(result.breakdown.diet), 'Diet is integer');
  assert(Number.isInteger(result.breakdown.waste), 'Waste is integer');
  assert(typeof result.comparison.percentVsNational === 'number', 'percentVsNational is a number');
  assert('totalAnnualCo2Kg' in result, 'Result has totalAnnualCo2Kg');
  assert('breakdown' in result, 'Result has breakdown');
  assert('comparison' in result, 'Result has comparison');
}

// --- 3. Authentication Helper Tests ---

async function runAuthTests(): Promise<void> {
  section('3. AUTHENTICATION HELPER TESTS');

  console.log('\n  Password hashing & comparison');
  const password = 'test-secure-password-123';
  const hash = await hashPassword(password);
  assert(hash !== password, 'hashPassword does not return raw password');
  assert(hash.startsWith('$2'), 'hashPassword returns valid bcrypt hash');

  const isCorrect = await comparePassword(password, hash);
  assert(isCorrect, 'comparePassword returns true for correct password');

  const isIncorrect = await comparePassword('wrong-password', hash);
  assert(!isIncorrect, 'comparePassword returns false for wrong password');

  const isCaseSensitive = await comparePassword(password.toUpperCase(), hash);
  assert(!isCaseSensitive, 'Password comparison is case-sensitive');

  console.log('\n  Random token generation');
  const token = generateRandomToken();
  assert(typeof token === 'string', 'generateRandomToken returns a string');
  assertEqual(token.length, 80, 'Token is 80 hex characters (40 bytes)');
  assert(/^[0-9a-f]+$/i.test(token), 'Token contains only hex characters');
  const token2 = generateRandomToken();
  assert(token !== token2, 'Two consecutive tokens are not identical');

  console.log('\n  SHA-256 token hashing');
  const tokenHash = hashToken('my-token');
  const expectedHash = 'fece50d2287f7245aea5819b75f95ee8bec295a14f8ef1e7a31f17f1dae9df44';
  assertEqual(tokenHash, expectedHash, 'hashToken produces correct SHA-256 digest');
  const tokenHashDeterministic = hashToken('my-token');
  assertEqual(tokenHash, tokenHashDeterministic, 'hashToken is deterministic for same input');
  const differentHash = hashToken('other-token');
  assert(tokenHash !== differentHash, 'Different inputs produce different hashes');

  console.log('\n  JWT access token signing & verification');
  const payload = { userId: 'user-123', email: 'user@example.com', name: 'John Doe' };
  const jwt = await signAccessToken(payload);
  assert(typeof jwt === 'string', 'signAccessToken returns a string');
  assert(jwt.split('.').length === 3, 'JWT has three dot-separated segments');

  const verifiedPayload = await verifyAccessToken(jwt);
  assert(verifiedPayload !== null, 'verifyAccessToken returns non-null for valid JWT');
  assertEqual(verifiedPayload!.userId, payload.userId, 'JWT preserves userId');
  assertEqual(verifiedPayload!.email, payload.email, 'JWT preserves email');
  assertEqual(verifiedPayload!.name, payload.name, 'JWT preserves name');

  const tampered = await verifyAccessToken(jwt + 'tampered');
  assert(tampered === null, 'Tampered JWT is rejected');

  const empty = await verifyAccessToken('');
  assert(empty === null, 'Empty string JWT is rejected');

  const malformed = await verifyAccessToken('not.a.jwt');
  assert(malformed === null, 'Malformed JWT string is rejected');
}

// --- 4. Zod Validation Schema Tests ---

async function runValidationTests(): Promise<void> {
  section('4. ZOD VALIDATION SCHEMA TESTS');

  console.log('\n  registerSchema - valid inputs');
  {
    const valid = registerSchema.safeParse({ email: 'valid@example.com', password: 'mypassword123', name: 'Jane Doe' });
    assert(valid.success, 'Valid register input accepted');
    const longName = registerSchema.safeParse({ email: 'test@test.com', password: 'password12', name: 'A B C D E F G H' });
    assert(longName.success, 'Long name within limit accepted');
  }

  console.log('\n  registerSchema - invalid inputs');
  {
    assert(!registerSchema.safeParse({ email: 'invalid-email', password: 'pass1234', name: 'Jane' }).success, 'Invalid email rejected');
    assert(!registerSchema.safeParse({ email: 'a@b.com', password: 'short', name: 'Jane' }).success, 'Short password rejected');
    assert(!registerSchema.safeParse({ email: 'a@b.com', password: 'password123', name: '' }).success, 'Empty name rejected');
    assert(!registerSchema.safeParse({ password: 'password123', name: 'Jane' }).success, 'Missing email rejected');
    assert(!registerSchema.safeParse({ email: 'a@b.com', name: 'Jane' }).success, 'Missing password rejected');
    assert(!registerSchema.safeParse({ email: 'a'.repeat(250) + '@b.com', password: 'password123', name: 'Jane' }).success, 'Email exceeding 255 chars rejected');
  }

  console.log('\n  loginSchema');
  {
    assert(loginSchema.safeParse({ email: 'user@example.com', password: 'password123' }).success, 'Valid login accepted');
    assert(!loginSchema.safeParse({ email: 'not-an-email', password: 'pass' }).success, 'Invalid login email rejected');
    assert(!loginSchema.safeParse({ email: 'user@x.com', password: '' }).success, 'Empty login password rejected');
    assert(!loginSchema.safeParse({}).success, 'Missing both fields rejected');
  }

  console.log('\n  calculatorInputSchema - valid inputs');
  {
    const valid = calculatorInputSchema.safeParse({
      transport: { mode: 'car_petrol', weeklyKm: 120, flightsPerYear: 2 },
      energy: { monthlyKwh: 200, cookingFuel: 'lpg', hasSolar: false },
      diet: 'vegetarian',
      waste: 'some_recycling',
    });
    assert(valid.success, 'Fully specified valid input accepted');

    const defaults = calculatorInputSchema.safeParse({
      transport: { mode: 'walk_cycle' },
      energy: { cookingFuel: 'electric' },
      diet: 'vegan',
      waste: 'high_recycling',
    });
    assert(defaults.success, 'Input with optional fields omitted accepted');
    if (defaults.success) {
      assertEqual(defaults.data.transport.weeklyKm, 0, 'Default weeklyKm is 0');
      assertEqual(defaults.data.transport.flightsPerYear, 0, 'Default flightsPerYear is 0');
      assertEqual(defaults.data.energy.monthlyKwh, 0, 'Default monthlyKwh is 0');
      assertEqual(defaults.data.energy.hasSolar, false, 'Default hasSolar is false');
    }

    const modes: CalculatorInput['transport']['mode'][] = [
      'car_petrol', 'car_diesel', 'car_electric', 'motorbike', 'bus', 'train', 'flight', 'walk_cycle',
    ];
    for (const mode of modes) {
      const r = calculatorInputSchema.safeParse({ transport: { mode }, energy: { cookingFuel: 'electric' }, diet: 'vegan', waste: 'low_recycling' });
      assert(r.success, 'Transport mode ' + mode + ' accepted');
    }
    for (const fuel of ['lpg', 'png', 'electric'] as const) {
      const r = calculatorInputSchema.safeParse({ transport: { mode: 'walk_cycle' }, energy: { cookingFuel: fuel }, diet: 'vegan', waste: 'low_recycling' });
      assert(r.success, 'Cooking fuel ' + fuel + ' accepted');
    }
  }

  console.log('\n  calculatorInputSchema - invalid inputs');
  {
    assert(!calculatorInputSchema.safeParse({ transport: { mode: 'helicopter' }, energy: { cookingFuel: 'electric' }, diet: 'vegan', waste: 'high_recycling' }).success, 'Invalid transport mode rejected');
    assert(!calculatorInputSchema.safeParse({ transport: { mode: 'walk_cycle' }, energy: { cookingFuel: 'electric' }, diet: 'carnivore', waste: 'high_recycling' }).success, 'Invalid diet rejected');
    assert(!calculatorInputSchema.safeParse({ transport: { mode: 'walk_cycle' }, energy: { cookingFuel: 'electric' }, diet: 'vegan', waste: 'maximum_recycling' }).success, 'Invalid waste rejected');
    assert(!calculatorInputSchema.safeParse({ transport: { mode: 'car_petrol', weeklyKm: -100 }, energy: { cookingFuel: 'electric' }, diet: 'vegan', waste: 'low_recycling' }).success, 'Negative weeklyKm rejected');
    assert(!calculatorInputSchema.safeParse({ transport: { mode: 'walk_cycle' }, energy: { monthlyKwh: -50, cookingFuel: 'electric' }, diet: 'vegan', waste: 'low_recycling' }).success, 'Negative monthlyKwh rejected');
    assert(!calculatorInputSchema.safeParse({}).success, 'Empty object rejected');
  }
}

// --- 5. Edge Cases ---

function runEdgeCaseTests(): void {
  section('5. EDGE CASES AND BOUNDARY TESTS');

  console.log('\n  Boundary: minimum footprint');
  {
    const minResult = calculateFootprint({
      transport: { mode: 'walk_cycle', weeklyKm: 0, flightsPerYear: 0 },
      energy: { monthlyKwh: 0, cookingFuel: 'electric', hasSolar: true },
      diet: 'vegan',
      waste: 'high_recycling',
    });
    assert(minResult.totalAnnualCo2Kg >= 0, 'Minimum footprint is never negative');
  }

  console.log('\n  Boundary: maximum footprint');
  {
    const maxResult = calculateFootprint({
      transport: { mode: 'flight', weeklyKm: 500, flightsPerYear: 12 },
      energy: { monthlyKwh: 800, cookingFuel: 'lpg', hasSolar: false, lpgCylinderKg: 15 },
      diet: 'high_meat',
      waste: 'low_recycling',
    });
    assert(maxResult.totalAnnualCo2Kg > GLOBAL_AVG_KG, 'Maximum footprint exceeds global average');
  }

  console.log('\n  Comparison metrics');
  {
    const belowResult = calculateFootprint({
      transport: { mode: 'walk_cycle', weeklyKm: 0, flightsPerYear: 0 },
      energy: { monthlyKwh: 0, cookingFuel: 'electric', hasSolar: false },
      diet: 'vegan',
      waste: 'high_recycling',
    });
    assert(belowResult.comparison.percentVsNational < 0, 'Below-average footprint shows negative % vs national');

    const aboveResult = calculateFootprint({
      transport: { mode: 'car_petrol', weeklyKm: 200, flightsPerYear: 6 },
      energy: { monthlyKwh: 400, cookingFuel: 'lpg', hasSolar: false },
      diet: 'high_meat',
      waste: 'low_recycling',
    });
    assert(aboveResult.comparison.percentVsNational > 0, 'Above-average footprint shows positive % vs national');
  }

  console.log('\n  Custom emission factors override');
  {
    const input: CalculatorInput = {
      transport: { mode: 'car_petrol', weeklyKm: 100, flightsPerYear: 0 },
      energy: { monthlyKwh: 100, cookingFuel: 'electric', hasSolar: false },
      diet: 'vegetarian',
      waste: 'low_recycling',
    };
    const defaultResult = calculateFootprint(input);
    const customResult = calculateFootprint(input, { ...DEFAULT_FACTORS, car_petrol: 0.40 });
    assert(customResult.breakdown.transport > defaultResult.breakdown.transport, 'Higher custom transport factor = higher transport emissions');
  }
}

// --- Main runner ---

async function runAll(): Promise<void> {
  console.log('\n  EcoTrace - Comprehensive Test Suite');
  console.log('  Carbon footprint tracker for India\n');

  runEdgeCaseTests();
  await runAuthTests();
  await runValidationTests();

  section('RESULTS: ' + passedTests + '/' + totalTests + ' tests passed');
  if (failed) {
    console.error('\n  SOME TESTS FAILED. Please review the output above.\n');
    process.exit(1);
  } else {
    console.log('\n  ALL ' + totalTests + ' TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  }
}

runAll();
