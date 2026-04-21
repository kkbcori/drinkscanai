/**
 * Volume Estimator
 * 
 * Bridges to the native ARKit Swift module (ARScanModule.swift)
 * which uses iPhone motion sensors + camera to estimate cup volume.
 * 
 * The ARKit module uses VIO (Visual-Inertial Odometry) to establish
 * real-world scale from phone motion, then raycasting to measure
 * the cup dimensions in millimeters.
 * 
 * Falls back to standard cup size estimates if ARKit fails.
 */

import { NativeModules } from 'react-native'
import type { VolumeEstimate } from '../types'

const { ARScanModule } = NativeModules

// Standard cup sizes as fallback (in ml)
const STANDARD_SIZES = {
  small:  240,  // 8oz
  medium: 354,  // 12oz
  large:  473,  // 16oz
  xlarge: 591,  // 20oz
}

type ARMeasurement = {
  totalVolumeMl: number
  fillLevelPct: number
  success: boolean
  error?: string
}

export async function estimateVolume(videoPath: string): Promise<VolumeEstimate> {
  // Try ARKit first
  if (ARScanModule?.estimateVolume) {
    try {
      const result: ARMeasurement = await ARScanModule.estimateVolume(videoPath)

      if (result.success && result.totalVolumeMl > 0) {
        const fillDecimal = result.fillLevelPct / 100
        return {
          totalVolumeMl:  result.totalVolumeMl,
          fillLevelPct:   result.fillLevelPct,
          liquidVolumeMl: Math.round(result.totalVolumeMl * fillDecimal),
          method: 'arkit',
        }
      }
    } catch (e) {
      console.warn('ARKit volume estimation failed, using fallback:', e)
    }
  }

  // Fallback: use medium cup size with 80% fill estimate
  const totalVolumeMl  = STANDARD_SIZES.medium
  const fillLevelPct   = 80
  const liquidVolumeMl = Math.round(totalVolumeMl * (fillLevelPct / 100))

  return {
    totalVolumeMl,
    fillLevelPct,
    liquidVolumeMl,
    method: 'fallback',
  }
}
