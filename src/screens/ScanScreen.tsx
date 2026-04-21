import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, Modal,
} from 'react-native'
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  CameraRuntimeError,
} from 'react-native-vision-camera'
import type { ScanResult, DrinkIdentification } from '../types'
import { classifyDrink, getTopCandidates } from '../ml/drinkClassifier'
import { estimateVolume } from '../ar/volumeEstimator'
import { calculateNutrition, getDrinkName, getAllDrinkIds, getDrinkInfo } from '../db/nutritionDB'
import { saveScan, confirmScan, updateCorrection, initDB, generateScanId } from '../db/historyDB'

type ScanState = 'idle' | 'recording' | 'analyzing' | 'result'

export default function ScanScreen() {
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [countdown, setCountdown] = useState(5)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [showCorrection, setShowCorrection] = useState(false)

  const cameraRef = useRef<Camera>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { hasPermission, requestPermission } = useCameraPermission()
  const device = useCameraDevice('back')

  useEffect(() => {
    initDB()
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const startScan = useCallback(async () => {
    if (!hasPermission) {
      const granted = await requestPermission()
      if (!granted) return
    }
    if (!cameraRef.current || !device) return

    setScanState('recording')
    setResult(null)

    // Countdown timer
    let count = 5
    setCountdown(count)
    countdownRef.current = setInterval(() => {
      count -= 1
      setCountdown(count)
      if (count <= 0 && countdownRef.current) {
        clearInterval(countdownRef.current)
      }
    }, 1000)

    try {
      // Start recording - vision-camera v3 API
      await cameraRef.current.startRecording({
        onRecordingFinished: async (video) => {
          setScanState('analyzing')
          try {
            const [identification, volume] = await Promise.all([
              classifyDrink(video.path),
              estimateVolume(video.path),
            ])

            const nutrition = calculateNutrition(
              identification.drinkId,
              volume.liquidVolumeMl
            )

            const scanResult: ScanResult = {
              scanId:        generateScanId(),
              timestamp:     new Date().toISOString(),
              identification,
              volume,
              nutrition,
              userConfirmed: false,
              syncedToCloud: false,
            }

            saveScan(scanResult)
            setResult(scanResult)
            setScanState('result')
          } catch (e) {
            console.error('Analysis error:', e)
            Alert.alert('Analysis Failed', 'Could not analyze the drink. Please try again.')
            setScanState('idle')
          }
        },
        onRecordingError: (error: CameraRuntimeError) => {
          console.error('Recording error:', error)
          setScanState('idle')
        },
      })

      // Stop after 5 seconds
      setTimeout(async () => {
        try {
          await cameraRef.current?.stopRecording()
        } catch (e) {
          console.error('Stop error:', e)
        }
      }, 5000)
    } catch (e) {
      console.error('Start error:', e)
      setScanState('idle')
    }
  }, [hasPermission, device, requestPermission])

  const handleConfirm = useCallback(() => {
    if (!result) return
    confirmScan(result.scanId)
    Alert.alert('✅ Saved', 'Scan confirmed and saved to history.')
    setScanState('idle')
    setResult(null)
  }, [result])

  const handleCorrect = useCallback((drinkId: string) => {
    if (!result) return
    const correctedName = getDrinkName(drinkId)
    updateCorrection(result.scanId, correctedName)
    const nutrition = calculateNutrition(drinkId, result.volume.liquidVolumeMl)
    const drinkInfo = getDrinkInfo(drinkId)
    setResult({
      ...result,
      identification: {
        ...result.identification,
        drinkId,
        drinkName: correctedName,
        category: drinkInfo.category,
      },
      nutrition,
      userCorrection: correctedName,
    })
    setShowCorrection(false)
  }, [result])

  const reset = useCallback(() => {
    setScanState('idle')
    setResult(null)
    setCountdown(5)
  }, [])

  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permIcon}>📷</Text>
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permSub}>
          DrinkScanAI needs camera access to scan your drink
        </Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!device) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permIcon}>⚠️</Text>
        <Text style={styles.permTitle}>Camera Unavailable</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={scanState === 'idle' || scanState === 'recording'}
        video={true}
        audio={false}
      />

      {scanState === 'analyzing' && <View style={styles.darkOverlay} />}

      {(scanState === 'idle' || scanState === 'recording') && (
        <View style={styles.frameContainer}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            {scanState === 'recording' && (
              <Text style={styles.countdown}>{countdown}</Text>
            )}
          </View>
          <Text style={styles.frameHint}>
            {scanState === 'idle'
              ? 'Center your cup in the frame'
              : `Hold steady — recording for ${countdown}s`}
          </Text>
        </View>
      )}

      {scanState === 'analyzing' && (
        <View style={styles.analyzingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.analyzingTitle}>Analyzing your drink...</Text>
          <Text style={styles.analyzingSteps}>
            🔍 Identifying drink type{'\n'}
            📐 Measuring cup volume{'\n'}
            🧮 Calculating nutrition
          </Text>
        </View>
      )}

      {scanState === 'result' && result && (
        <ScrollView style={styles.resultScroll} contentContainerStyle={styles.resultContent}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultDrink}>{result.identification.drinkName}</Text>
            <View style={[
              styles.confidenceBadge,
              { backgroundColor: result.identification.confidence > 0.8 ? '#E8F5E9' : '#FFF3E0' }
            ]}>
              <Text style={[
                styles.confidenceText,
                { color: result.identification.confidence > 0.8 ? '#2E7D32' : '#E65100' }
              ]}>
                {Math.round(result.identification.confidence * 100)}% confident
              </Text>
            </View>
            {result.volume.method === 'fallback' && (
              <Text style={styles.fallbackNote}>⚠️ Volume estimated (ARKit unavailable)</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>📐 Volume</Text>
            <View style={styles.statsRow}>
              <Stat label="Cup Size" value={`${result.volume.totalVolumeMl}ml`} />
              <Stat label="Fill Level" value={`${result.volume.fillLevelPct}%`} />
              <Stat label="Liquid" value={`${result.volume.liquidVolumeMl}ml`} color="#007AFF" />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>🧮 Nutrition</Text>
            <View style={styles.statsRow}>
              <Stat label="Calories" value={`${result.nutrition.calories}`} color="#FF6B35" />
              <Stat label="Caffeine" value={`${Math.round(result.nutrition.caffeineGrams * 1000)}mg`} color="#6B35FF" />
              <Stat label="Carbs" value={`${result.nutrition.carbsGrams}g`} />
            </View>
            <View style={styles.statsRow}>
              <Stat label="Sugar" value={`${result.nutrition.sugarGrams}g`} />
              <Stat label="Protein" value={`${result.nutrition.proteinGrams}g`} />
              <Stat label="Fat" value={`${result.nutrition.fatGrams}g`} />
            </View>
          </View>

          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmBtnText}>✅ Confirm & Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.correctBtn} onPress={() => setShowCorrection(true)}>
            <Text style={styles.correctBtnText}>✏️ Correct Drink Type</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.retryBtn} onPress={reset}>
            <Text style={styles.retryBtnText}>🔄 Scan Again</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {scanState === 'idle' && (
        <View style={styles.scanBtnContainer}>
          <TouchableOpacity style={styles.scanBtn} onPress={startScan}>
            <View style={styles.scanBtnInner} />
          </TouchableOpacity>
          <Text style={styles.scanHint}>Tap to start 5-second scan</Text>
        </View>
      )}

      <Modal visible={showCorrection} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>What drink is this?</Text>
          <Text style={styles.modalSub}>Your correction helps improve future scans</Text>
          <ScrollView style={styles.drinkList}>
            {getAllDrinkIds().filter(id => id !== 'unknown').map(drinkId => {
              const info = getDrinkInfo(drinkId)
              return (
                <TouchableOpacity
                  key={drinkId}
                  style={[
                    styles.drinkOption,
                    result?.identification.drinkId === drinkId && styles.drinkOptionSelected
                  ]}
                  onPress={() => handleCorrect(drinkId)}
                >
                  <Text style={styles.drinkOptionText}>{info.name}</Text>
                  <Text style={styles.drinkOptionCal}>{info.caloriesPer100ml} cal/100ml</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
          <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCorrection(false)}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

function Stat({ label, value, color = '#1a1a1a' }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#000' },
  centered:           { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#f5f5f5' },
  permIcon:           { fontSize: 64, marginBottom: 16 },
  permTitle:          { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 8, textAlign: 'center' },
  permSub:            { fontSize: 15, color: '#666', marginBottom: 32, textAlign: 'center', lineHeight: 22 },
  btn:                { backgroundColor: '#007AFF', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12 },
  btnText:            { color: '#fff', fontSize: 17, fontWeight: '600' },
  darkOverlay:        { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)' },
  frameContainer:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 120 },
  frame:              { width: 260, height: 340, alignItems: 'center', justifyContent: 'center' },
  corner:             { position: 'absolute', width: 32, height: 32, borderColor: '#fff', borderWidth: 3 },
  tl:                 { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr:                 { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl:                 { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br:                 { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  countdown:          { fontSize: 72, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  frameHint:          { color: '#fff', fontSize: 14, marginTop: 16, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  analyzingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  analyzingTitle:     { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 20, marginBottom: 24 },
  analyzingSteps:     { color: 'rgba(255,255,255,0.8)', fontSize: 15, lineHeight: 28, textAlign: 'center' },
  resultScroll:       { flex: 1 },
  resultContent:      { padding: 16, paddingBottom: 40 },
  resultHeader:       { alignItems: 'center', marginBottom: 16, marginTop: 8 },
  resultDrink:        { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 8 },
  confidenceBadge:    { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginBottom: 6 },
  confidenceText:     { fontSize: 13, fontWeight: '600' },
  fallbackNote:       { color: '#FFB74D', fontSize: 12, marginTop: 4 },
  card:               { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTitle:          { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 12 },
  statsRow:           { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  stat:               { alignItems: 'center', minWidth: 72 },
  statValue:          { fontSize: 20, fontWeight: '700' },
  statLabel:          { fontSize: 11, color: '#888', marginTop: 2 },
  confirmBtn:         { backgroundColor: '#34C759', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10 },
  confirmBtnText:     { color: '#fff', fontSize: 17, fontWeight: '700' },
  correctBtn:         { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  correctBtnText:     { color: '#fff', fontSize: 16, fontWeight: '600' },
  retryBtn:           { alignItems: 'center', padding: 12 },
  retryBtnText:       { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  scanBtnContainer:   { position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center' },
  scanBtn:            { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  scanBtnInner:       { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
  scanHint:           { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  modalContainer:     { flex: 1, backgroundColor: '#f5f5f5', padding: 24 },
  modalTitle:         { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  modalSub:           { fontSize: 14, color: '#666', marginBottom: 20 },
  drinkList:          { flex: 1 },
  drinkOption:        { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  drinkOptionSelected:{ borderColor: '#007AFF', borderWidth: 2 },
  drinkOptionText:    { fontSize: 16, color: '#1a1a1a', fontWeight: '500' },
  drinkOptionCal:     { fontSize: 13, color: '#888' },
  modalCancel:        { backgroundColor: '#FF3B30', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 16 },
  modalCancelText:    { color: '#fff', fontSize: 17, fontWeight: '600' },
})
