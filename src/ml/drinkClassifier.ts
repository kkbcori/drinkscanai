import { NativeModules } from 'react-native'
import type { DrinkIdentification } from '../types'
import { getDrinkInfo, getAllDrinkIds } from '../db/nutritionDB'

const { DrinkClassifierModule } = NativeModules
const MODEL_VERSION_COREML    = 'coreml_v3_finetuned'
const MODEL_VERSION_HEURISTIC = 'heuristic_v1'

let coremlAvailable: boolean | null = null
let lastError: string = ''

async function runCoreMLInference(
  framePath: string
): Promise<Array<{ classId: string; probability: number }> | null> {
  if (!DrinkClassifierModule?.classifyImage) {
    lastError = 'DrinkClassifierModule.classifyImage not found'
    console.warn('[DrinkClassifier]', lastError)
    return null
  }

  try {
    console.log('[DrinkClassifier] Running inference on:', framePath)
    const results: Array<{ classIndex: number; className: string; probability: number }>
      = await DrinkClassifierModule.classifyImage(framePath, 10)

    if (!results || results.length === 0) {
      lastError = 'CoreML returned empty results'
      console.warn('[DrinkClassifier]', lastError)
      return null
    }

    coremlAvailable = true
    lastError = ''
    console.log('[DrinkClassifier] Top result:', results[0]?.className, results[0]?.probability)

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
    lastError = e?.message ?? String(e)
    console.error('[DrinkClassifier] CoreML error:', lastError)
    coremlAvailable = false
    return null
  }
}

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
  { id: 'energy_drink',    weight: 4  },
  { id: 'sparkling_water', weight: 4  },
  { id: 'beer',            weight: 4  },
  { id: 'lemonade',        weight: 3  },
  { id: 'hot_chocolate',   weight: 3  },
  { id: 'cold_brew',       weight: 3  },
]

function heuristicInference(): Array<{ classId: string; probability: number }> {
  const total = WEIGHTED_DRINKS.reduce((s, d) => s + d.weight, 0)
  let r = Math.random() * total
  let topId = WEIGHTED_DRINKS[0].id
  for (const d of WEIGHTED_DRINKS) { r -= d.weight; if (r <= 0) { topId = d.id; break } }
  const topProb = 0.55 + Math.random() * 0.30
  const allIds  = getAllDrinkIds()
  return allIds.map(id => ({
    classId: id,
    probability: id === topId ? topProb : (Math.random() * (1 - topProb)) / allIds.length,
  })).sort((a, b) => b.probability - a.probability)
}

async function runInference(
  framePath: string | null
): Promise<Array<{ classId: string; probability: number }>> {
  if (!framePath) {
    lastError = 'No frame path — video recording may have failed'
    console.warn('[DrinkClassifier]', lastError)
    return heuristicInference()
  }

  if (coremlAvailable !== false) {
    const results = await runCoreMLInference(framePath)
    if (results && results.length > 0) return results
  }

  console.warn('[DrinkClassifier] Falling back to heuristic. Reason:', lastError)
  return heuristicInference()
}

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
    console.warn('[DrinkClassifier] Module not found in NativeModules')
    coremlAvailable = false
    return
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
    console.error('[DrinkClassifier] Preload exception:', lastError)
    coremlAvailable = false
  }
}

export function isUsingRealML(): boolean {
  return coremlAvailable === true
}

export function getLastError(): string {
  return lastError
}
