import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, ScrollView, Modal, Animated, Easing,
} from 'react-native'
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera'
import { C, CATEGORY_COLOR, CATEGORY_EMOJI } from '../theme'
import { classifyDrink, getTopCandidates, isUsingRealML } from '../ml/drinkClassifier'
import { estimateVolume } from '../ar/volumeEstimator'
import { calculateNutrition, getDrinkName, getAllDrinkIds, getDrinkInfo } from '../db/nutritionDB'
import { saveScan, confirmScan, updateCorrection, generateScanId } from '../db/historyDB'
import type { ScanResult } from '../types'

type State = 'idle'|'recording'|'analyzing'|'result'

const STEPS = ['Extracting frame','Identifying drink','Measuring volume','Calculating nutrition']

export default function ScanScreen() {
  const [state, setState]           = useState<State>('idle')
  const [countdown, setCountdown]   = useState(5)
  const [step, setStep]             = useState(0)
  const [result, setResult]         = useState<ScanResult|null>(null)
  const [showCorrect, setShowCorrect] = useState(false)
  const [saved, setSaved]           = useState(false)

  const cameraRef   = useRef<Camera>(null)
  const timerRef    = useRef<ReturnType<typeof setInterval>|null>(null)
  const pulseAnim   = useRef(new Animated.Value(1)).current
  const fadeAnim    = useRef(new Animated.Value(0)).current
  const slideAnim   = useRef(new Animated.Value(60)).current
  const ringAnim    = useRef(new Animated.Value(0)).current

  const { hasPermission, requestPermission } = useCameraPermission()
  const device = useCameraDevice('back')

  // Pulse animation for scan button
  useEffect(() => {
    if (state !== 'idle') return
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue:1.08, duration:1000, useNativeDriver:true, easing:Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue:1, duration:1000, useNativeDriver:true, easing:Easing.inOut(Easing.ease) }),
      ])
    ).start()
  }, [state])

  // Animate result card in
  useEffect(() => {
    if (state === 'result') {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue:1, duration:500, useNativeDriver:true }),
        Animated.spring(slideAnim, { toValue:0, useNativeDriver:true, tension:80, friction:10 }),
      ]).start()
      // Ring fill animation
      Animated.timing(ringAnim, { toValue:1, duration:1000, delay:300, useNativeDriver:false, easing:Easing.out(Easing.cubic) }).start()
    } else {
      fadeAnim.setValue(0)
      slideAnim.setValue(60)
      ringAnim.setValue(0)
    }
  }, [state])

  const startScan = useCallback(async () => {
    if (!hasPermission) { const g = await requestPermission(); if(!g) return }
    if (!cameraRef.current || !device) return

    setState('recording')
    setResult(null)
    setSaved(false)
    let count = 5
    setCountdown(count)
    timerRef.current = setInterval(() => {
      count -= 1
      setCountdown(count)
      if (count <= 0 && timerRef.current) clearInterval(timerRef.current)
    }, 1000)

    try {
      await cameraRef.current.startRecording({
        onRecordingFinished: async (video) => {
          setState('analyzing')
          try {
            setStep(0)
            setStep(1)
            const [identification] = await Promise.all([classifyDrink(video.path)])
            setStep(2)
            const volume = await estimateVolume(video.path)
            setStep(3)
            const nutrition = calculateNutrition(identification.drinkId, volume.liquidVolumeMl)
            const scan: ScanResult = {
              scanId: generateScanId(),
              timestamp: new Date().toISOString(),
              identification, volume, nutrition,
              userConfirmed: false, syncedToCloud: false,
            }
            // Save immediately on scan
            const saved = saveScan(scan)
            console.log('[Scan] Auto-saved:', saved)
            setResult(scan)
            setState('result')
          } catch(e) {
            console.error('[Scan] Analysis error:', e)
            Alert.alert('Scan Failed', 'Could not analyse drink. Please try again.')
            setState('idle')
          }
        },
        onRecordingError: (e:any) => { console.error(e); setState('idle') },
      })
      setTimeout(async () => { try { await cameraRef.current?.stopRecording() } catch(e){} }, 5000)
    } catch(e) { console.error(e); setState('idle') }
  }, [hasPermission, device, requestPermission])

  const handleSave = useCallback(() => {
    if (!result) return
    confirmScan(result.scanId)
    setSaved(true)
    Alert.alert('✅ Saved!', `${result.identification.drinkName} added to your log.`)
  }, [result])

  const handleCorrect = useCallback((drinkId: string) => {
    if (!result) return
    const name = getDrinkName(drinkId)
    updateCorrection(result.scanId, name)
    const info = getDrinkInfo(drinkId)
    const nutrition = calculateNutrition(drinkId, result.volume.liquidVolumeMl)
    setResult({ ...result,
      identification: { ...result.identification, drinkId, drinkName: name, category: info.category as any },
      nutrition, userCorrection: name,
    })
    setShowCorrect(false)
  }, [result])

  const reset = () => { setState('idle'); setResult(null); setSaved(false) }

  if (!hasPermission) return (
    <View style={s.perm}>
      <Text style={s.permEmoji}>📷</Text>
      <Text style={s.permTitle}>Camera Access Needed</Text>
      <Text style={s.permSub}>DrinkScanAI needs your camera to scan drinks</Text>
      <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
        <Text style={s.permBtnTxt}>Allow Camera</Text>
      </TouchableOpacity>
    </View>
  )

  if (!device) return (
    <View style={s.perm}>
      <Text style={s.permEmoji}>⚠️</Text>
      <Text style={s.permTitle}>Camera Unavailable</Text>
    </View>
  )

  const catColor = result ? (CATEGORY_COLOR[result.identification.category] ?? C.teal) : C.teal

  return (
    <View style={s.root}>
      <Camera ref={cameraRef} style={StyleSheet.absoluteFill} device={device}
        isActive={state==='idle'||state==='recording'} video audio={false} />

      {/* Dark overlay for non-camera states */}
      {(state==='analyzing'||state==='result') && <View style={s.overlay} />}

      {/* Frame guide */}
      {(state==='idle'||state==='recording') && (
        <View style={s.frameWrap}>
          <View style={s.frame}>
            <View style={[s.corner,s.tl]} /><View style={[s.corner,s.tr]} />
            <View style={[s.corner,s.bl]} /><View style={[s.corner,s.br]} />
            {state==='recording' && (
              <View style={s.countdownWrap}>
                <Text style={s.countdownNum}>{countdown}</Text>
              </View>
            )}
          </View>
          <View style={s.hintPill}>
            <Text style={s.hintTxt}>
              {state==='idle' ? '🍹  Hold cup steady, tap to scan' : `📹  Recording — ${countdown}s remaining`}
            </Text>
          </View>
        </View>
      )}

      {/* Analyzing */}
      {state==='analyzing' && (
        <View style={s.analyzingWrap}>
          <ActivityIndicator size="large" color={C.teal} />
          <Text style={s.analyzingTitle}>Analysing your drink</Text>
          {STEPS.map((st,i) => (
            <View key={i} style={s.stepRow}>
              <Text style={[s.stepDot, i<=step && {color:C.teal}]}>
                {i<step?'✓':i===step?'▶':'○'}
              </Text>
              <Text style={[s.stepTxt, i===step && {color:C.text1, fontWeight:'700'}]}>{st}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Result */}
      {state==='result' && result && (
        <Animated.View style={[s.resultWrap, {opacity:fadeAnim, transform:[{translateY:slideAnim}]}]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.resultScroll}>
            {/* Drink header */}
            <View style={[s.drinkHeader, {borderColor: catColor+'40'}]}>
              <Text style={s.drinkEmoji}>{CATEGORY_EMOJI[result.identification.category]??'🥤'}</Text>
              <View style={{flex:1}}>
                <Text style={s.drinkName}>{result.identification.drinkName}</Text>
                <View style={s.badgeRow}>
                  <View style={[s.badge, {backgroundColor: catColor+'25', borderColor: catColor+'60'}]}>
                    <Text style={[s.badgeTxt,{color:catColor}]}>
                      {Math.round(result.identification.confidence*100)}% match
                    </Text>
                  </View>
                  <View style={[s.badge, {backgroundColor: isUsingRealML()?C.tealSoft:C.goldSoft, borderColor: isUsingRealML()?C.teal+'50':C.gold+'50'}]}>
                    <Text style={[s.badgeTxt, {color: isUsingRealML()?C.teal:C.gold}]}>
                      {isUsingRealML()?'🧠 CoreML':'⚡ Smart'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Big calorie number */}
            <View style={s.calCard}>
              <Text style={s.calLabel}>CALORIES</Text>
              <Text style={s.calNum}>{result.nutrition.calories}</Text>
              <Text style={s.calSub}>kcal in {result.volume.liquidVolumeMl}ml</Text>
            </View>

            {/* Stats grid */}
            <View style={s.statsGrid}>
              <StatBox label="Volume" value={`${result.volume.liquidVolumeMl}`} unit="ml" color={C.water} />
              <StatBox label="Caffeine" value={`${Math.round(result.nutrition.caffeineGrams*1000)}`} unit="mg" color={C.purple} />
              <StatBox label="Sugar" value={`${result.nutrition.sugarGrams}`} unit="g" color={C.orange} />
              <StatBox label="Carbs" value={`${result.nutrition.carbsGrams}`} unit="g" color={C.gold} />
              <StatBox label="Protein" value={`${result.nutrition.proteinGrams}`} unit="g" color={C.green} />
              <StatBox label="Fat" value={`${result.nutrition.fatGrams}`} unit="g" color={C.text2} />
            </View>

            {/* Volume bar */}
            <View style={s.volCard}>
              <View style={s.volRow}>
                <Text style={s.volLbl}>Fill level</Text>
                <Text style={s.volPct}>{result.volume.fillLevelPct}%</Text>
              </View>
              <View style={s.volTrack}>
                <Animated.View style={[s.volFill, {
                  width: ringAnim.interpolate({inputRange:[0,1],outputRange:['0%',`${result.volume.fillLevelPct}%`]}),
                  backgroundColor: catColor,
                }]} />
              </View>
              <Text style={s.volSub}>
                {result.volume.totalVolumeMl}ml cup · {result.volume.method==='vision_pod'?'Vision measured':'Estimated'}
              </Text>
            </View>

            {/* Actions */}
            <TouchableOpacity style={[s.saveBtn, saved && s.savedBtn]} onPress={handleSave} disabled={saved}>
              <Text style={s.saveBtnTxt}>{saved ? '✅ Saved to Log' : '💾 Save to Log'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.correctBtn} onPress={() => setShowCorrect(true)}>
              <Text style={s.correctBtnTxt}>✏️  Wrong drink? Correct it</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.retryBtn} onPress={reset}>
              <Text style={s.retryBtnTxt}>🔄  Scan another drink</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      )}

      {/* Scan button */}
      {state==='idle' && (
        <View style={s.scanWrap}>
          <Animated.View style={{transform:[{scale:pulseAnim}]}}>
            <TouchableOpacity style={s.scanBtn} onPress={startScan} activeOpacity={0.8}>
              <View style={s.scanRing}>
                <Text style={s.scanIcon}>⬤</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
          <Text style={s.scanHint}>Tap to record 5-second scan</Text>
        </View>
      )}

      {/* Correction modal */}
      <Modal visible={showCorrect} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <Text style={s.modalTitle}>What drink is this?</Text>
          <Text style={s.modalSub}>Corrections improve the AI model over time</Text>
          <ScrollView>
            {getAllDrinkIds().filter(id=>id!=='unknown').map(id => {
              const info = getDrinkInfo(id)
              const col = CATEGORY_COLOR[info.category] ?? C.teal
              return (
                <TouchableOpacity key={id} style={[s.drinkOption, result?.identification.drinkId===id && {borderColor:col, borderWidth:1.5}]} onPress={()=>handleCorrect(id)}>
                  <Text style={s.drinkOptEmoji}>{CATEGORY_EMOJI[info.category]??'🥤'}</Text>
                  <View style={{flex:1}}>
                    <Text style={s.drinkOptName}>{info.name}</Text>
                    <Text style={s.drinkOptCal}>{info.caloriesPer100ml} cal/100ml</Text>
                  </View>
                  {result?.identification.drinkId===id && <Text style={[s.drinkOptCheck,{color:col}]}>✓</Text>}
                </TouchableOpacity>
              )
            })}
          </ScrollView>
          <TouchableOpacity style={s.modalClose} onPress={()=>setShowCorrect(false)}>
            <Text style={s.modalCloseTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

function StatBox({label,value,unit,color}:{label:string,value:string,unit:string,color:string}) {
  return (
    <View style={[sb.box,{borderColor:color+'30'}]}>
      <Text style={[sb.val,{color}]}>{value}</Text>
      <Text style={sb.unit}>{unit}</Text>
      <Text style={sb.lbl}>{label}</Text>
    </View>
  )
}
const sb = StyleSheet.create({
  box:  {width:'30%',aspectRatio:1,backgroundColor:C.bg2,borderRadius:16,borderWidth:1,alignItems:'center',justifyContent:'center',marginBottom:12},
  val:  {fontSize:22,fontWeight:'800'},
  unit: {fontSize:11,color:C.text3,marginTop:-2},
  lbl:  {fontSize:10,color:C.text2,marginTop:4,textTransform:'uppercase',letterSpacing:0.5},
})

const s = StyleSheet.create({
  root:          {flex:1,backgroundColor:C.bg0},
  overlay:       {...StyleSheet.absoluteFillObject,backgroundColor:'rgba(7,11,20,0.92)'},
  perm:          {flex:1,backgroundColor:C.bg1,alignItems:'center',justifyContent:'center',padding:32},
  permEmoji:     {fontSize:64,marginBottom:16},
  permTitle:     {fontSize:22,fontWeight:'800',color:C.text1,marginBottom:8,textAlign:'center'},
  permSub:       {fontSize:15,color:C.text2,marginBottom:32,textAlign:'center',lineHeight:22},
  permBtn:       {backgroundColor:C.teal,paddingVertical:14,paddingHorizontal:40,borderRadius:14},
  permBtnTxt:    {color:C.bg0,fontSize:17,fontWeight:'800'},
  frameWrap:     {flex:1,alignItems:'center',justifyContent:'center',paddingBottom:140},
  frame:         {width:240,height:320,alignItems:'center',justifyContent:'center'},
  corner:        {position:'absolute',width:28,height:28,borderColor:C.teal,borderWidth:2.5},
  tl:            {top:0,left:0,borderRightWidth:0,borderBottomWidth:0,borderTopLeftRadius:4},
  tr:            {top:0,right:0,borderLeftWidth:0,borderBottomWidth:0,borderTopRightRadius:4},
  bl:            {bottom:0,left:0,borderRightWidth:0,borderTopWidth:0,borderBottomLeftRadius:4},
  br:            {bottom:0,right:0,borderLeftWidth:0,borderTopWidth:0,borderBottomRightRadius:4},
  countdownWrap: {backgroundColor:'rgba(0,229,204,0.15)',borderRadius:40,padding:16},
  countdownNum:  {fontSize:72,fontWeight:'900',color:C.teal,lineHeight:80},
  hintPill:      {backgroundColor:'rgba(13,20,37,0.85)',borderRadius:30,paddingHorizontal:20,paddingVertical:10,marginTop:20,borderWidth:1,borderColor:C.border},
  hintTxt:       {color:C.text1,fontSize:14},
  analyzingWrap: {flex:1,alignItems:'center',justifyContent:'center',padding:40},
  analyzingTitle:{color:C.text1,fontSize:20,fontWeight:'700',marginTop:20,marginBottom:28},
  stepRow:       {flexDirection:'row',alignItems:'center',marginBottom:10,width:'100%'},
  stepDot:       {color:C.text3,fontSize:14,width:24},
  stepTxt:       {color:C.text2,fontSize:14,flex:1},
  resultWrap:    {flex:1},
  resultScroll:  {padding:20,paddingBottom:48},
  drinkHeader:   {flexDirection:'row',alignItems:'center',gap:14,backgroundColor:C.bg2,borderRadius:20,padding:18,marginBottom:12,borderWidth:1},
  drinkEmoji:    {fontSize:40},
  drinkName:     {fontSize:22,fontWeight:'800',color:C.text1,marginBottom:8},
  badgeRow:      {flexDirection:'row',gap:8},
  badge:         {paddingHorizontal:10,paddingVertical:4,borderRadius:20,borderWidth:1},
  badgeTxt:      {fontSize:11,fontWeight:'700'},
  calCard:       {backgroundColor:C.bg2,borderRadius:20,padding:24,alignItems:'center',marginBottom:12,borderWidth:1,borderColor:C.gold+'25'},
  calLabel:      {fontSize:11,color:C.gold,fontWeight:'700',letterSpacing:2,marginBottom:4},
  calNum:        {fontSize:72,fontWeight:'900',color:C.gold,lineHeight:76},
  calSub:        {fontSize:13,color:C.text2,marginTop:4},
  statsGrid:     {flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',marginBottom:4},
  volCard:       {backgroundColor:C.bg2,borderRadius:16,padding:18,marginBottom:12,borderWidth:1,borderColor:C.border},
  volRow:        {flexDirection:'row',justifyContent:'space-between',marginBottom:8},
  volLbl:        {color:C.text2,fontSize:13},
  volPct:        {color:C.text1,fontSize:13,fontWeight:'700'},
  volTrack:      {height:6,backgroundColor:C.bg3,borderRadius:3,overflow:'hidden',marginBottom:8},
  volFill:       {height:6,borderRadius:3},
  volSub:        {color:C.text3,fontSize:11},
  saveBtn:       {backgroundColor:C.teal,borderRadius:16,padding:17,alignItems:'center',marginBottom:10},
  savedBtn:      {backgroundColor:C.green},
  saveBtnTxt:    {color:C.bg0,fontSize:17,fontWeight:'800'},
  correctBtn:    {backgroundColor:C.bg2,borderRadius:16,padding:15,alignItems:'center',marginBottom:10,borderWidth:1,borderColor:C.border},
  correctBtnTxt: {color:C.text1,fontSize:15,fontWeight:'600'},
  retryBtn:      {alignItems:'center',padding:12},
  retryBtnTxt:   {color:C.text2,fontSize:14},
  scanWrap:      {position:'absolute',bottom:48,left:0,right:0,alignItems:'center'},
  scanBtn:       {width:88,height:88,borderRadius:44,borderWidth:2,borderColor:C.teal,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,229,204,0.08)'},
  scanRing:      {width:72,height:72,borderRadius:36,backgroundColor:C.teal,alignItems:'center',justifyContent:'center'},
  scanIcon:      {color:C.bg0,fontSize:28},
  scanHint:      {color:C.text2,fontSize:13,marginTop:14},
  modal:         {flex:1,backgroundColor:C.bg1,padding:24},
  modalTitle:    {fontSize:22,fontWeight:'800',color:C.text1,marginBottom:6},
  modalSub:      {fontSize:13,color:C.text2,marginBottom:20},
  drinkOption:   {flexDirection:'row',alignItems:'center',backgroundColor:C.bg2,borderRadius:14,padding:14,marginBottom:8,borderWidth:1,borderColor:C.border,gap:12},
  drinkOptEmoji: {fontSize:22},
  drinkOptName:  {fontSize:15,fontWeight:'600',color:C.text1},
  drinkOptCal:   {fontSize:12,color:C.text2,marginTop:2},
  drinkOptCheck: {fontSize:18,fontWeight:'700'},
  modalClose:    {backgroundColor:C.red+'20',borderRadius:14,padding:16,alignItems:'center',marginTop:16,borderWidth:1,borderColor:C.red+'40'},
  modalCloseTxt: {color:C.red,fontSize:16,fontWeight:'700'},
})
