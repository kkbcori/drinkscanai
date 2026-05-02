/**
 * nutritionDB.ts
 * DrinkScanAI — Drink catalog using exact IDs from trained CoreML model
 * IDs must match INDEX_TO_ID in drinkClassifier.ts exactly
 */

import type { NutritionInfo, DrinkCategory } from '../types'

interface DrinkEntry {
  name:                string
  category:            DrinkCategory
  caloriesPer100ml:    number
  caffeineMgPer100ml:  number
  carbsGPer100ml:      number
  proteinGPer100ml:    number
  fatGPer100ml:        number
  sugarGPer100ml:      number
}

// Keys must exactly match INDEX_TO_ID in drinkClassifier.ts (indices 0-37)
const DRINK_CATALOG: Record<string, DrinkEntry> = {
  // ── Coffee (indices 0-5) ──────────────────────────────────────────────
  espresso:        { name:'Espresso',         category:'coffee',       caloriesPer100ml:9,   caffeineMgPer100ml:212, carbsGPer100ml:1.8,  proteinGPer100ml:0.6, fatGPer100ml:0.2,  sugarGPer100ml:0 },
  latte:           { name:'Latte',            category:'coffee',       caloriesPer100ml:54,  caffeineMgPer100ml:27,  carbsGPer100ml:5.6,  proteinGPer100ml:3.3, fatGPer100ml:2.1,  sugarGPer100ml:5.4 },
  cappuccino:      { name:'Cappuccino',       category:'coffee',       caloriesPer100ml:40,  caffeineMgPer100ml:27,  carbsGPer100ml:4,    proteinGPer100ml:2.5, fatGPer100ml:1.5,  sugarGPer100ml:4 },
  coffee_black:    { name:'Black Coffee',     category:'coffee',       caloriesPer100ml:1,   caffeineMgPer100ml:40,  carbsGPer100ml:0,    proteinGPer100ml:0.1, fatGPer100ml:0,    sugarGPer100ml:0 },
  iced_coffee:     { name:'Iced Coffee',      category:'coffee',       caloriesPer100ml:25,  caffeineMgPer100ml:30,  carbsGPer100ml:5,    proteinGPer100ml:0.3, fatGPer100ml:0.3,  sugarGPer100ml:4 },
  cold_brew:       { name:'Cold Brew Coffee', category:'coffee',       caloriesPer100ml:5,   caffeineMgPer100ml:83,  carbsGPer100ml:0,    proteinGPer100ml:0.2, fatGPer100ml:0,    sugarGPer100ml:0 },

  // ── Tea (indices 6-12) ────────────────────────────────────────────────
  black_tea:       { name:'Black Tea',        category:'tea',          caloriesPer100ml:1,   caffeineMgPer100ml:20,  carbsGPer100ml:0.2,  proteinGPer100ml:0,   fatGPer100ml:0,    sugarGPer100ml:0 },
  green_tea:       { name:'Green Tea',        category:'tea',          caloriesPer100ml:1,   caffeineMgPer100ml:12,  carbsGPer100ml:0.2,  proteinGPer100ml:0,   fatGPer100ml:0,    sugarGPer100ml:0 },
  matcha_latte:    { name:'Matcha Latte',     category:'tea',          caloriesPer100ml:50,  caffeineMgPer100ml:35,  carbsGPer100ml:6,    proteinGPer100ml:2,   fatGPer100ml:1.5,  sugarGPer100ml:5 },
  chai_latte:      { name:'Chai Latte',       category:'tea',          caloriesPer100ml:62,  caffeineMgPer100ml:14,  carbsGPer100ml:9,    proteinGPer100ml:2.5, fatGPer100ml:1.5,  sugarGPer100ml:8 },
  herbal_tea:      { name:'Herbal Tea',       category:'tea',          caloriesPer100ml:1,   caffeineMgPer100ml:0,   carbsGPer100ml:0.2,  proteinGPer100ml:0,   fatGPer100ml:0,    sugarGPer100ml:0 },
  iced_tea:        { name:'Iced Tea',         category:'tea',          caloriesPer100ml:16,  caffeineMgPer100ml:5,   carbsGPer100ml:4,    proteinGPer100ml:0,   fatGPer100ml:0,    sugarGPer100ml:4 },
  bubble_tea:      { name:'Bubble Tea',       category:'tea',          caloriesPer100ml:80,  caffeineMgPer100ml:15,  carbsGPer100ml:17,   proteinGPer100ml:1,   fatGPer100ml:1,    sugarGPer100ml:12 },

  // ── Juice (indices 13-16) ─────────────────────────────────────────────
  orange_juice:    { name:'Orange Juice',     category:'juice',        caloriesPer100ml:45,  caffeineMgPer100ml:0,   carbsGPer100ml:10.4, proteinGPer100ml:0.7, fatGPer100ml:0.2,  sugarGPer100ml:8.4 },
  apple_juice:     { name:'Apple Juice',      category:'juice',        caloriesPer100ml:46,  caffeineMgPer100ml:0,   carbsGPer100ml:11.3, proteinGPer100ml:0.1, fatGPer100ml:0.1,  sugarGPer100ml:9.6 },
  lemonade:        { name:'Lemonade',         category:'juice',        caloriesPer100ml:40,  caffeineMgPer100ml:0,   carbsGPer100ml:10,   proteinGPer100ml:0.1, fatGPer100ml:0,    sugarGPer100ml:9 },
  tomato_juice:    { name:'Tomato Juice',     category:'juice',        caloriesPer100ml:17,  caffeineMgPer100ml:0,   carbsGPer100ml:3.5,  proteinGPer100ml:0.9, fatGPer100ml:0.1,  sugarGPer100ml:2.6 },

  // ── Smoothies (indices 17-18) ─────────────────────────────────────────
  fruit_smoothie:  { name:'Fruit Smoothie',   category:'smoothie',     caloriesPer100ml:62,  caffeineMgPer100ml:0,   carbsGPer100ml:14,   proteinGPer100ml:1,   fatGPer100ml:0.3,  sugarGPer100ml:12 },
  green_smoothie:  { name:'Green Smoothie',   category:'smoothie',     caloriesPer100ml:40,  caffeineMgPer100ml:0,   carbsGPer100ml:8,    proteinGPer100ml:2,   fatGPer100ml:0.5,  sugarGPer100ml:6 },

  // ── Milk (indices 19-23) ──────────────────────────────────────────────
  whole_milk:      { name:'Whole Milk',       category:'milk',         caloriesPer100ml:61,  caffeineMgPer100ml:0,   carbsGPer100ml:4.8,  proteinGPer100ml:3.2, fatGPer100ml:3.3,  sugarGPer100ml:4.8 },
  chocolate_milk:  { name:'Chocolate Milk',   category:'milk',         caloriesPer100ml:83,  caffeineMgPer100ml:2,   carbsGPer100ml:12,   proteinGPer100ml:3.4, fatGPer100ml:2.5,  sugarGPer100ml:11 },
  oat_milk:        { name:'Oat Milk',         category:'milk',         caloriesPer100ml:47,  caffeineMgPer100ml:0,   carbsGPer100ml:6.7,  proteinGPer100ml:1,   fatGPer100ml:1.5,  sugarGPer100ml:4 },
  protein_shake:   { name:'Protein Shake',    category:'sports',       caloriesPer100ml:60,  caffeineMgPer100ml:0,   carbsGPer100ml:5,    proteinGPer100ml:8,   fatGPer100ml:1,    sugarGPer100ml:3 },
  milkshake:       { name:'Milkshake',        category:'hot_drink',    caloriesPer100ml:112, caffeineMgPer100ml:0,   carbsGPer100ml:18,   proteinGPer100ml:3,   fatGPer100ml:3.5,  sugarGPer100ml:16 },

  // ── Soda (indices 24-28) ──────────────────────────────────────────────
  cola:            { name:'Cola',             category:'soda',         caloriesPer100ml:42,  caffeineMgPer100ml:10,  carbsGPer100ml:10.6, proteinGPer100ml:0,   fatGPer100ml:0,    sugarGPer100ml:10.6 },
  diet_cola:       { name:'Diet Cola',        category:'soda',         caloriesPer100ml:0,   caffeineMgPer100ml:12,  carbsGPer100ml:0.1,  proteinGPer100ml:0,   fatGPer100ml:0,    sugarGPer100ml:0 },
  lemon_lime_soda: { name:'Lemon-Lime Soda',  category:'soda',         caloriesPer100ml:42,  caffeineMgPer100ml:0,   carbsGPer100ml:10.7, proteinGPer100ml:0,   fatGPer100ml:0,    sugarGPer100ml:10.7 },
  energy_drink:    { name:'Energy Drink',     category:'energy_drink', caloriesPer100ml:45,  caffeineMgPer100ml:32,  carbsGPer100ml:11,   proteinGPer100ml:0,   fatGPer100ml:0,    sugarGPer100ml:11 },
  sports_drink:    { name:'Sports Drink',     category:'sports',       caloriesPer100ml:25,  caffeineMgPer100ml:0,   carbsGPer100ml:6,    proteinGPer100ml:0,   fatGPer100ml:0,    sugarGPer100ml:5 },

  // ── Water (indices 29-31) ─────────────────────────────────────────────
  water:           { name:'Still Water',      category:'water',        caloriesPer100ml:0,   caffeineMgPer100ml:0,   carbsGPer100ml:0,    proteinGPer100ml:0,   fatGPer100ml:0,    sugarGPer100ml:0 },
  sparkling_water: { name:'Sparkling Water',  category:'water',        caloriesPer100ml:0,   caffeineMgPer100ml:0,   carbsGPer100ml:0,    proteinGPer100ml:0,   fatGPer100ml:0,    sugarGPer100ml:0 },
  coconut_water:   { name:'Coconut Water',    category:'water',        caloriesPer100ml:19,  caffeineMgPer100ml:0,   carbsGPer100ml:4.5,  proteinGPer100ml:0.2, fatGPer100ml:0.1,  sugarGPer100ml:3.7 },

  // ── Alcohol (indices 32-35) ───────────────────────────────────────────
  beer:            { name:'Beer',             category:'alcohol',      caloriesPer100ml:43,  caffeineMgPer100ml:0,   carbsGPer100ml:3.6,  proteinGPer100ml:0.5, fatGPer100ml:0,    sugarGPer100ml:0 },
  wine_red:        { name:'Red Wine',         category:'alcohol',      caloriesPer100ml:85,  caffeineMgPer100ml:0,   carbsGPer100ml:2.6,  proteinGPer100ml:0.1, fatGPer100ml:0,    sugarGPer100ml:0.6 },
  wine_white:      { name:'White Wine',       category:'alcohol',      caloriesPer100ml:82,  caffeineMgPer100ml:0,   carbsGPer100ml:2.6,  proteinGPer100ml:0.1, fatGPer100ml:0,    sugarGPer100ml:1 },
  cocktail:        { name:'Cocktail',         category:'alcohol',      caloriesPer100ml:100, caffeineMgPer100ml:0,   carbsGPer100ml:8,    proteinGPer100ml:0,   fatGPer100ml:0,    sugarGPer100ml:7 },

  // ── Hot drinks / fermented (indices 36-37) ────────────────────────────
  hot_chocolate:   { name:'Hot Chocolate',    category:'hot_drink',    caloriesPer100ml:67,  caffeineMgPer100ml:5,   carbsGPer100ml:10,   proteinGPer100ml:2.5, fatGPer100ml:2,    sugarGPer100ml:9 },
  kombucha:        { name:'Kombucha',         category:'fermented',    caloriesPer100ml:13,  caffeineMgPer100ml:6,   carbsGPer100ml:3,    proteinGPer100ml:0,   fatGPer100ml:0,    sugarGPer100ml:2.5 },

  // ── Unknown fallback ──────────────────────────────────────────────────
  unknown:         { name:'Unknown Drink',    category:'unknown',      caloriesPer100ml:30,  caffeineMgPer100ml:0,   carbsGPer100ml:5,    proteinGPer100ml:0.5, fatGPer100ml:0.5,  sugarGPer100ml:3 },
}

export function getDrinkInfo(drinkId: string): DrinkEntry {
  if (DRINK_CATALOG[drinkId]) return DRINK_CATALOG[drinkId]
  // Try common variations
  const variations = [
    drinkId.replace(/-/g, '_'),
    drinkId.replace(/\s+/g, '_').toLowerCase(),
  ]
  for (const v of variations) {
    if (DRINK_CATALOG[v]) return DRINK_CATALOG[v]
  }
  console.warn('[nutritionDB] Unknown ID:', drinkId)
  return DRINK_CATALOG['unknown']
}

export function getAllDrinkIds(): string[] {
  return Object.keys(DRINK_CATALOG).filter(k => k !== 'unknown')
}

export function getDrinkName(drinkId: string): string {
  return getDrinkInfo(drinkId).name
}

export function calculateNutrition(drinkId: string, liquidVolumeMl: number): NutritionInfo {
  const d = getDrinkInfo(drinkId)
  const r = liquidVolumeMl / 100
  return {
    calories:      Math.round(d.caloriesPer100ml    * r),
    caffeineGrams: Math.round(d.caffeineMgPer100ml  * r) / 1000,
    carbsGrams:    Math.round(d.carbsGPer100ml      * r * 10) / 10,
    proteinGrams:  Math.round(d.proteinGPer100ml    * r * 10) / 10,
    fatGrams:      Math.round(d.fatGPer100ml        * r * 10) / 10,
    sugarGrams:    Math.round(d.sugarGPer100ml      * r * 10) / 10,
  }
}
