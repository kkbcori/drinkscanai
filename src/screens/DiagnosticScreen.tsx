import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, NativeModules,
} from 'react-native'
import { preloadModel, getLastError, isUsingRealML } from '../ml/drinkClassifier'

export default function DiagnosticScreen() {
  const [results, setResults] = useState<string[]>([])

  const addLine = (line: string) => setResults(prev => [...prev, line])

  const runDiagnostics = async () => {
    setResults([])

    addLine('=== NativeModules ===')
    const allModules = Object.keys(NativeModules)
    addLine(`Total modules: ${allModules.length}`)
    const custom = allModules.filter(m =>
      ['DrinkClassifier','FrameExtractor','VolumeEstimator'].some(k => m.includes(k))
    )
    addLine(`Custom modules: ${custom.join(', ') || 'NONE FOUND'}`)

    addLine('\n=== DrinkClassifierModule ===')
    const { DrinkClassifierModule } = NativeModules
    if (!DrinkClassifierModule) {
      addLine('❌ NOT FOUND in NativeModules')
    } else {
      addLine('✅ Found in NativeModules')
      addLine(`Methods: ${Object.keys(DrinkClassifierModule).join(', ')}`)

      addLine('\n=== Preload Model ===')
      try {
        const result = await DrinkClassifierModule.preloadModel()
        addLine(`Result: ${JSON.stringify(result)}`)
        if (result?.loaded) {
          addLine(`✅ CoreML loaded! Classes: ${result.classes}`)
        } else {
          addLine(`❌ Failed: ${result?.error}`)
        }
      } catch (e: any) {
        addLine(`❌ Exception: ${e?.message ?? String(e)}`)
      }

      addLine('\n=== Test Inference (dummy path) ===')
      try {
        const r = await DrinkClassifierModule.classifyImage('/tmp/test.jpg', 3)
        addLine(`Result: ${JSON.stringify(r?.slice(0,2))}`)
      } catch (e: any) {
        addLine(`Error (expected for dummy path): ${e?.message ?? String(e)}`)
      }
    }

    addLine('\n=== FrameExtractorModule ===')
    addLine(NativeModules.FrameExtractorModule ? '✅ Found' : '❌ NOT FOUND')

    addLine('\n=== VolumeEstimatorModule ===')
    addLine(NativeModules.VolumeEstimatorModule ? '✅ Found' : '❌ NOT FOUND')

    addLine('\n=== ML Status ===')
    addLine(`Using real ML: ${isUsingRealML() ? '✅ Yes (CoreML)' : '❌ No (Heuristic)'}`)
    const err = getLastError()
    if (err) addLine(`Last error: ${err}`)

    addLine('\n=== Done ===')
  }

  useEffect(() => { runDiagnostics() }, [])

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Text style={s.title}>ML Diagnostics</Text>
        <TouchableOpacity style={s.btn} onPress={runDiagnostics}>
          <Text style={s.btnTxt}>Run Again</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={s.scroll}>
        {results.map((line, i) => (
          <Text key={i} style={[
            s.line,
            line.includes('✅') && s.good,
            line.includes('❌') && s.bad,
            line.includes('===') && s.head,
          ]}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen:  { flex:1, backgroundColor:'#0A1628' },
  header:  { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, paddingTop:60, borderBottomWidth:1, borderBottomColor:'#1E3050' },
  title:   { color:'#fff', fontSize:20, fontWeight:'700' },
  btn:     { backgroundColor:'#005F99', paddingHorizontal:16, paddingVertical:8, borderRadius:8 },
  btnTxt:  { color:'#fff', fontWeight:'600' },
  scroll:  { flex:1, padding:16 },
  line:    { color:'#A8B4C8', fontSize:12, fontFamily:'Courier', marginBottom:3 },
  good:    { color:'#00C896' },
  bad:     { color:'#FF453A' },
  head:    { color:'#00C2FF', fontWeight:'700', marginTop:8 },
})
