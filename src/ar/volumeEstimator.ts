/**
 * volumeEstimator.ts
 * Bridges to VolumeEstimatorModule.swift (Vision framework)
 *
 * The native module:
 * - Extracts 5 frames from the recorded video
 * - Detects cup boundaries using Vision rectangle detection
 * - Measures aspect ratio to classify cup type
 * - Detects liquid surface via color gradient analysis
 * - Returns volume + fill level estimates
 */

import { NativeModules } from 'react-native'
import type { VolumeEstimate } from '../types'

const { VolumeEstimatorModule } = NativeModules

type NativeVolumeResult = {
  success: boolean
  totalVolumeMl: number
  fillLevelPct: number
  liquidVolumeMl: number
  cupType: string
  method: string
}

export async function estimateVolume(videoPath: string): Promise<VolumeEstimate> {
  if (!VolumeEstimatorModule?.estimateVolume) {
    console.warn('[VolumeEstimator] Native module not available, using fallback')
    return fallback()
  }

  try {
    const result: NativeVolumeResult = await VolumeEstimatorModule.estimateVolume(videoPath)

    if (!result.success) {
      console.warn('[VolumeEstimator] Estimation failed, using fallback:', result.method)
      return fallback()
    }

    return {
      totalVolumeMl:  result.totalVolumeMl,
      fillLevelPct:   result.fillLevelPct,
      liquidVolumeMl: result.liquidVolumeMl,
      method:         'vision',
    }
  } catch (e) {
    console.error('[VolumeEstimator] Error:', e)
    return fallback()
  }
}

function fallback(): VolumeEstimate {
  return {
    totalVolumeMl:  354,
    fillLevelPct:   80,
    liquidVolumeMl: 283,
    method:         'fallback',
  }
}
