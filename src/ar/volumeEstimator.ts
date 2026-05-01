import { NativeModules } from 'react-native'
import type { VolumeEstimate } from '../types'

const { VolumeEstimatorModule } = NativeModules

const SIZES = [
  { ml: 60,  fw: 0.6 },  // espresso shot
  { ml: 240, fw: 0.8 },  // small cup
  { ml: 354, fw: 0.5 },  // 12oz
  { ml: 473, fw: 0.3 },  // 16oz
  { ml: 591, fw: 0.1 },  // 20oz
]

function fallback(): VolumeEstimate {
  let r = Math.random()
  let cup = SIZES[2]
  for (const s of SIZES) { r -= s.fw; if (r <= 0) { cup = s; break } }
  const fill = 55 + Math.round(Math.random() * 35)
  return {
    totalVolumeMl:  cup.ml,
    fillLevelPct:   fill,
    liquidVolumeMl: Math.round(cup.ml * fill / 100),
    method:         'fallback',
  }
}

// Works on a single photo — no video needed
export async function estimateVolumeFromPhoto(photoPath: string): Promise<VolumeEstimate> {
  if (!VolumeEstimatorModule?.estimateVolumeFromPhoto &&
      !VolumeEstimatorModule?.estimateVolume) {
    return fallback()
  }

  try {
    const fn = VolumeEstimatorModule.estimateVolumeFromPhoto
               ?? VolumeEstimatorModule.estimateVolume
    const r: any = await fn(photoPath)
    if (!r?.success) return fallback()
    return {
      totalVolumeMl:  r.totalVolumeMl,
      fillLevelPct:   r.fillLevelPct,
      liquidVolumeMl: r.liquidVolumeMl,
      method:         r.method ?? 'vision',
    }
  } catch {
    return fallback()
  }
}

// Keep old video function for backward compatibility
export async function estimateVolume(videoPath: string): Promise<VolumeEstimate> {
  return estimateVolumeFromPhoto(videoPath)
}
