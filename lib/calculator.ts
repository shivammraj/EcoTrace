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

/**
 * Default emission factors. Sources:
 * - Transport: DEFRA UK Govt 2023 / IPCC AR6 India-adjusted values
 * - Electricity: CEA India Grid Emission Factor 2022 (0.82 kg CO2e/kWh)
 * - LPG: BEE India = 3.0 kg CO2e per kg LPG burned
 * - PNG: IPCC = 2.02 kg CO2e per cubic metre natural gas
 * - Diet: Poore & Nemecek 2018 (Science), Oxford Martin School
 * - Recycling: WRAP UK waste offset percentages
 */
export const DEFAULT_FACTORS: Record<string, number> = {
  // Transport (kg CO2e per km)
  car_petrol: 0.1900,
  car_diesel: 0.1700,
  car_electric: 0.0500,
  motorbike: 0.0800,
  bus: 0.1000,
  train: 0.0400,
  flight: 0.2500,
  walk_cycle: 0.0000,

  // Energy (grid electricity per kWh, fuels per standard unit)
  electricity_grid_in: 0.8200,
  cooking_lpg: 3.0000,
  cooking_png: 2.0200,
  cooking_electric: 0.0000,

  // Diet (kg CO2e per day per person)
  diet_high_meat: 7.2000,
  diet_moderate_meat: 5.6000,
  diet_vegetarian: 3.8000,
  diet_vegan: 2.9000,

  // Waste recycling offset multiplier (fraction of total footprint)
  low_recycling: 0.0000,
  some_recycling: 0.0500,
  high_recycling: 0.1200,
};

/** Average domestic flight distance in India (km), used for per-flight emission estimate. */
const AVG_FLIGHT_DISTANCE_KM = 1000;
/** Typical monthly household LPG consumption (kg), used when cylinder weight is not specified. */
const EST_MONTHLY_LPG_KG = 10;
/** Typical monthly piped natural gas consumption (cubic metres). */
const EST_MONTHLY_PNG_M3 = 12;
/** Fraction of grid electricity emissions avoided with a rooftop solar installation. */
const SOLAR_REDUCTION_FACTOR = 0.70;

// Benchmarks (Our World In Data / MoEFCC India)
export const NATIONAL_AVG_KG = 1900; // India ~1.9 tonnes CO2e / year / capita
export const GLOBAL_AVG_KG = 4700;   // Global ~4.7 tonnes CO2e / year / capita

/**
 * Calculates annual transport CO₂e emissions from vehicle travel and flights.
 * @param transport - Transport input (mode, weeklyKm, flightsPerYear)
 * @param factors - Emission factors map; falls back to DEFAULT_FACTORS for missing keys
 */
export function getTransportEmissions(
  transport: CalculatorInput['transport'],
  factors: Record<string, number> = DEFAULT_FACTORS
): { annualCo2Kg: number; weeklyKm: number; flights: number } {
  const mode = transport.mode;
  const weeklyKm = transport.weeklyKm ?? 0;
  const flightsPerYear = transport.flightsPerYear ?? 0;

  const modeFactor = factors[mode] ?? DEFAULT_FACTORS[mode] ?? 0;
  const flightFactor = factors['flight'] ?? DEFAULT_FACTORS['flight'] ?? 0.25;

  const weeklyKmEmissions = weeklyKm * modeFactor * 52; // weekly → annual
  const flightEmissions = flightsPerYear * AVG_FLIGHT_DISTANCE_KM * flightFactor;

  return {
    annualCo2Kg: weeklyKmEmissions + flightEmissions,
    weeklyKm,
    flights: flightsPerYear
  };
}

/**
 * Calculates annual energy CO₂e emissions from grid electricity and cooking fuel.
 * @param energy - Energy input (monthlyKwh, cookingFuel, hasSolar, lpgCylinderKg)
 * @param factors - Emission factors map; falls back to DEFAULT_FACTORS for missing keys
 */
export function getEnergyEmissions(
  energy: CalculatorInput['energy'],
  factors: Record<string, number> = DEFAULT_FACTORS
): { annualCo2Kg: number; monthlyKwh: number } {
  const monthlyKwh = energy.monthlyKwh ?? 0;
  const gridFactor = factors['electricity_grid_in'] ?? DEFAULT_FACTORS['electricity_grid_in'] ?? 0.82;
  const fuel = energy.cookingFuel;

  let electricityEmissions = monthlyKwh * gridFactor * 12; // monthly → annual

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

/**
 * Calculates annual diet CO₂e emissions based on dietary pattern.
 * @param diet - Dietary category (high_meat | moderate_meat | vegetarian | vegan)
 * @param factors - Emission factors map; falls back to DEFAULT_FACTORS for missing keys
 */
export function getDietEmissions(
  diet: CalculatorInput['diet'],
  factors: Record<string, number> = DEFAULT_FACTORS
): number {
  const dietKey = `diet_${diet}`;
  const dietFactor = factors[dietKey] ?? DEFAULT_FACTORS[dietKey] ?? 3.8;
  return dietFactor * 365; // daily → annual
}

/**
 * Calculates the recycling/composting offset to subtract from the total footprint.
 * @param waste - Recycling behaviour category
 * @param baseFootprint - Pre-offset total footprint (kg CO₂e)
 * @param factors - Emission factors map; falls back to DEFAULT_FACTORS for missing keys
 * @returns Positive kg CO₂e to subtract from baseFootprint
 */
export function getWasteAdjustment(
  waste: CalculatorInput['waste'],
  baseFootprint: number,
  factors: Record<string, number> = DEFAULT_FACTORS
): number {
  const wasteFactor = factors[waste] ?? DEFAULT_FACTORS[waste] ?? 0;
  return baseFootprint * wasteFactor; // fractional reduction
}

/**
 * Pure function to calculate the complete annual carbon footprint.
 * Computes transport, energy, and diet emissions, applies waste offset, and
 * returns the total together with a per-category breakdown and national/global comparisons.
 *
 * @param input - User-supplied activity data across all four categories
 * @param factors - Optional override emission factors (e.g. database-sourced values)
 * @returns CalculatorResult with totalAnnualCo2Kg, breakdown, and comparison
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
