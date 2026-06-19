import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding emission factors...');

  // Delete existing emission factors to avoid duplicates
  await prisma.emissionFactor.deleteMany();

  const factors = [
    // --- TRANSPORT ---
    // factors are kg CO2e per km
    {
      category: 'transport',
      subcategory: 'car_petrol',
      unit: 'kg_co2_per_km',
      factor: 0.1900, // TODO: verify against DEFRA/EPA
      region: 'IN',
    },
    {
      category: 'transport',
      subcategory: 'car_diesel',
      unit: 'kg_co2_per_km',
      factor: 0.1700, // TODO: verify against DEFRA/EPA
      region: 'IN',
    },
    {
      category: 'transport',
      subcategory: 'car_electric',
      unit: 'kg_co2_per_km',
      factor: 0.0500, // TODO: verify against grid-intensity estimates
      region: 'IN',
    },
    {
      category: 'transport',
      subcategory: 'motorbike',
      unit: 'kg_co2_per_km',
      factor: 0.0800, // TODO: verify against local standards
      region: 'IN',
    },
    {
      category: 'transport',
      subcategory: 'bus',
      unit: 'kg_co2_per_km',
      factor: 0.1000, // TODO: verify average passenger occupancy factors
      region: 'IN',
    },
    {
      category: 'transport',
      subcategory: 'train',
      unit: 'kg_co2_per_km',
      factor: 0.0400, // TODO: verify against Indian Railways grid electricity usage
      region: 'IN',
    },
    {
      category: 'transport',
      subcategory: 'flight',
      unit: 'kg_co2_per_km',
      factor: 0.2500, // TODO: verify domestic vs international flights
      region: 'IN',
    },
    {
      category: 'transport',
      subcategory: 'walk_cycle',
      unit: 'kg_co2_per_km',
      factor: 0.0000,
      region: 'IN',
    },

    // --- ENERGY ---
    // grid electricity is kg CO2e per kWh
    {
      category: 'energy',
      subcategory: 'electricity_grid_in',
      unit: 'kg_co2_per_kwh',
      factor: 0.8200, // TODO: verify against India's CEA grid-emission-factor database (typically 0.7-0.8)
      region: 'IN',
    },
    // cooking fuel is kg CO2e per unit (kg or equivalent)
    {
      category: 'energy',
      subcategory: 'cooking_lpg',
      unit: 'kg_co2_per_kg',
      factor: 3.0000, // TODO: verify LPG emission factor per kg burned
      region: 'IN',
    },
    {
      category: 'energy',
      subcategory: 'cooking_png',
      unit: 'kg_co2_per_m3',
      factor: 2.0200, // TODO: verify PNG emission factor per cubic meter
      region: 'IN',
    },
    {
      category: 'energy',
      subcategory: 'cooking_electric',
      unit: 'kg_co2_per_kwh',
      factor: 0.0000, // TODO: verify (indirectly captured in grid electricity usage)
      region: 'IN',
    },

    // --- DIET ---
    // factors are kg CO2e per day (which can be multiplied by 365 for annual)
    {
      category: 'diet',
      subcategory: 'diet_high_meat',
      unit: 'kg_co2_per_day',
      factor: 7.2000, // TODO: verify against Our World in Data
      region: 'IN',
    },
    {
      category: 'diet',
      subcategory: 'diet_moderate_meat',
      unit: 'kg_co2_per_day',
      factor: 5.6000, // TODO: verify against Our World in Data
      region: 'IN',
    },
    {
      category: 'diet',
      subcategory: 'diet_vegetarian',
      unit: 'kg_co2_per_day',
      factor: 3.8000, // TODO: verify against Our World in Data
      region: 'IN',
    },
    {
      category: 'diet',
      subcategory: 'diet_vegan',
      unit: 'kg_co2_per_day',
      factor: 2.9000, // TODO: verify against Our World in Data
      region: 'IN',
    },

    // --- WASTE ---
    // factors are percentage reduction offsets (0.0 to 1.0)
    {
      category: 'waste',
      subcategory: 'low_recycling',
      unit: 'offset_multiplier',
      factor: 0.0000, // TODO: verify waste reduction factors
      region: 'IN',
    },
    {
      category: 'waste',
      subcategory: 'some_recycling',
      unit: 'offset_multiplier',
      factor: 0.0500, // 5% reduction off total footprint (TODO: verify standard offset assumptions)
      region: 'IN',
    },
    {
      category: 'waste',
      subcategory: 'high_recycling',
      unit: 'offset_multiplier',
      factor: 0.1200, // 12% reduction off total footprint (TODO: verify standard offset assumptions)
      region: 'IN',
    },
  ];

  for (const factor of factors) {
    await prisma.emissionFactor.create({
      data: factor,
    });
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
