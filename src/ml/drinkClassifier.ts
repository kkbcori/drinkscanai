import { NativeModules } from 'react-native'
import type { DrinkIdentification } from '../types'
import { getDrinkInfo, getAllDrinkIds } from '../db/nutritionDB'

const { DrinkClassifierModule } = NativeModules
const MODEL_VERSION_COREML    = 'coreml_v3_finetuned'
const MODEL_VERSION_HEURISTIC = 'heuristic_v1'

let coremlAvailable: boolean | null = null
let lastError: string = ''

// Map of display name → drink ID built from nutritionDB
// e.g. "Still Water" → "water", "Black Coffee" → "coffee_black"
function buildNameToIdMap(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const id of getAllDrinkIds()) {
    const info = getDrinkInfo(id)
    map[info.name.toLowerCase()] = id
    // Also map the raw id in case model returns it directly
    map[id.toLowerCase()] = id
    // Common variations
    map[id.replace(/_/g, ' ').toLowerCase()] = id
  }
  return map
}

let nameToIdMap: Record<string, string> | null = null

function resolveClassId(className: string): string {
  if (!nameToIdMap) nameToIdMap = buildNameToIdMap()

  const key = className.toLowerCase().trim()

  // Direct lookup
  if (nameToIdMap[key]) return nameToIdMap[key]

  // Try replacing spaces with underscores
  const underscored = key.replace(/\s+/g, '_')
  if (nameToIdMap[underscored]) return nameToIdMap[underscored]

  // Try partial match — e.g. "still water" matches "water"
  for (const [mapKey, id] of Object.entries(nameToIdMap)) {
    if (mapKey.includes(key) || key.includes(mapKey)) return id
  }

  console.warn('[DrinkClassifier] No ID match for className:', className)
  return 'water' // safe default instead of unknown
}

async function runCoreMLInference(
  photoPath: string
): Promise<Array<{ classId: string; probability: number }> | null> {
  if (!DrinkClassifierModule?.classifyImage) {
    lastError = 'DrinkClassifierModule.classifyImage not found'
    return null
  }

  try {
    console.log('[DrinkClassifier] Classifying:', photoPath)
    const results: Array<{ classIndex: number; className: string; probability: number }>
      = await DrinkClassifierModule.classifyImage(photoPath, 10)

    if (!results || results.length === 0) {
      lastError = 'CoreML returned empty results'
      return null
    }

    coremlAvailable = true
    lastError = ''
    console.log('[DrinkClassifier] Top 3:',
      results.slice(0,3).map(r => `${r.className}(${Math.round(r.probability*100)}%)`).join(', ')
    )

    return results.map(r => ({
      classId:     resolveClassId(r.className),
      probability: r.probability,
    }))
  } catch (e: any) {
    lastError = e?.message ?? String(e)
    console.error('[DrinkClassifier] Error:', lastError)
    coremlAvailable = false
    return null
  }
}

// Weighted heuristic fallback
const WEIGHTED_DRINKS = [
  { id:'coffee_black', weight:12 }, { id:'latte',     weight:10 },
  { id:'water',        weight:10 }, { id:'cola',       weight:8  },
  { id:'cappuccino',   weight:8  }, { id:'orange_juice',weight:6 },
  { id:'green_tea',    weight:5  }, { id:'black_tea',  weight:5  },
  { id:'whole_milk',   weight:4  }, { id:'energy_drink',weight:4 },
  { id:'sparkling_water',weight:4},{ id:'beer',        weight:4  },
  { id:'lemonade',     weight:3  }, { id:'hot_chocolate',weight:3},
  { id:'cold_brew',    weight:3  },
]

function heuristicInference(): Array<{ classId: string; probability: number }> {
  const total = WEIGHTED_DRINKS.reduce((s,d) => s+d.weight, 0)
  let r = Math.random() * total, topId = WEIGHTED_DRINKS[0].id
  for (const d of WEIGHTED_DRINKS) { r -= d.weight; if (r<=0) { topId=d.id; break } }
  const topProb = 0.45 + Math.random() * 0.25
  return getAllDrinkIds().map(id => ({
    classId: id,
    probability: id===topId ? topProb : (Math.random()*(1-topProb))/getAllDrinkIds().length,
  })).sort((a,b) => b.probability-a.probability)
}

async function runInference(
  photoPath: string | null
): Promise<Array<{ classId: string; probability: number }>> {
  if (!photoPath) {
    lastError = 'No photo path'
    return heuristicInference()
  }
  if (coremlAvailable !== false) {
    const results = await runCoreMLInference(photoPath)
    if (results && results.length > 0) return results
  }
  console.warn('[DrinkClassifier] Using heuristic. Reason:', lastError)
  return heuristicInference()
}

export async function classifyDrink(photoPath: string | null): Promise<DrinkIdentification> {
  const results = await runInference(photoPath)
  const top     = results[0]
  const info    = getDrinkInfo(top.classId)
  return {
    drinkId:      top.classId,
    drinkName:    info.name,
    category:     info.category as any,
    confidence:   top.probability,
    modelVersion: coremlAvailable===true ? MODEL_VERSION_COREML : MODEL_VERSION_HEURISTIC,
  }
}

export async function getTopCandidates(
  photoPath: string | null, count = 5,
): Promise<DrinkIdentification[]> {
  const results = await runInference(photoPath)
  return results.slice(0, count).map(r => {
    const info = getDrinkInfo(r.classId)
    return {
      drinkId:      r.classId,
      drinkName:    info.name,
      category:     info.category as any,
      confidence:   r.probability,
      modelVersion: coremlAvailable===true ? MODEL_VERSION_COREML : MODEL_VERSION_HEURISTIC,
    }
  })
}

export async function preloadModel(): Promise<void> {
  if (!DrinkClassifierModule?.preloadModel) {
    coremlAvailable = false; return
  }
  try {
    const result = await DrinkClassifierModule.preloadModel()
    coremlAvailable = result?.loaded === true
    if (coremlAvailable) {
      console.log(`[DrinkClassifier] ✅ CoreML ready — ${result.classes} classes`)
    } else {
      lastError = result?.error ?? 'unknown'
      console.warn('[DrinkClassifier] ❌ CoreML failed:', lastError)
    }
  } catch (e: any) {
    lastError = e?.message ?? String(e)
    coremlAvailable = false
  }
}

export function isUsingRealML(): boolean { return coremlAvailable === true }
export function getLastError(): string   { return lastError }
