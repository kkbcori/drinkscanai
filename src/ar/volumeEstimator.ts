import { NativeModules } from 'react-native'
import type { VolumeEstimate } from '../types'
const { VolumeEstimatorModule } = NativeModules
const SIZES = [{ml:60,fw:.8},{ml:240,fw:.7},{ml:354,fw:.5},{ml:473,fw:.3},{ml:591,fw:.1}]
function fallback(): VolumeEstimate {
  let r = Math.random(), cup = SIZES[2]
  for (const s of SIZES) { r-=s.fw; if(r<=0){cup=s;break} }
  const fill = 55 + Math.round(Math.random()*35)
  return { totalVolumeMl:cup.ml, fillLevelPct:fill, liquidVolumeMl:Math.round(cup.ml*fill/100), method:'fallback' }
}
export async function estimateVolume(videoPath: string): Promise<VolumeEstimate> {
  if (!VolumeEstimatorModule?.estimateVolume) return fallback()
  try {
    const r:any = await VolumeEstimatorModule.estimateVolume(videoPath)
    if (!r?.success) return fallback()
    return { totalVolumeMl:r.totalVolumeMl, fillLevelPct:r.fillLevelPct, liquidVolumeMl:r.liquidVolumeMl, method:r.method??'vision' }
  } catch { return fallback() }
}
