/**
 * DrinkClassifier — Heuristic placeholder
 * Rotates through realistic drink predictions per scan.
 * ONNX/CoreML real inference coming in next phase.
 */

import type { DrinkIdentification } from '../types'
import { getDrinkInfo, getAllDrinkIds } from '../db/nutritionDB'

const MODEL_VERSION = 'heuristic_v1'

// Common drinks weighted by real-world frequency
const WEIGHTED_DRINKS = [
  { id: 'coffee_black',   weight: 12 },
  { id: 'latte',          weight: 10 },
  { id: 'cappuccino',     weight: 8  },
  { id: 'water',          weight: 10 },
  { id: 'cola',           weight: 8  },
  { id: 'orange_juice',   weight: 6  },
  { id: 'green_tea',      weight: 5  },
  { id: 'black_tea',      weight: 5  },
  { id: 'whole_milk',     weight: 4  },
  { id: 'oat_milk',       weight: 4  },
  { id: 'energy_drink',   weight: 4  },
  { id: 'sparkling_water',weight: 4  },
  { id: 'americano',      weight: 5  },
  { id: 'matcha_latte',   weight: 3  },
  { id: 'chai_latte',     weight: 3  },
  { id: 'cold_brew',      weight: 3  },
  { id: 'lemonade',       weight: 3  },
  { id: 'fruit_smoothie', weight: 2  },
  { id: 'hot_chocolate',  weight: 2  },
  { id: 'beer',           weight: 2  },
]

function weightedRandom(): string {
  const total = WEIGHTED_DRINKS.reduce((s, d) => s + d.weight, 0)
  let r = Math.random() * total
  for (const d of WEIGHTED_DRINKS) {
    r -= d.weight
    if (r <= 0) return d.id
  }
  return WEIGHTED_DRINKS[0].id
}

async function runInference(_framePath: string | null) {
  // Pick top prediction using weighted random
  const topId = weightedRandom()

  // Build probability distribution: top gets 0.55-0.85, rest share remainder
  const allIds = getAllDrinkIds()
  const topProb = 0.55 + Math.random() * 0.30  // 0.55–0.85

  return allIds.map(id => ({
    classId: id,
    probability: id === topId
      ? topProb
      : (Math.random() * (1 - topProb)) / allIds.length,
  })).sort((a, b) => b.probability - a.probability)
}

export async function classifyDrink(framePath: string | null): Promise<DrinkIdentification> {
  const results = await runInference(framePath)
  const top = results[0]
  const info = getDrinkInfo(top.classId)
  return {
    drinkId:      top.classId,
    drinkName:    info.name,
    category:     info.category as any,
    confidence:   top.probability,
    modelVersion: MODEL_VERSION,
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
      modelVersion: MODEL_VERSION,
    }
  })
}

export async function preloadModel(): Promise<void> {
  console.log('[DrinkClassifier] Weighted heuristic ready — CoreML integration pending')
}
