import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, NativeModules,
} from 'react-native'

export default function DiagnosticScreen() {
  const [results, setResults] = useState<string[]>([])

  const addLine = (line: string) => {
    setResults(prev => [...prev, line])
    console.log('[DIAG]', line)
  }

  const runDiagnostics = async () => {
    setResults([])

    // 1. Check NativeModules
    addLine('=== NativeModules ===')
    const allModules = Object.keys(NativeModules)
    addLine(`Total modules: ${allModules.length}`)

    const drinkModules = allModules.filter(m =>
      m.toLowerCase().includes('drink') ||
      m.toLowerCase().includes('classifier') ||
      m.toLowerCase().includes('frame') ||
      m.toLowerCase().includes('volume') ||
      m.toLowerCase().includes('arkit')
    )
    addLine(`Custom modules: ${drinkModules.join(', ') || 'NONE FOUND'}`)

    // 2. Check DrinkClassifierModule specifically
    addLine('\n=== DrinkClassifierModule ===')
    const { DrinkClassifierModule } = NativeModules
    if (!DrinkClassifierModule) {
      addLine('❌ NOT FOUND in NativeModules')
      addLine('This means the Swift module is not registered')
      addLine('Bridging header may be missing or wrong')
    } else {
      addLine('✅ Found in NativeModules')
      const methods = Object.keys(DrinkClassifierModule)
      addLine(`Methods: ${methods.join(', ')}`)

      // 3. Try preloadModel
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
    }

    // 4. Check FrameExtractorModule
    addLine('\n=== FrameExtractorModule ===')
    const { FrameExtractorModule } = NativeModules
    addLine(FrameExtractorModule ? '✅ Found' : '❌ NOT FOUND')

    // 5. Check VolumeEstimatorModule
    addLine('\n=== VolumeEstimatorModule ===')
    const { VolumeEstimatorModule } = NativeModules
    addLine(VolumeEstimatorModule ? '✅ Found' : '❌ NOT FOUND')

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
            line.includes('===') && s.header2,
          ]}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#0A1628' },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#1E3050' },
  title:   { color: '#fff', fontSize: 20, fontWeight: '700' },
  btn:     { backgroundColor: '#005F99', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  btnTxt:  { color: '#fff', fontWeight: '600' },
  scroll:  { flex: 1, padding: 16 },
  line:    { color: '#A8B4C8', fontSize: 13, fontFamily: 'Courier', marginBottom: 4 },
  good:    { color: '#00C896' },
  bad:     { color: '#FF453A' },
  header2: { color: '#00C2FF', fontWeight: '700', marginTop: 8 },
})
