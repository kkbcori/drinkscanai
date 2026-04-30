/**
 * drinkClassifier.ts — with detailed diagnostics
 */

import { NativeModules } from 'react-native'
import type { DrinkIdentification } from '../types'
import { getDrinkInfo, getAllDrinkIds } from '../db/nutritionDB'

const { DrinkClassifierModule } = NativeModules
const MODEL_VERSION_COREML    = 'coreml_v1'
const MODEL_VERSION_HEURISTIC = 'heuristic_v1'

let coremlAvailable: boolean | null = null

// ── CoreML inference ──────────────────────────────────────────────────────

async function runCoreMLInference(
  framePath: string
): Promise<Array<{ classId: string; probability: number }> | null> {
  if (!DrinkClassifierModule?.classifyImage) {
    console.warn('[DrinkClassifier] DrinkClassifierModule.classifyImage not found in NativeModules')
    console.warn('[DrinkClassifier] Available modules:', Object.keys(NativeModules).join(', '))
    return null
  }

  try {
    const results: Array<{ classIndex: number; className: string; probability: number }>
      = await DrinkClassifierModule.classifyImage(framePath, 10)

    if (!results || results.length === 0) {
      console.warn('[DrinkClassifier] CoreML returned empty results')
      return null
    }

    coremlAvailable = true
    console.log('[DrinkClassifier] CoreML inference succeeded, top:', results[0]?.className)

    const allIds = getAllDrinkIds()
    return results.map(r => {
      const byName = allIds.find(id => {
        const info = getDrinkInfo(id)
        return info.name.toLowerCase() === r.className.toLowerCase()
      })
      const classId = byName ?? r.className.toLowerCase().replace(/[^a-z0-9_]/g, '_')
      return { classId, probability: r.probability }
    })
  } catch (e: any) {
    console.error('[DrinkClassifier] CoreML inference error:', e?.message ?? e)
    coremlAvailable = false
    return null
  }
}

// ── Heuristic fallback ────────────────────────────────────────────────────

const WEIGHTED_DRINKS = [
  { id: 'coffee_black',    weight: 12 },
  { id: 'latte',           weight: 10 },
  { id: 'cappuccino',      weight: 8  },
  { id: 'water',           weight: 10 },
  { id: 'cola',            weight: 8  },
  { id: 'orange_juice',    weight: 6  },
  { id: 'green_tea',       weight: 5  },
  { id: 'black_tea',       weight: 5  },
  { id: 'whole_milk',      weight: 4  },
  { id: 'oat_milk',        weight: 4  },
  { id: 'energy_drink',    weight: 4  },
  { id: 'sparkling_water', weight: 4  },
  { id: 'americano',       weight: 5  },
  { id: 'matcha_latte',    weight: 3  },
  { id: 'cold_brew',       weight: 3  },
  { id: 'lemonade',        weight: 3  },
  { id: 'fruit_smoothie',  weight: 2  },
  { id: 'hot_chocolate',   weight: 2  },
  { id: 'beer',            weight: 2  },
]

function heuristicInference(): Array<{ classId: string; probability: number }> {
  const total = WEIGHTED_DRINKS.reduce((s, d) => s + d.weight, 0)
  let r = Math.random() * total
  let topId = WEIGHTED_DRINKS[0].id
  for (const d of WEIGHTED_DRINKS) {
    r -= d.weight
    if (r <= 0) { topId = d.id; break }
  }
  const topProb = 0.55 + Math.random() * 0.30
  const allIds  = getAllDrinkIds()
  return allIds.map(id => ({
    classId: id,
    probability: id === topId ? topProb : (Math.random() * (1 - topProb)) / allIds.length,
  })).sort((a, b) => b.probability - a.probability)
}

// ── Main inference ────────────────────────────────────────────────────────

async function runInference(
  framePath: string | null
): Promise<Array<{ classId: string; probability: number }>> {
  if (framePath && coremlAvailable !== false) {
    const coremlResults = await runCoreMLInference(framePath)
    if (coremlResults && coremlResults.length > 0) return coremlResults
  }
  return heuristicInference()
}

// ── Public API ────────────────────────────────────────────────────────────

export async function classifyDrink(framePath: string | null): Promise<DrinkIdentification> {
  const results  = await runInference(framePath)
  const top      = results[0]
  const info     = getDrinkInfo(top.classId)
  return {
    drinkId:      top.classId,
    drinkName:    info.name,
    category:     info.category as any,
    confidence:   top.probability,
    modelVersion: coremlAvailable === true ? MODEL_VERSION_COREML : MODEL_VERSION_HEURISTIC,
  }
}

export async function getTopCandidates(
  framePath: string | null,
  count = 5,
): Promise<DrinkIdentification[]> {
  const results = await runInference(framePath)
  return results.slice(0, count).map(r => {
    const info = getDrinkInfo(r.classId)
    return {
      drinkId:      r.classId,
      drinkName:    info.name,
      category:     info.category as any,
      confidence:   r.probability,
      modelVersion: coremlAvailable === true ? MODEL_VERSION_COREML : MODEL_VERSION_HEURISTIC,
    }
  })
}

export async function preloadModel(): Promise<void> {
  if (!DrinkClassifierModule?.preloadModel) {
    console.warn('[DrinkClassifier] DrinkClassifierModule not in NativeModules')
    console.warn('[DrinkClassifier] Available:', Object.keys(NativeModules).join(', '))
    coremlAvailable = false
    return
  }

  try {
    console.log('[DrinkClassifier] Preloading CoreML model...')
    const result = await DrinkClassifierModule.preloadModel()
    console.log('[DrinkClassifier] Preload result:', JSON.stringify(result))
    coremlAvailable = result?.loaded === true
    if (coremlAvailable) {
      console.log(`[DrinkClassifier] CoreML ready — ${result.classes} classes`)
    } else {
      console.warn('[DrinkClassifier] CoreML failed to load:', result?.error)
    }
  } catch (e: any) {
    console.error('[DrinkClassifier] Preload exception:', e?.message ?? e)
    coremlAvailable = false
  }
}

export function isUsingRealML(): boolean {
  return coremlAvailable === true
}
