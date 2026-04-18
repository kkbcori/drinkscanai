import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  Platform,
} from 'react-native'
import { ARMeasurement, CupMeasurement } from '../native/ARMeasurement'
import { lookupNutrition } from '../db/nutritionDB'

// ─── Scan phase states ───────────────────────────────────────────────────────
type Phase =
  | 'idle'          // before scan starts
  | 'scanning'      // AR world map building
  | 'ready'         // world map ready, waiting for user to tap "measure"
  | 'measuring'     // user tapping 3 points
  | 'processing'    // computing result
  | 'result'        // showing measurement + nutrition

// ─── ScanScreen ─────────────────────────────────────────────────────────────
export default function ScanScreen() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [scanProgress, setScanProgress] = useState(0)
  const [measurement, setMeasurement] = useState<CupMeasurement | null>(null)
  const [nutrition, setNutrition] = useState<any | null>(null)
  const [fillPercent, setFillPercent] = useState(80) // user adjustable

  const progressAnim = useRef(new Animated.Value(0)).current
  const resultAnim = useRef(new Animated.Value(0)).current

  // Subscribe to AR events
  useEffect(() => {
    const unsub = ARMeasurement.subscribe({
      onProgress: (p) => {
        setScanProgress(p)
        Animated.timing(progressAnim, {
          toValue: p,
          duration: 200,
          useNativeDriver: false,
        }).start()
      },
      onReady: () => {
        setPhase('ready')
      },
      onMeasurement: (result) => {
        setMeasurement(result)
        setPhase('processing')
        // Look up nutrition from local DB
        lookupNutrition('coffee_latte').then((n) => { // TODO: pass detected drink type
          setNutrition(n)
          setPhase('result')
          Animated.spring(resultAnim, {
            toValue: 1,
            useNativeDriver: true,
          }).start()
        })
      },
      onError: (msg) => {
        Alert.alert('Scan Error', msg, [{ text: 'OK', onPress: () => setPhase('idle') }])
        ARMeasurement.dismiss()
      },
    })
    return unsub
  }, [])

  const handleStartScan = useCallback(async () => {
    if (!ARMeasurement.isSupported()) {
      Alert.alert('AR Not Available', 'AR scanning requires iOS 11 or later.')
      return
    }
    try {
      setPhase('scanning')
      setScanProgress(0)
      await ARMeasurement.startScan()
    } catch (e: any) {
      Alert.alert('Error', e.message)
      setPhase('idle')
    }
  }, [])

  const handleBeginMeasuring = useCallback(async () => {
    try {
      setPhase('measuring')
      await ARMeasurement.beginMeasuring()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    }
  }, [])

  const handleReset = useCallback(() => {
    ARMeasurement.dismiss()
    setPhase('idle')
    setMeasurement(null)
    setNutrition(null)
    setScanProgress(0)
    resultAnim.setValue(0)
  }, [])

  // ─── Computed nutrition values
  const effectiveVolume = measurement
    ? Math.round(measurement.volume_ml * (fillPercent / 100))
    : 0

  const calories = nutrition
    ? Math.round((nutrition.calories_per_100ml / 100) * effectiveVolume)
    : 0
  const caffeine = nutrition
    ? Math.round((nutrition.caffeine_mg_per_100ml / 100) * effectiveVolume)
    : 0
  const carbs = nutrition
    ? Math.round((nutrition.carbs_g_per_100ml / 100) * effectiveVolume * 10) / 10
    : 0

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── Idle state ── */}
      {phase === 'idle' && (
        <View style={styles.center}>
          <Text style={styles.title}>Scan your drink</Text>
          <Text style={styles.subtitle}>
            Hold your phone ~30cm from the cup and slowly move{'\n'}
            around it in a half-circle arc
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleStartScan}>
            <Text style={styles.primaryBtnText}>Start AR Scan</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Scanning progress (shown as overlay while AR view is open) ── */}
      {(phase === 'scanning' || phase === 'ready') && (
        <View style={styles.progressOverlay}>
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>
              {phase === 'ready' ? 'World map ready!' : 'Building scan...'}
            </Text>

            {/* Progress bar */}
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={styles.progressPct}>{Math.round(scanProgress * 100)}%</Text>

            {phase === 'ready' && (
              <TouchableOpacity
                style={styles.measureBtn}
                onPress={handleBeginMeasuring}>
                <Text style={styles.measureBtnText}>Tap to Measure Cup →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── Measuring hint ── */}
      {phase === 'measuring' && (
        <View style={styles.progressOverlay}>
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>Follow the on-screen instructions</Text>
            <Text style={styles.subtitle}>Tap the 3 points shown on the AR view</Text>
          </View>
        </View>
      )}

      {/* ── Processing ── */}
      {phase === 'processing' && (
        <View style={styles.center}>
          <Text style={styles.title}>Calculating...</Text>
        </View>
      )}

      {/* ── Result card ── */}
      {phase === 'result' && measurement && (
        <Animated.View
          style={[
            styles.resultContainer,
            { opacity: resultAnim, transform: [{ scale: resultAnim }] },
          ]}>

          {/* Volume measurement */}
          <View style={styles.resultCard}>
            <Text style={styles.resultSectionTitle}>Cup measured</Text>
            <View style={styles.measureGrid}>
              <MeasureCell label="Height" value={`${measurement.height_mm} mm`} />
              <MeasureCell label="Diameter" value={`${measurement.diameter_mm} mm`} />
              <MeasureCell label="Full capacity" value={`${measurement.volume_ml} ml`} />
              <MeasureCell
                label="Confidence"
                value={measurement.confidence}
                accent={measurement.confidence === 'high' ? '#1D9E75' : '#BA7517'}
              />
            </View>

            {/* Fill level slider */}
            <Text style={styles.fillLabel}>How full is it?</Text>
            <View style={styles.fillRow}>
              {[25, 50, 75, 100].map(pct => (
                <TouchableOpacity
                  key={pct}
                  style={[styles.fillChip, fillPercent === pct && styles.fillChipActive]}
                  onPress={() => setFillPercent(pct)}>
                  <Text style={[
                    styles.fillChipText,
                    fillPercent === pct && styles.fillChipTextActive
                  ]}>{pct}%</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.effectiveVol}>
              Effective volume: <Text style={styles.boldText}>{effectiveVolume} ml</Text>
            </Text>
          </View>

          {/* Nutrition */}
          {nutrition && (
            <View style={styles.resultCard}>
              <Text style={styles.resultSectionTitle}>Nutrition</Text>
              <View style={styles.measureGrid}>
                <NutrientCell label="Calories" value={`${calories}`} unit="kcal" color="#E85D24" />
                <NutrientCell label="Caffeine" value={`${caffeine}`} unit="mg" color="#534AB7" />
                <NutrientCell label="Carbs" value={`${carbs}`} unit="g" color="#BA7517" />
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <Text style={styles.resetBtnText}>Scan another drink</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MeasureCell({
  label, value, accent
}: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.measureCell}>
      <Text style={styles.measureCellLabel}>{label}</Text>
      <Text style={[styles.measureCellValue, accent ? { color: accent } : {}]}>{value}</Text>
    </View>
  )
}

function NutrientCell({
  label, value, unit, color
}: { label: string; value: string; unit: string; color: string }) {
  return (
    <View style={styles.nutrientCell}>
      <Text style={styles.measureCellLabel}>{label}</Text>
      <Text style={[styles.nutrientValue, { color }]}>{value}</Text>
      <Text style={styles.nutrientUnit}>{unit}</Text>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f0',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  primaryBtn: {
    backgroundColor: '#185FA5',
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  progressOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 48,
  },
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#e8e8e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: 8,
    backgroundColor: '#1D9E75',
    borderRadius: 4,
  },
  progressPct: {
    fontSize: 13,
    color: '#888',
    marginBottom: 16,
  },
  measureBtn: {
    backgroundColor: '#1D9E75',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  measureBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  resultContainer: {
    flex: 1,
    padding: 16,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  resultSectionTitle: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  measureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  measureCell: {
    backgroundColor: '#f5f5f0',
    borderRadius: 10,
    padding: 10,
    minWidth: '45%',
    flex: 1,
  },
  measureCellLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 3,
  },
  measureCellValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  fillLabel: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
  },
  fillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  fillChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f0',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'transparent',
  },
  fillChipActive: {
    backgroundColor: '#E6F1FB',
    borderColor: '#185FA5',
  },
  fillChipText: {
    fontSize: 14,
    color: '#666',
  },
  fillChipTextActive: {
    color: '#185FA5',
    fontWeight: '500',
  },
  effectiveVol: {
    fontSize: 13,
    color: '#888',
  },
  boldText: {
    fontWeight: '600',
    color: '#1a1a1a',
  },
  nutrientCell: {
    backgroundColor: '#f5f5f0',
    borderRadius: 10,
    padding: 10,
    flex: 1,
    alignItems: 'center',
  },
  nutrientValue: {
    fontSize: 22,
    fontWeight: '600',
  },
  nutrientUnit: {
    fontSize: 11,
    color: '#888',
  },
  resetBtn: {
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  resetBtnText: {
    fontSize: 15,
    color: '#666',
  },
})
