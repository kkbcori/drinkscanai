// Core types used across the app
// Schema designed to be Supabase-ready in Phase 2

export type DrinkCategory =
  | 'coffee'
  | 'tea'
  | 'juice'
  | 'soda'
  | 'water'
  | 'milk'
  | 'alcohol'
  | 'smoothie'
  | 'energy_drink'
  | 'unknown'

export type DrinkIdentification = {
  drinkId: string        // matches USDA/nutrition DB key
  drinkName: string      // display name e.g. "Coffee, Black"
  category: DrinkCategory
  confidence: number     // 0-1 from ML model
  modelVersion: string   // e.g. "mobilenetv3_v1"
}

export type VolumeEstimate = {
  totalVolumeMl: number   // total cup capacity in ml
  fillLevelPct: number    // 0-100 how full the cup is
  liquidVolumeMl: number  // actual liquid = total * fillLevel
  method: 'arkit' | 'fallback'
}

export type NutritionInfo = {
  calories: number
  caffeineGrams: number
  carbsGrams: number
  proteinGrams: number
  fatGrams: number
  sugarGrams: number
  // per liquidVolumeMl
}

export type ScanResult = {
  // Identity
  scanId: string          // UUID - ready for Supabase sync
  timestamp: string       // ISO8601

  // ML output
  identification: DrinkIdentification

  // AR output
  volume: VolumeEstimate

  // Nutrition (calculated from identification + volume)
  nutrition: NutritionInfo

  // User feedback (for future model training)
  userConfirmed: boolean
  userCorrection?: string  // drink name if user corrected

  // Phase 2: sync status
  syncedToCloud: boolean   // always false in Phase 1
}

export type ScanHistoryItem = ScanResult & {
  id: number  // local SQLite rowid
}
