import { NativeModules } from 'react-native'
import type { DrinkIdentification } from '../types'
import { getDrinkInfo, getAllDrinkIds } from '../db/nutritionDB'

const { DrinkClassifierModule } = NativeModules
const MODEL_VERSION_COREML    = 'coreml_v3_finetuned'
const MODEL_VERSION_HEURISTIC = 'heuristic_v1'

let coremlAvailable: boolean | null = null
let lastError = ''

// ── Exact index→ID map matching drink_classifier.pt training order ────────
// Must match the order in tools/out/drink_classifier.pt exactly
const INDEX_TO_ID: Record<number, string> = {
  0:  'espresso',
  1:  'latte',
  2:  'cappuccino',
  3:  'coffee_black',
  4:  'iced_coffee',
  5:  'cold_brew',
  6:  'black_tea',
  7:  'green_tea',
  8:  'matcha_latte',
  9:  'chai_latte',
  10: 'herbal_tea',
  11: 'iced_tea',
  12: 'bubble_tea',
  13: 'orange_juice',
  14: 'apple_juice',
  15: 'lemonade',
  16: 'tomato_juice',
  17: 'fruit_smoothie',
  18: 'green_smoothie',
  19: 'whole_milk',
  20: 'chocolate_milk',
  21: 'oat_milk',
  22: 'protein_shake',
  23: 'milkshake',
  24: 'cola',
  25: 'diet_cola',
  26: 'lemon_lime_soda',
  27: 'energy_drink',
  28: 'sports_drink',
  29: 'water',
  30: 'sparkling_water',
  31: 'coconut_water',
  32: 'beer',
  33: 'wine_red',
  34: 'wine_white',
  35: 'cocktail',
  36: 'hot_chocolate',
  37: 'kombucha',
}

// ── CoreML inference ──────────────────────────────────────────────────────

async function runCoreMLInference(
  photoPath: string
): Promise<Array<{ classId: string; probability: number }> | null> {
  if (!DrinkClassifierModule?.classifyImage) {
    lastError = 'DrinkClassifierModule not found'
    return null
  }
  try {
    const results: Array<{ classIndex: number; className: string; probability: number }>
      = await DrinkClassifierModule.classifyImage(photoPath, 10)

    if (!results || results.length === 0) {
      lastError = 'CoreML returned empty results'
      return null
    }

    coremlAvailable = true
    lastError = ''

    console.log('[DrinkClassifier] Top 3:',
      results.slice(0,3).map(r =>
        `${INDEX_TO_ID[r.classIndex] ?? r.className}(${Math.round(r.probability*100)}%)`
      ).join(', ')
    )

    return results.map(r => ({
      // Use index map first (reliable), fall back to name matching
      classId:     INDEX_TO_ID[r.classIndex] ?? nameToId(r.className),
      probability: r.probability,
    }))
  } catch (e: any) {
    lastError = e?.message ?? String(e)
    console.error('[DrinkClassifier] Error:', lastError)
    coremlAvailable = false
    return null
  }
}

// Fallback name matcher for edge cases
function nameToId(name: string): string {
  const n = name.toLowerCase().replace(/[\s-]+/g, '_')
  const all = getAllDrinkIds()
  // Exact ID match
  if (all.includes(n)) return n
  // Name match
  for (const id of all) {
    if (getDrinkInfo(id).name.toLowerCase() === name.toLowerCase()) return id
  }
  // Partial match
  for (const id of all) {
    if (id.includes(n) || n.includes(id)) return id
  }
  console.warn('[DrinkClassifier] No ID match for:', name)
  return 'water'
}

// ── Heuristic fallback ─────────────────────────────────────────────────────

const WEIGHTED_DRINKS = [
  { id:'coffee_black', weight:12 }, { id:'latte',        weight:10 },
  { id:'water',        weight:10 }, { id:'cola',          weight:8  },
  { id:'cappuccino',   weight:8  }, { id:'orange_juice',  weight:6  },
  { id:'green_tea',    weight:5  }, { id:'black_tea',     weight:5  },
  { id:'whole_milk',   weight:4  }, { id:'energy_drink',  weight:4  },
  { id:'beer',         weight:4  }, { id:'lemonade',      weight:3  },
  { id:'hot_chocolate',weight:3  }, { id:'cold_brew',     weight:3  },
]

function heuristicInference(): Array<{ classId: string; probability: number }> {
  const total = WEIGHTED_DRINKS.reduce((s,d) => s+d.weight, 0)
  let r = Math.random()*total, topId = WEIGHTED_DRINKS[0].id
  for (const d of WEIGHTED_DRINKS) { r-=d.weight; if(r<=0){topId=d.id;break} }
  const topProb = 0.45 + Math.random()*0.25
  return getAllDrinkIds().map(id => ({
    classId: id,
    probability: id===topId ? topProb : (Math.random()*(1-topProb))/getAllDrinkIds().length,
  })).sort((a,b) => b.probability-a.probability)
}

// ── Main inference ─────────────────────────────────────────────────────────

async function runInference(
  photoPath: string | null
): Promise<Array<{ classId: string; probability: number }>> {
  if (!photoPath) {
    lastError = 'No photo path'
    return heuristicInference()
  }
  if (coremlAvailable !== false) {
    const results = await runCoreMLInference(photoPath)
    if (results?.length) return results
  }
  console.warn('[DrinkClassifier] Using heuristic. Reason:', lastError)
  return heuristicInference()
}

// ── Public API ─────────────────────────────────────────────────────────────

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
      drinkId: r.classId, drinkName: info.name,
      category: info.category as any, confidence: r.probability,
      modelVersion: coremlAvailable===true ? MODEL_VERSION_COREML : MODEL_VERSION_HEURISTIC,
    }
  })
}

export async function preloadModel(): Promise<void> {
  if (!DrinkClassifierModule?.preloadModel) {
    coremlAvailable = false; return
  }
  try {
    const r = await DrinkClassifierModule.preloadModel()
    coremlAvailable = r?.loaded === true
    if (coremlAvailable) {
      console.log(`[DrinkClassifier] ✅ Ready — ${r.classes} classes`)
    } else {
      lastError = r?.error ?? 'unknown'
      console.warn('[DrinkClassifier] ❌ Failed:', lastError)
    }
  } catch (e: any) {
    lastError = e?.message ?? String(e)
    coremlAvailable = false
  }
}

export function isUsingRealML(): boolean { return coremlAvailable === true }
export function getLastError(): string   { return lastError }
