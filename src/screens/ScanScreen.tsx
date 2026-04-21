import React, { useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native'
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useVideoRecording,
} from 'react-native-vision-camera'

type ScanResult = {
  drink: string
  volume: number
  fillLevel: number
  calories: number
  caffeine: number
  confidence: number
}

type ScanState = 'idle' | 'permission' | 'scanning' | 'analyzing' | 'result'

export default function ScanScreen() {
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [countdown, setCountdown] = useState(0)

  const device = useCameraDevice('back')
  const { hasPermission, requestPermission } = useCameraPermission()
  const cameraRef = useRef<Camera>(null)

  const handleRequestPermission = useCallback(async () => {
    setScanState('permission')
    const granted = await requestPermission()
    setScanState(granted ? 'idle' : 'idle')
  }, [requestPermission])

  const startScan = useCallback(async () => {
    if (!hasPermission) {
      await handleRequestPermission()
      return
    }
    if (!cameraRef.current || !device) return

    setScanState('scanning')
    setResult(null)

    // 5-second countdown while recording
    let count = 5
    setCountdown(count)
    const timer = setInterval(() => {
      count -= 1
      setCountdown(count)
      if (count === 0) clearInterval(timer)
    }, 1000)

    try {
      // Start video recording
      cameraRef.current.startRecording({
        onRecordingFinished: async (video) => {
          setScanState('analyzing')
          // TODO: Pass video.path to ARKit for volume estimation
          // TODO: Pass video frames to ML model for drink identification
          // For now simulate analysis with realistic delay
          await new Promise(r => setTimeout(r, 2000))

          // Placeholder result — real ML + AR results will replace this
          setResult({
            drink: 'Coffee (Black)',
            volume: 354,
            fillLevel: 82,
            calories: 5,
            caffeine: 95,
            confidence: 0.91,
          })
          setScanState('result')
        },
        onRecordingError: (error) => {
          console.error('Recording error:', error)
          setScanState('idle')
        },
      })

      // Stop recording after 5 seconds
      setTimeout(async () => {
        try {
          await cameraRef.current?.stopRecording()
        } catch (e) {
          console.error('Stop recording error:', e)
        }
      }, 5000)
    } catch (e) {
      console.error('Start recording error:', e)
      setScanState('idle')
    }
  }, [hasPermission, device, handleRequestPermission])

  const reset = useCallback(() => {
    setResult(null)
    setScanState('idle')
    setCountdown(0)
  }, [])

  // No camera permission yet
  if (!hasPermission) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emoji}>📷</Text>
        <Text style={styles.title}>Camera Access Needed</Text>
        <Text style={styles.subtitle}>
          DrinkScanAI needs camera access to scan your drink
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleRequestPermission}>
          <Text style={styles.buttonText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // No back camera found
  if (!device) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emoji}>⚠️</Text>
        <Text style={styles.title}>Camera Not Found</Text>
        <Text style={styles.subtitle}>Could not access the rear camera</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Camera Preview */}
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={scanState !== 'analyzing'}
        video={true}
        audio={false}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Scanning frame guide */}
        <View style={styles.frameGuide}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
          {scanState === 'scanning' && countdown > 0 && (
            <Text style={styles.countdown}>{countdown}</Text>
          )}
        </View>

        {/* Instruction */}
        <View style={styles.instructionBox}>
          {scanState === 'idle' && (
            <Text style={styles.instruction}>
              Point camera at your drink cup and tap Scan
            </Text>
          )}
          {scanState === 'scanning' && (
            <Text style={styles.instruction}>
              Hold steady — scanning for {countdown}s...
            </Text>
          )}
          {scanState === 'analyzing' && (
            <Text style={styles.instruction}>Analyzing your drink...</Text>
          )}
        </View>

        {/* Analyzing spinner */}
        {scanState === 'analyzing' && (
          <View style={styles.analyzingBox}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.analyzingText}>Measuring cup & identifying drink</Text>
          </View>
        )}

        {/* Result card */}
        {scanState === 'result' && result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultDrink}>{result.drink}</Text>
            <Text style={styles.confidenceBadge}>
              {Math.round(result.confidence * 100)}% confident
            </Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{result.volume}ml</Text>
                <Text style={styles.statLabel}>Volume</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{result.fillLevel}%</Text>
                <Text style={styles.statLabel}>Fill Level</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{result.calories}</Text>
                <Text style={styles.statLabel}>Calories</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{result.caffeine}mg</Text>
                <Text style={styles.statLabel}>Caffeine</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.resetButton} onPress={reset}>
              <Text style={styles.resetButtonText}>Scan Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Scan button */}
        {(scanState === 'idle') && (
          <TouchableOpacity style={styles.scanButton} onPress={startScan}>
            <View style={styles.scanButtonInner} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  centerContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, backgroundColor: '#f5f5f5',
  },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 32, textAlign: 'center', lineHeight: 24 },
  button: {
    backgroundColor: '#007AFF', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12,
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingBottom: 48,
  },
  frameGuide: {
    width: 260, height: 320, position: 'relative',
    alignItems: 'center', justifyContent: 'center',
  },
  corner: {
    position: 'absolute', width: 30, height: 30,
    borderColor: '#fff', borderWidth: 3,
  },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  countdown: {
    fontSize: 64, fontWeight: '800', color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
  },
  instructionBox: {
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 10, marginHorizontal: 32,
  },
  instruction: { color: '#fff', fontSize: 15, textAlign: 'center' },
  analyzingBox: { alignItems: 'center', gap: 12 },
  analyzingText: { color: '#fff', fontSize: 15 },
  resultCard: {
    backgroundColor: '#fff', borderRadius: 20,
    padding: 24, marginHorizontal: 16, width: '90%', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  resultDrink: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  confidenceBadge: {
    backgroundColor: '#E8F5E9', color: '#2E7D32',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
    fontSize: 13, fontWeight: '600', marginBottom: 16,
  },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  stat: { alignItems: 'center', minWidth: 60 },
  statValue: { fontSize: 20, fontWeight: '700', color: '#007AFF' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 2 },
  resetButton: {
    backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12,
  },
  resetButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  scanButton: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  scanButtonInner: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff',
  },
})
