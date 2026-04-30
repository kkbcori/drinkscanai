import { NativeModules } from 'react-native'
const { FrameExtractorModule } = NativeModules
export async function extractBestFrame(videoPath: string): Promise<string|null> {
  if (!FrameExtractorModule?.extractBestFrame) return null
  try { return await FrameExtractorModule.extractBestFrame(videoPath) }
  catch(e) { console.error('[FrameExtractor]',e); return null }
}
