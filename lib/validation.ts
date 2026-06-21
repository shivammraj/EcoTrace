import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters long').max(100),
  name: z.string().min(1, 'Name is required').max(255),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const calculatorInputSchema = z.object({
  transport: z.object({
    mode: z.enum([
      'car_petrol',
      'car_diesel',
      'car_electric',
      'motorbike',
      'bus',
      'train',
      'flight',
      'walk_cycle',
    ]),
    weeklyKm: z.number().min(0).optional().default(0),
    flightsPerYear: z.number().min(0).optional().default(0),
  }),
  energy: z.object({
    monthlyKwh: z.number().min(0).default(0),
    cookingFuel: z.enum(['lpg', 'png', 'electric']),
    hasSolar: z.boolean().optional().default(false),
    lpgCylinderKg: z.number().min(0).optional(),
  }),
  diet: z.enum(['high_meat', 'moderate_meat', 'vegetarian', 'vegan']),
  waste: z.enum(['low_recycling', 'some_recycling', 'high_recycling']),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
