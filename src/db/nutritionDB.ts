// nutritionDB.ts
// Local SQLite-backed nutrition lookup.
// In production, use react-native-quick-sqlite and bundle a pre-populated .db file.
// This file provides the interface and a seed dataset for development.

export interface NutritionEntry {
  id: string
  name: string
  category: string
  calories_per_100ml: number
  caffeine_mg_per_100ml: number
  carbs_g_per_100ml: number
  protein_g_per_100ml: number
  fat_g_per_100ml: number
  sugar_g_per_100ml: number
}

// ─── Seed data (replace with full USDA FDC dataset in production) ────────────
const DRINK_DB: Record<string, NutritionEntry> = {
  black_coffee: {
    id: 'black_coffee',
    name: 'Black coffee',
    category: 'coffee',
    calories_per_100ml: 2,
    caffeine_mg_per_100ml: 40,
    carbs_g_per_100ml: 0,
    protein_g_per_100ml: 0.1,
    fat_g_per_100ml: 0,
    sugar_g_per_100ml: 0,
  },
  coffee_latte: {
    id: 'coffee_latte',
    name: 'Latte',
    category: 'coffee',
    calories_per_100ml: 54,
    caffeine_mg_per_100ml: 24,
    carbs_g_per_100ml: 5.1,
    protein_g_per_100ml: 3.4,
    fat_g_per_100ml: 2.1,
    sugar_g_per_100ml: 5.0,
  },
  espresso: {
    id: 'espresso',
    name: 'Espresso',
    category: 'coffee',
    calories_per_100ml: 9,
    caffeine_mg_per_100ml: 212,
    carbs_g_per_100ml: 1.7,
    protein_g_per_100ml: 0.6,
    fat_g_per_100ml: 0.2,
    sugar_g_per_100ml: 0,
  },
  whole_milk: {
    id: 'whole_milk',
    name: 'Whole milk',
    category: 'dairy',
    calories_per_100ml: 61,
    caffeine_mg_per_100ml: 0,
    carbs_g_per_100ml: 4.8,
    protein_g_per_100ml: 3.2,
    fat_g_per_100ml: 3.3,
    sugar_g_per_100ml: 4.8,
  },
  orange_juice: {
    id: 'orange_juice',
    name: 'Orange juice',
    category: 'juice',
    calories_per_100ml: 45,
    caffeine_mg_per_100ml: 0,
    carbs_g_per_100ml: 10.4,
    protein_g_per_100ml: 0.7,
    fat_g_per_100ml: 0.2,
    sugar_g_per_100ml: 8.4,
  },
  cola: {
    id: 'cola',
    name: 'Cola',
    category: 'soda',
    calories_per_100ml: 37,
    caffeine_mg_per_100ml: 10,
    carbs_g_per_100ml: 9.6,
    protein_g_per_100ml: 0,
    fat_g_per_100ml: 0,
    sugar_g_per_100ml: 9.6,
  },
  water: {
    id: 'water',
    name: 'Water',
    category: 'water',
    calories_per_100ml: 0,
    caffeine_mg_per_100ml: 0,
    carbs_g_per_100ml: 0,
    protein_g_per_100ml: 0,
    fat_g_per_100ml: 0,
    sugar_g_per_100ml: 0,
  },
  beer: {
    id: 'beer',
    name: 'Beer (regular)',
    category: 'alcohol',
    calories_per_100ml: 43,
    caffeine_mg_per_100ml: 0,
    carbs_g_per_100ml: 3.6,
    protein_g_per_100ml: 0.5,
    fat_g_per_100ml: 0,
    sugar_g_per_100ml: 0,
  },
  green_tea: {
    id: 'green_tea',
    name: 'Green tea',
    category: 'tea',
    calories_per_100ml: 1,
    caffeine_mg_per_100ml: 12,
    carbs_g_per_100ml: 0,
    protein_g_per_100ml: 0,
    fat_g_per_100ml: 0,
    sugar_g_per_100ml: 0,
  },
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Look up nutrition data by drink ID.
 * In production this queries the bundled SQLite file.
 */
export async function lookupNutrition(drinkId: string): Promise<NutritionEntry | null> {
  // TODO: replace with: await db.executeAsync('SELECT * FROM drinks WHERE id = ?', [drinkId])
  return DRINK_DB[drinkId] ?? null
}

/**
 * Search drinks by partial name match.
 * Used for the manual override / correction flow.
 */
export async function searchDrinks(query: string): Promise<NutritionEntry[]> {
  const q = query.toLowerCase()
  return Object.values(DRINK_DB).filter(
    d => d.name.toLowerCase().includes(q) || d.category.includes(q)
  )
}

/**
 * Calculate nutrition totals for a given drink and volume.
 */
export function calculateNutrition(
  entry: NutritionEntry,
  volumeMl: number,
  fillPercent: number = 100
) {
  const effective = volumeMl * (fillPercent / 100)
  const factor = effective / 100

  return {
    drink: entry.name,
    volume_ml: Math.round(effective),
    calories: Math.round(entry.calories_per_100ml * factor),
    caffeine_mg: Math.round(entry.caffeine_mg_per_100ml * factor),
    carbs_g: Math.round(entry.carbs_g_per_100ml * factor * 10) / 10,
    protein_g: Math.round(entry.protein_g_per_100ml * factor * 10) / 10,
    fat_g: Math.round(entry.fat_g_per_100ml * factor * 10) / 10,
    sugar_g: Math.round(entry.sugar_g_per_100ml * factor * 10) / 10,
  }
}
