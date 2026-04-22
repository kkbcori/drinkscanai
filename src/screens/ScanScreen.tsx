import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, Modal,
} from 'react-native'
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera'
import type { ScanResult } from '../types'
import { extractBestFrame } from '../ml/frameExtractor'
import { classifyDrink, getTopCandidates, preloadModel } from '../ml/drinkClassifier'
import { estimateVolume } from '../ar/volumeEstimator'
import { calculateNutrition, getDrinkName, getAllDrinkIds, getDrinkInfo } from '../db/nutritionDB'
import { saveScan, confirmScan, updateCorrection, generateScanId } from '../db/historyDB'

type ScanState = 'idle' | 'recording' | 'analyzing' | 'result'

const ANALYSIS_STEPS = [
  '🎞️  Extracting best frame...',
  '🔍 Identifying drink type...',
  '📐 Measuring cup volume...',
  '🧮 Calculating nutrition...',
]

export default function ScanScreen() {
  const [scanState, setScanState]       = useState<ScanState>('idle')
  const [countdown, setCountdown]       = useState(5)
  const [analysisStep, setAnalysisStep] = useState(0)
  const [result, setResult]             = useState<ScanResult | null>(null)
  const [showCorrection, setShowCorrection] = useState(false)

  const cameraRef      = useRef<Camera>(null)
  const countdownRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  const { hasPermission, requestPermission } = useCameraPermission()
  const device = useCameraDevice('back')

  useEffect(() => {
    // Preload ONNX model on mount to eliminate first-scan delay
    preloadModel().catch(() => {})
  }, [])

  const startScan = useCallback(async () => {
    if (!hasPermission) {
      const granted = await requestPermission()
      if (!granted) return
    }
    if (!cameraRef.current || !device) return

    setScanState('recording')
    setResult(null)

    // Start countdown
    let count = 5
    setCountdown(count)
    countdownRef.current = setInterval(() => {
      count -= 1
      setCountdown(count)
      if (count <= 0 && countdownRef.current) clearInterval(countdownRef.current)
    }, 1000)

    try {
      await cameraRef.current.startRecording({
        onRecordingFinished: async (video) => {
          setScanState('analyzing')
          setAnalysisStep(0)

          try {
            // Step 1: Extract best frame
            setAnalysisStep(0)
            const framePath = await extractBestFrame(video.path)

            // Step 2: Classify drink (uses framePath if available, else video path)
            setAnalysisStep(1)
            const [identification, topCandidates] = await Promise.all([
              classifyDrink(framePath ?? video.path),
              getTopCandidates(framePath ?? video.path, 5),
            ])

            // Step 3: Estimate volume
            setAnalysisStep(2)
            const volume = await estimateVolume(video.path)

            // Step 4: Calculate nutrition
            setAnalysisStep(3)
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
        onRecordingError: (error: any) => {
          console.error('Recording error:', error)
          setScanState('idle')
        },
      })

      setTimeout(async () => {
        try { await cameraRef.current?.stopRecording() } catch (e) {}
      }, 5000)

    } catch (e) {
      console.error('Start error:', e)
      setScanState('idle')
    }
  }, [hasPermission, device, requestPermission])

  const handleConfirm = useCallback(() => {
    if (!result) return
    confirmScan(result.scanId)
    Alert.alert('✅ Saved', 'Scan saved to history.')
    setScanState('idle')
    setResult(null)
  }, [result])

  const handleCorrect = useCallback((drinkId: string) => {
    if (!result) return
    updateCorrection(result.scanId, getDrinkName(drinkId))
    const info = getDrinkInfo(drinkId)
    const nutrition = calculateNutrition(drinkId, result.volume.liquidVolumeMl)
    setResult({
      ...result,
      identification: { ...result.identification, drinkId, drinkName: info.name, category: info.category as any },
      nutrition,
      userCorrection: info.name,
    })
    setShowCorrection(false)
  }, [result])

  const reset = useCallback(() => {
    setScanState('idle')
    setResult(null)
    setCountdown(5)
    setAnalysisStep(0)
  }, [])

  if (!hasPermission) {
    return (
      <View style={s.centered}>
        <Text style={s.permIcon}>📷</Text>
        <Text style={s.permTitle}>Camera Access Required</Text>
        <Text style={s.permSub}>DrinkScanAI needs camera access to scan your drink</Text>
        <TouchableOpacity style={s.btn} onPress={requestPermission}>
          <Text style={s.btnTxt}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!device) {
    return (
      <View style={s.centered}>
        <Text style={s.permIcon}>⚠️</Text>
        <Text style={s.permTitle}>Camera Not Available</Text>
      </View>
    )
  }

  return (
    <View style={s.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={scanState === 'idle' || scanState === 'recording'}
        video={true}
        audio={false}
      />

      {scanState === 'analyzing' && <View style={s.darkOverlay} />}

      {/* Frame guide */}
      {(scanState === 'idle' || scanState === 'recording') && (
        <View style={s.frameWrap}>
          <View style={s.frame}>
            <View style={[s.corner, s.tl]} />
            <View style={[s.corner, s.tr]} />
            <View style={[s.corner, s.bl]} />
            <View style={[s.corner, s.br]} />
            {scanState === 'recording' && (
              <Text style={s.countdown}>{countdown}</Text>
            )}
          </View>
          <View style={s.hintBox}>
            <Text style={s.hint}>
              {scanState === 'idle'
                ? 'Center the cup — tap button to start'
                : `Scanning... hold steady (${countdown}s)`}
            </Text>
          </View>
        </View>
      )}

      {/* Analysis progress */}
      {scanState === 'analyzing' && (
        <View style={s.analyzingWrap}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={s.analyzingTitle}>Analyzing drink...</Text>
          {ANALYSIS_STEPS.map((step, i) => (
            <Text key={i} style={[s.analysisStep, i === analysisStep && s.analysisStepActive]}>
              {i < analysisStep ? '✓ ' : i === analysisStep ? '▶ ' : '  '}
              {step.replace(/^[^\s]+ /, '')}
            </Text>
          ))}
        </View>
      )}

      {/* Result */}
      {scanState === 'result' && result && (
        <ScrollView style={s.resultScroll} contentContainerStyle={s.resultContent}>
          <View style={s.resultHeader}>
            <Text style={s.resultDrink}>{result.identification.drinkName}</Text>
            <View style={[s.badge,
              { backgroundColor: result.identification.confidence > 0.75 ? '#E8F5E9' : '#FFF3E0' }]}>
              <Text style={[s.badgeTxt,
                { color: result.identification.confidence > 0.75 ? '#2E7D32' : '#E65100' }]}>
                {Math.round(result.identification.confidence * 100)}% confidence
              </Text>
            </View>
            <Text style={s.methodTxt}>
              {result.volume.method === 'vision' ? '📐 Vision measured' : '📐 Size estimated'}
              {' · '}
              {result.identification.modelVersion}
            </Text>
          </View>

          <Card title="📐 Volume">
            <Row>
              <Stat label="Cup Size"   value={`${result.volume.totalVolumeMl}ml`} />
              <Stat label="Fill Level" value={`${result.volume.fillLevelPct}%`} />
              <Stat label="Liquid"     value={`${result.volume.liquidVolumeMl}ml`} color="#007AFF" />
            </Row>
          </Card>

          <Card title="🔥 Calories & Caffeine">
            <Row>
              <Stat label="Calories" value={`${result.nutrition.calories}`}                                color="#FF6B35" />
              <Stat label="Caffeine" value={`${Math.round(result.nutrition.caffeineGrams * 1000)}mg`}     color="#6B35FF" />
              <Stat label="Sugar"    value={`${result.nutrition.sugarGrams}g`} />
            </Row>
          </Card>

          <Card title="🧮 Macros">
            <Row>
              <Stat label="Carbs"   value={`${result.nutrition.carbsGrams}g`} />
              <Stat label="Protein" value={`${result.nutrition.proteinGrams}g`} />
              <Stat label="Fat"     value={`${result.nutrition.fatGrams}g`} />
            </Row>
          </Card>

          <TouchableOpacity style={s.confirmBtn} onPress={handleConfirm}>
            <Text style={s.confirmBtnTxt}>✅ Confirm & Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.correctBtn} onPress={() => setShowCorrection(true)}>
            <Text style={s.correctBtnTxt}>✏️ Wrong drink? Correct it</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.retryBtn} onPress={reset}>
            <Text style={s.retryBtnTxt}>🔄 Scan Again</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Scan button */}
      {scanState === 'idle' && (
        <View style={s.scanBtnWrap}>
          <TouchableOpacity style={s.scanBtn} onPress={startScan}>
            <View style={s.scanBtnInner} />
          </TouchableOpacity>
          <Text style={s.scanHint}>Tap to record 5-second scan</Text>
        </View>
      )}

      {/* Correction modal */}
      <Modal visible={showCorrection} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <Text style={s.modalTitle}>What drink is this?</Text>
          <Text style={s.modalSub}>Your correction trains the model to be smarter</Text>
          <ScrollView>
            {getAllDrinkIds().filter(id => id !== 'unknown').map(drinkId => {
              const info = getDrinkInfo(drinkId)
              return (
                <TouchableOpacity
                  key={drinkId}
                  style={[s.drinkRow, result?.identification.drinkId === drinkId && s.drinkRowSelected]}
                  onPress={() => handleCorrect(drinkId)}
                >
                  <Text style={s.drinkRowName}>{info.name}</Text>
                  <Text style={s.drinkRowCal}>{info.caloriesPer100ml} cal/100ml</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
          <TouchableOpacity style={s.modalCancel} onPress={() => setShowCorrection(false)}>
            <Text style={s.modalCancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

// Sub-components
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      {children}
    </View>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={s.row}>{children}</View>
}

function Stat({ label, value, color = '#1a1a1a' }: { label: string; value: string; color?: string }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statVal, { color }]}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#000' },
  centered:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#f5f5f5' },
  permIcon:        { fontSize: 64, marginBottom: 16 },
  permTitle:       { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 8, textAlign: 'center' },
  permSub:         { fontSize: 15, color: '#666', marginBottom: 32, textAlign: 'center', lineHeight: 22 },
  btn:             { backgroundColor: '#007AFF', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12 },
  btnTxt:          { color: '#fff', fontSize: 17, fontWeight: '600' },
  darkOverlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.88)' },
  frameWrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 130 },
  frame:           { width: 260, height: 340, alignItems: 'center', justifyContent: 'center' },
  corner:          { position: 'absolute', width: 32, height: 32, borderColor: '#fff', borderWidth: 3 },
  tl:              { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr:              { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl:              { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br:              { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  countdown:       { fontSize: 80, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  hintBox:         { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9, marginTop: 20 },
  hint:            { color: '#fff', fontSize: 14, textAlign: 'center' },
  analyzingWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  analyzingTitle:  { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 20, marginBottom: 20 },
  analysisStep:    { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 8 },
  analysisStepActive: { color: '#fff', fontWeight: '600' },
  resultScroll:    { flex: 1 },
  resultContent:   { padding: 16, paddingBottom: 40 },
  resultHeader:    { alignItems: 'center', marginBottom: 14, marginTop: 8 },
  resultDrink:     { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 8 },
  badge:           { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginBottom: 4 },
  badgeTxt:        { fontSize: 13, fontWeight: '600' },
  methodTxt:       { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },
  card:            { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 16, marginBottom: 10 },
  cardTitle:       { fontSize: 14, fontWeight: '700', color: '#555', marginBottom: 12 },
  row:             { flexDirection: 'row', justifyContent: 'space-around' },
  stat:            { alignItems: 'center', minWidth: 72 },
  statVal:         { fontSize: 20, fontWeight: '700' },
  statLbl:         { fontSize: 11, color: '#888', marginTop: 2 },
  confirmBtn:      { backgroundColor: '#34C759', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10 },
  confirmBtnTxt:   { color: '#fff', fontSize: 17, fontWeight: '700' },
  correctBtn:      { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  correctBtnTxt:   { color: '#fff', fontSize: 15, fontWeight: '600' },
  retryBtn:        { alignItems: 'center', padding: 12 },
  retryBtnTxt:     { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  scanBtnWrap:     { position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center' },
  scanBtn:         { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  scanBtnInner:    { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
  scanHint:        { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  modal:           { flex: 1, backgroundColor: '#f5f5f5', padding: 24 },
  modalTitle:      { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  modalSub:        { fontSize: 13, color: '#888', marginBottom: 20 },
  drinkRow:        { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  drinkRowSelected:{ borderColor: '#007AFF', borderWidth: 2 },
  drinkRowName:    { fontSize: 16, color: '#1a1a1a', fontWeight: '500' },
  drinkRowCal:     { fontSize: 13, color: '#888' },
  modalCancel:     { backgroundColor: '#FF3B30', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 16 },
  modalCancelTxt:  { color: '#fff', fontSize: 17, fontWeight: '600' },
})
