/**
 * frameExtractor.ts
 * Bridges to FrameExtractorModule.swift
 *
 * Extracts the sharpest frame from the recorded video.
 * The native module uses Laplacian variance to pick the
 * best (sharpest, least blurry) frame from 7 samples.
 */

import { NativeModules } from 'react-native'

const { FrameExtractorModule } = NativeModules

/**
 * Extract the best (sharpest) frame from a video file.
 * Returns the local file path to a JPEG image.
 */
export async function extractBestFrame(videoPath: string): Promise<string | null> {
  if (!FrameExtractorModule?.extractBestFrame) {
    console.warn('[FrameExtractor] Native module not available')
    return null
  }

  try {
    const framePath: string = await FrameExtractorModule.extractBestFrame(videoPath)
    return framePath
  } catch (e) {
    console.error('[FrameExtractor] Failed to extract frame:', e)
    return null
  }
}
