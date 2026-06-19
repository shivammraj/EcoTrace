export type EmissionCategory = 'transport' | 'energy' | 'diet' | 'waste';

export interface CalculatorInput {
  transport: {
    mode: 'car_petrol' | 'car_diesel' | 'car_electric' | 'motorbike' | 'bus' | 'train' | 'flight' | 'walk_cycle';
    weeklyKm?: number;
    flightsPerYear?: number;
  };
  energy: {
    monthlyKwh: number;
    cookingFuel: 'lpg' | 'png' | 'electric';
    hasSolar?: boolean;
    /** LPG cylinder weight in kg (e.g. 14.2 or 15). Used for accurate cooking emissions. */
    lpgCylinderKg?: number;
  };
  diet: 'high_meat' | 'moderate_meat' | 'vegetarian' | 'vegan';
  waste: 'low_recycling' | 'some_recycling' | 'high_recycling';
}

export interface CalculatorResult {
  totalAnnualCo2Kg: number;
  breakdown: Record<EmissionCategory, number>;
  comparison: {
    nationalAvgKg: number;
    globalAvgKg: number;
    percentVsNational: number;
  };
}

// Default emission factors in case database values are not loaded (e.g., frontend-only or initial state)
export const DEFAULT_FACTORS: Record<string, number> = {
  // Transport (kg CO2e per km)
  car_petrol: 0.1900,      // TODO: verify
  car_diesel: 0.1700,      // TODO: verify
  car_electric: 0.0500,    // TODO: verify
  motorbike: 0.0800,       // TODO: verify
  bus: 0.1000,             // TODO: verify
  train: 0.0400,           // TODO: verify
  flight: 0.2500,          // TODO: verify
  walk_cycle: 0.0000,

  // Energy (grid electricity per kWh, fuels per standard unit)
  electricity_grid_in: 0.8200, // TODO: verify
  cooking_lpg: 3.0000,     // TODO: verify
  cooking_png: 2.0200,     // TODO: verify
  cooking_electric: 0.0000,

  // Diet (kg CO2e per day)
  diet_high_meat: 7.2000,     // TODO: verify
  diet_moderate_meat: 5.6000, // TODO: verify
  diet_vegetarian: 3.8000,    // TODO: verify
  diet_vegan: 2.9000,         // TODO: verify

  // Waste recycling offset multiplier
  low_recycling: 0.0000,
  some_recycling: 0.0500,  // TODO: verify (5% offset)
  high_recycling: 0.1200,  // TODO: verify (12% offset)
};

// Standard Constants for calculations
const AVG_FLIGHT_DISTANCE_KM = 1000; // TODO: verify (assumed average km per domestic flight)
const EST_MONTHLY_LPG_KG = 10;      // TODO: verify (typical average LPG cylinder usage in kg)
const EST_MONTHLY_PNG_M3 = 12;      // TODO: verify (typical PNG consumption in cubic meters)
const SOLAR_REDUCTION_FACTOR = 0.70; // TODO: verify (70% reduction in grid electricity footprint if has solar)

// Benchmarks from Our World In Data
export const NATIONAL_AVG_KG = 1900; // India ~1.9 tonnes CO2e/year
export const GLOBAL_AVG_KG = 4700;   // Global ~4.7 tonnes CO2e/year

export function getTransportEmissions(
  transport: CalculatorInput['transport'],
  factors: Record<string, number> = DEFAULT_FACTORS
): { annualCo2Kg: number; weeklyKm: number; flights: number } {
  const mode = transport.mode;
  const weeklyKm = transport.weeklyKm ?? 0;
  const flightsPerYear = transport.flightsPerYear ?? 0;

  const modeFactor = factors[mode] ?? DEFAULT_FACTORS[mode] ?? 0;
  const flightFactor = factors['flight'] ?? DEFAULT_FACTORS['flight'] ?? 0.25;

  const weeklyKmEmissions = weeklyKm * modeFactor * 52; // weekly -> annual
  const flightEmissions = flightsPerYear * AVG_FLIGHT_DISTANCE_KM * flightFactor; // annual flight emissions

  return {
    annualCo2Kg: weeklyKmEmissions + flightEmissions,
    weeklyKm,
    flights: flightsPerYear
  };
}

export function getEnergyEmissions(
  energy: CalculatorInput['energy'],
  factors: Record<string, number> = DEFAULT_FACTORS
): { annualCo2Kg: number; monthlyKwh: number } {
  const monthlyKwh = energy.monthlyKwh ?? 0;
  const gridFactor = factors['electricity_grid_in'] ?? DEFAULT_FACTORS['electricity_grid_in'] ?? 0.82;
  const fuel = energy.cookingFuel;

  let electricityEmissions = monthlyKwh * gridFactor * 12; // monthly -> annual

  if (energy.hasSolar) {
    electricityEmissions = electricityEmissions * (1 - SOLAR_REDUCTION_FACTOR);
  }

  let cookingEmissions = 0;
  if (fuel === 'lpg') {
    const lpgFactor = factors['cooking_lpg'] ?? DEFAULT_FACTORS['cooking_lpg'] ?? 3.0;
    // Use provided cylinder weight for more accurate calculation, else fall back to estimate
    const lpgKgPerMonth = energy.lpgCylinderKg ?? EST_MONTHLY_LPG_KG;
    cookingEmissions = lpgKgPerMonth * lpgFactor * 12;
  } else if (fuel === 'png') {
    const pngFactor = factors['cooking_png'] ?? DEFAULT_FACTORS['cooking_png'] ?? 2.02;
    cookingEmissions = EST_MONTHLY_PNG_M3 * pngFactor * 12;
  }

  return {
    annualCo2Kg: electricityEmissions + cookingEmissions,
    monthlyKwh
  };
}

export function getDietEmissions(
  diet: CalculatorInput['diet'],
  factors: Record<string, number> = DEFAULT_FACTORS
): number {
  const dietKey = `diet_${diet}`;
  const dietFactor = factors[dietKey] ?? DEFAULT_FACTORS[dietKey] ?? 3.8;
  return dietFactor * 365; // daily -> annual
}

export function getWasteAdjustment(
  waste: CalculatorInput['waste'],
  baseFootprint: number,
  factors: Record<string, number> = DEFAULT_FACTORS
): number {
  const wasteFactor = factors[waste] ?? DEFAULT_FACTORS[waste] ?? 0;
  return baseFootprint * wasteFactor; // percentage reduction
}

/**
 * Pure function to calculate annual carbon footprint.
 */
export function calculateFootprint(
  input: CalculatorInput,
  factors: Record<string, number> = DEFAULT_FACTORS
): CalculatorResult {
  const { annualCo2Kg: transportKg } = getTransportEmissions(input.transport, factors);
  const { annualCo2Kg: energyKg } = getEnergyEmissions(input.energy, factors);
  const dietKg = getDietEmissions(input.diet, factors);

  const preWasteTotal = transportKg + energyKg + dietKg;
  const wasteAdjustment = getWasteAdjustment(input.waste, preWasteTotal, factors);

  const totalAnnualCo2Kg = Math.max(0, preWasteTotal - wasteAdjustment);

  const breakdown: Record<EmissionCategory, number> = {
    transport: Math.round(transportKg),
    energy: Math.round(energyKg),
    diet: Math.round(dietKg),
    waste: Math.round(-wasteAdjustment), // shown as negative offset
  };

  const finalTotal = Math.round(totalAnnualCo2Kg);
  const percentVsNational = Math.round(((finalTotal - NATIONAL_AVG_KG) / NATIONAL_AVG_KG) * 100);

  return {
    totalAnnualCo2Kg: finalTotal,
    breakdown,
    comparison: {
      nationalAvgKg: NATIONAL_AVG_KG,
      globalAvgKg: GLOBAL_AVG_KG,
      percentVsNational,
    },
  };
}
