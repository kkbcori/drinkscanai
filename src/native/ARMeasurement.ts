import { NativeModules, NativeEventEmitter, Platform } from 'react-native'

const { ARScanModule } = NativeModules

if (!ARScanModule) {
  throw new Error(
    'ARScanModule not found. Make sure you have run `pod install` ' +
    'and rebuilt the native iOS project.'
  )
}

const emitter = new NativeEventEmitter(ARScanModule)

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CupMeasurement {
  height_mm: number
  diameter_mm: number
  volume_ml: number
  confidence: 'high' | 'medium' | 'low'
}

export interface ScanCallbacks {
  onProgress?: (progress: number) => void   // 0.0 → 1.0
  onReady?: () => void                       // world map is good enough
  onMeasurement?: (result: CupMeasurement) => void
  onError?: (message: string) => void
}

// ─── ARMeasurement API ───────────────────────────────────────────────────────

export const ARMeasurement = {

  /**
   * Start the AR scan session.
   * Opens the full-screen AR camera view.
   * The user moves the phone around the cup for ~5–10 seconds.
   */
  startScan(): Promise<void> {
    return ARScanModule.startScan()
  },

  /**
   * Switch from scan mode to tap-to-measure mode.
   * Resolves with {height_mm, diameter_mm, volume_ml, confidence}
   * after the user has tapped 3 measurement points.
   *
   * Call this after receiving the onScanReady event.
   */
  beginMeasuring(): Promise<CupMeasurement> {
    return ARScanModule.beginMeasuring()
  },

  /**
   * Dismiss the AR view and clean up the session.
   */
  dismiss(): void {
    ARScanModule.dismissScan()
  },

  /**
   * Subscribe to AR events.
   * Returns an unsubscribe function — call it in your useEffect cleanup.
   *
   * Usage:
   *   const unsub = ARMeasurement.subscribe({
   *     onProgress: p => setProgress(p),
   *     onReady: () => setIsReady(true),
   *     onMeasurement: r => handleResult(r),
   *     onError: e => showError(e),
   *   })
   *   return () => unsub()
   */
  subscribe(callbacks: ScanCallbacks): () => void {
    const subs = [
      callbacks.onProgress &&
        emitter.addListener('onScanProgress', e => callbacks.onProgress!(e.progress)),
      callbacks.onReady &&
        emitter.addListener('onScanReady', () => callbacks.onReady!()),
      callbacks.onMeasurement &&
        emitter.addListener('onMeasurement', e => callbacks.onMeasurement!(e as CupMeasurement)),
      callbacks.onError &&
        emitter.addListener('onScanError', e => callbacks.onError!(e.message)),
    ].filter(Boolean)

    return () => subs.forEach(s => s?.remove())
  },

  /**
   * Check if AR scanning is supported on this device.
   * Returns false on Android (iOS only in v1).
   */
  isSupported(): boolean {
    return Platform.OS === 'ios'
  },
}
