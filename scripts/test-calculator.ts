import { calculateFootprint, CalculatorInput } from '../lib/calculator';
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

async function runTests() {
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

  await runAuthTests();
  await runValidationTests();

  if (failed) {
    console.error('❌ SOME TESTS FAILED.');
    process.exit(1);
  } else {
    console.log('✅ ALL TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  }
}

async function runAuthTests() {
  console.log('\n===========================================');
  console.log('Running Authentication Helper Tests');
  console.log('===========================================');

  try {
    const password = 'test-secure-password-123';
    const hash = await hashPassword(password);
    if (hash === password) {
      throw new Error('hashPassword returned raw password instead of hash');
    }
    
    const isCorrect = await comparePassword(password, hash);
    if (!isCorrect) {
      throw new Error('comparePassword failed to verify correct password hash');
    }
    
    const isIncorrect = await comparePassword('wrong-password', hash);
    if (isIncorrect) {
      throw new Error('comparePassword verified incorrect password');
    }
    console.log('✅ Password hashing & comparison tests passed');

    const token = generateRandomToken();
    if (typeof token !== 'string' || token.length !== 80) {
      throw new Error(`generateRandomToken returned invalid token: ${token}`);
    }
    console.log('✅ Random token generation tests passed');

    const tokenHash = hashToken('my-token');
    const expectedHash = 'fece50d2287f7245aea5819b75f95ee8bec295a14f8ef1e7a31f17f1dae9df44';
    if (tokenHash !== expectedHash) {
      throw new Error(`hashToken returned incorrect SHA-256 hash: ${tokenHash}`);
    }
    console.log('✅ Token hashing tests passed');

    const payload = { userId: 'user-123', email: 'user@example.com', name: 'John Doe' };
    const jwt = await signAccessToken(payload);
    if (typeof jwt !== 'string') {
      throw new Error('signAccessToken did not return a string');
    }
    
    const verifiedPayload = await verifyAccessToken(jwt);
    if (!verifiedPayload || verifiedPayload.userId !== payload.userId || verifiedPayload.email !== payload.email) {
      throw new Error('verifyAccessToken failed to verify valid JWT or payload mismatch');
    }

    const invalidVerify = await verifyAccessToken(jwt + 'modified');
    if (invalidVerify !== null) {
      throw new Error('verifyAccessToken successfully verified a corrupted token');
    }
    console.log('✅ JWT access token signing & verification tests passed');
  } catch (error: any) {
    console.error('❌ Auth tests failed:', error.message || error);
    failed = true;
  }
}

async function runValidationTests() {
  console.log('\n===========================================');
  console.log('Running Validation Schema Tests');
  console.log('===========================================');

  try {
    const validRegister = registerSchema.safeParse({
      email: 'valid@example.com',
      password: 'mypassword123',
      name: 'Jane Doe',
    });
    if (!validRegister.success) {
      throw new Error(`registerSchema failed on valid input: ${JSON.stringify(validRegister.error.format())}`);
    }

    const invalidRegisterEmail = registerSchema.safeParse({
      email: 'invalid-email',
      password: 'mypassword123',
      name: 'Jane Doe',
    });
    if (invalidRegisterEmail.success) {
      throw new Error('registerSchema accepted invalid email address');
    }

    const invalidRegisterPassword = registerSchema.safeParse({
      email: 'valid@example.com',
      password: 'short',
      name: 'Jane Doe',
    });
    if (invalidRegisterPassword.success) {
      throw new Error('registerSchema accepted password shorter than 8 characters');
    }

    const invalidRegisterName = registerSchema.safeParse({
      email: 'valid@example.com',
      password: 'mypassword123',
      name: '',
    });
    if (invalidRegisterName.success) {
      throw new Error('registerSchema accepted empty name');
    }
    console.log('✅ Register validation schema tests passed');

    const validLogin = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
    });
    if (!validLogin.success) {
      throw new Error('loginSchema failed on valid login inputs');
    }

    const invalidLoginEmail = loginSchema.safeParse({
      email: 'invalid-email',
      password: 'password123',
    });
    if (invalidLoginEmail.success) {
      throw new Error('loginSchema accepted invalid email');
    }
    console.log('✅ Login validation schema tests passed');

    const validCalc = calculatorInputSchema.safeParse({
      transport: { mode: 'car_petrol', weeklyKm: 120, flightsPerYear: 2 },
      energy: { monthlyKwh: 200, cookingFuel: 'lpg', hasSolar: false },
      diet: 'vegetarian',
      waste: 'some_recycling',
    });
    if (!validCalc.success) {
      throw new Error(`calculatorInputSchema failed on valid input: ${JSON.stringify(validCalc.error.format())}`);
    }

    const defaultCalc = calculatorInputSchema.safeParse({
      transport: { mode: 'walk_cycle' },
      energy: { cookingFuel: 'electric' },
      diet: 'vegan',
      waste: 'high_recycling',
    });
    if (!defaultCalc.success) {
      throw new Error('calculatorInputSchema failed with default values omitted');
    }
    const data = defaultCalc.data;
    if (data.transport.weeklyKm !== 0 || data.transport.flightsPerYear !== 0 || data.energy.monthlyKwh !== 0 || data.energy.hasSolar !== false) {
      throw new Error('calculatorInputSchema did not apply correct default values');
    }

    const invalidCalcTransport = calculatorInputSchema.safeParse({
      transport: { mode: 'invalid_mode' },
      energy: { cookingFuel: 'electric' },
      diet: 'vegan',
      waste: 'high_recycling',
    });
    if (invalidCalcTransport.success) {
      throw new Error('calculatorInputSchema accepted invalid transport mode');
    }
    console.log('✅ Calculator validation schema tests passed');
  } catch (error: any) {
    console.error('❌ Validation tests failed:', error.message || error);
    failed = true;
  }
}

runTests();
