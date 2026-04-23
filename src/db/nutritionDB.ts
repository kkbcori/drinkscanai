/**
 * Nutrition Database
 * 
 * Uses react-native-quick-sqlite to query a bundled SQLite DB
 * populated from USDA FoodData Central.
 * 
 * Phase 2: This catalog can be synced/updated from Supabase
 * without requiring an app store update.
 */

import { open } from 'react-native-quick-sqlite'
import type { NutritionInfo, DrinkCategory } from '../types'

// Bundled drink catalog — will be replaced by USDA SQLite in next iteration
// Keyed by drink ID matching MobileNetV3 class labels
const DRINK_CATALOG: Record<string, {
  name: string
  category: DrinkCategory
  // Nutrition per 100ml
  caloriesPer100ml: number
  caffeineMgPer100ml: number
  carbsGPer100ml: number
  proteinGPer100ml: number
  fatGPer100ml: number
  sugarGPer100ml: number
}> = {
  coffee_black:        { name: 'Coffee, Black',         category: 'coffee',       caloriesPer100ml: 1,   caffeineMgPer100ml: 40,  carbsGPer100ml: 0,    proteinGPer100ml: 0.1, fatGPer100ml: 0,    sugarGPer100ml: 0 },
  coffee_latte:        { name: 'Latte',                 category: 'coffee',       caloriesPer100ml: 54,  caffeineMgPer100ml: 27,  carbsGPer100ml: 5.6,  proteinGPer100ml: 3.3, fatGPer100ml: 2.1,  sugarGPer100ml: 5.4 },
  coffee_cappuccino:   { name: 'Cappuccino',            category: 'coffee',       caloriesPer100ml: 40,  caffeineMgPer100ml: 27,  carbsGPer100ml: 4,    proteinGPer100ml: 2.5, fatGPer100ml: 1.5,  sugarGPer100ml: 4 },
  coffee_americano:    { name: 'Americano',             category: 'coffee',       caloriesPer100ml: 3,   caffeineMgPer100ml: 35,  carbsGPer100ml: 0.5,  proteinGPer100ml: 0.1, fatGPer100ml: 0,    sugarGPer100ml: 0 },
  coffee_mocha:        { name: 'Mocha',                 category: 'coffee',       caloriesPer100ml: 70,  caffeineMgPer100ml: 27,  carbsGPer100ml: 9,    proteinGPer100ml: 2.5, fatGPer100ml: 2.5,  sugarGPer100ml: 8 },
  tea_black:           { name: 'Black Tea',             category: 'tea',          caloriesPer100ml: 1,   caffeineMgPer100ml: 20,  carbsGPer100ml: 0.2,  proteinGPer100ml: 0,   fatGPer100ml: 0,    sugarGPer100ml: 0 },
  tea_green:           { name: 'Green Tea',             category: 'tea',          caloriesPer100ml: 1,   caffeineMgPer100ml: 12,  carbsGPer100ml: 0.2,  proteinGPer100ml: 0,   fatGPer100ml: 0,    sugarGPer100ml: 0 },
  tea_matcha:          { name: 'Matcha Latte',          category: 'tea',          caloriesPer100ml: 50,  caffeineMgPer100ml: 35,  carbsGPer100ml: 6,    proteinGPer100ml: 2,   fatGPer100ml: 1.5,  sugarGPer100ml: 5 },
  tea_herbal:          { name: 'Herbal Tea',            category: 'tea',          caloriesPer100ml: 1,   caffeineMgPer100ml: 0,   carbsGPer100ml: 0.2,  proteinGPer100ml: 0,   fatGPer100ml: 0,    sugarGPer100ml: 0 },
  water_still:         { name: 'Water',                 category: 'water',        caloriesPer100ml: 0,   caffeineMgPer100ml: 0,   carbsGPer100ml: 0,    proteinGPer100ml: 0,   fatGPer100ml: 0,    sugarGPer100ml: 0 },
  water_sparkling:     { name: 'Sparkling Water',       category: 'water',        caloriesPer100ml: 0,   caffeineMgPer100ml: 0,   carbsGPer100ml: 0,    proteinGPer100ml: 0,   fatGPer100ml: 0,    sugarGPer100ml: 0 },
  juice_orange:        { name: 'Orange Juice',          category: 'juice',        caloriesPer100ml: 45,  caffeineMgPer100ml: 0,   carbsGPer100ml: 10.4, proteinGPer100ml: 0.7, fatGPer100ml: 0.2,  sugarGPer100ml: 8.4 },
  juice_apple:         { name: 'Apple Juice',           category: 'juice',        caloriesPer100ml: 46,  caffeineMgPer100ml: 0,   carbsGPer100ml: 11.3, proteinGPer100ml: 0.1, fatGPer100ml: 0.1,  sugarGPer100ml: 9.6 },
  soda_cola:           { name: 'Cola',                  category: 'soda',         caloriesPer100ml: 42,  caffeineMgPer100ml: 10,  carbsGPer100ml: 10.6, proteinGPer100ml: 0,   fatGPer100ml: 0,    sugarGPer100ml: 10.6 },
  soda_diet:           { name: 'Diet Soda',             category: 'soda',         caloriesPer100ml: 0,   caffeineMgPer100ml: 12,  carbsGPer100ml: 0.1,  proteinGPer100ml: 0,   fatGPer100ml: 0,    sugarGPer100ml: 0 },
  milk_whole:          { name: 'Whole Milk',            category: 'milk',         caloriesPer100ml: 61,  caffeineMgPer100ml: 0,   carbsGPer100ml: 4.8,  proteinGPer100ml: 3.2, fatGPer100ml: 3.3,  sugarGPer100ml: 4.8 },
  milk_oat:            { name: 'Oat Milk',              category: 'milk',         caloriesPer100ml: 47,  caffeineMgPer100ml: 0,   carbsGPer100ml: 6.7,  proteinGPer100ml: 1,   fatGPer100ml: 1.5,  sugarGPer100ml: 4 },
  milk_almond:         { name: 'Almond Milk',           category: 'milk',         caloriesPer100ml: 17,  caffeineMgPer100ml: 0,   carbsGPer100ml: 1.5,  proteinGPer100ml: 0.6, fatGPer100ml: 1.1,  sugarGPer100ml: 1 },
  energy_drink:        { name: 'Energy Drink',          category: 'energy_drink', caloriesPer100ml: 45,  caffeineMgPer100ml: 32,  carbsGPer100ml: 11,   proteinGPer100ml: 0,   fatGPer100ml: 0,    sugarGPer100ml: 11 },
  smoothie_fruit:      { name: 'Fruit Smoothie',        category: 'smoothie',     caloriesPer100ml: 62,  caffeineMgPer100ml: 0,   carbsGPer100ml: 14,   proteinGPer100ml: 1,   fatGPer100ml: 0.3,  sugarGPer100ml: 12 },
  unknown:             { name: 'Unknown Drink',         category: 'unknown',      caloriesPer100ml: 30,  caffeineMgPer100ml: 0,   carbsGPer100ml: 5,    proteinGPer100ml: 0.5, fatGPer100ml: 0.5,  sugarGPer100ml: 3 },
}

export function getDrinkInfo(drinkId: string) {
  return DRINK_CATALOG[drinkId] ?? DRINK_CATALOG['unknown']
}

export function getAllDrinkIds(): string[] {
  return Object.keys(DRINK_CATALOG)
}

export function calculateNutrition(drinkId: string, liquidVolumeMl: number): NutritionInfo {
  const drink = getDrinkInfo(drinkId)
  const ratio = liquidVolumeMl / 100

  return {
    calories:      Math.round(drink.caloriesPer100ml     * ratio),
    caffeineGrams: Math.round(drink.caffeineMgPer100ml   * ratio) / 1000,
    carbsGrams:    Math.round(drink.carbsGPer100ml       * ratio * 10) / 10,
    proteinGrams:  Math.round(drink.proteinGPer100ml     * ratio * 10) / 10,
    fatGrams:      Math.round(drink.fatGPer100ml         * ratio * 10) / 10,
    sugarGrams:    Math.round(drink.sugarGPer100ml       * ratio * 10) / 10,
  }
}

export function getDrinkName(drinkId: string): string {
  return getDrinkInfo(drinkId).name
}
