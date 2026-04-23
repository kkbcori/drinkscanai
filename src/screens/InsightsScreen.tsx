import React, { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { getRecentScans } from '../db/historyDB'
import { Colors, CATEGORY_EMOJI, CATEGORY_COLOR, Shadow, Radius } from '../theme'

type Period = '7d' | '30d'

export default function InsightsScreen() {
  const [period, setPeriod] = useState<Period>('7d')
  const [scans, setScans]   = useState<any[]>([])

  useFocusEffect(useCallback(() => {
    setScans(getRecentScans(200))
  }, []))

  const days = period === '7d' ? 7 : 30
  const cutoff = new Date(Date.now() - days * 86400000).toISOString()
  const filtered = scans.filter(s => s.timestamp > cutoff)

  // Aggregate by drink category
  const byCat: Record<string, number> = {}
  filtered.forEach(s => {
    const cat = s.identification?.category ?? 'unknown'
    byCat[cat] = (byCat[cat] ?? 0) + 1
  })
  const topCats = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const totalScans = filtered.length || 1

  // Daily breakdown for bar chart (last 7 days)
  const dailyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000)
    const dateStr = d.toISOString().slice(0, 10)
    const dayScans = scans.filter(s => s.timestamp?.slice(0, 10) === dateStr)
    return {
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      calories: dayScans.reduce((t, s) => t + (s.nutrition?.calories ?? 0), 0),
      count: dayScans.length,
    }
  })
  const maxCal = Math.max(...dailyData.map(d => d.calories), 1)

  // Totals
  const totalCal  = filtered.reduce((t, s) => t + (s.nutrition?.calories ?? 0), 0)
  const totalCaf  = filtered.reduce((t, s) => t + Math.round((s.nutrition?.caffeineGrams ?? 0) * 1000), 0)
  const avgPerDay = totalScans / days

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Insights</Text>
        <View style={s.toggle}>
          {(['7d','30d'] as Period[]).map(p => (
            <TouchableOpacity key={p} style={[s.toggleBtn, period===p && s.toggleActive]} onPress={() => setPeriod(p)}>
              <Text style={[s.toggleTxt, period===p && s.toggleActiveTxt]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Summary tiles */}
      <View style={s.tilesRow}>
        <View style={[s.tile, Shadow.sm]}>
          <Text style={s.tileEmoji}>🥤</Text>
          <Text style={s.tileVal}>{filtered.length}</Text>
          <Text style={s.tileLbl}>Drinks</Text>
        </View>
        <View style={[s.tile, Shadow.sm]}>
          <Text style={s.tileEmoji}>🔥</Text>
          <Text style={s.tileVal}>{totalCal.toLocaleString()}</Text>
          <Text style={s.tileLbl}>Calories</Text>
        </View>
        <View style={[s.tile, Shadow.sm]}>
          <Text style={s.tileEmoji}>⚡</Text>
          <Text style={s.tileVal}>{totalCaf}mg</Text>
          <Text style={s.tileLbl}>Caffeine</Text>
        </View>
        <View style={[s.tile, Shadow.sm]}>
          <Text style={s.tileEmoji}>📊</Text>
          <Text style={s.tileVal}>{avgPerDay.toFixed(1)}</Text>
          <Text style={s.tileLbl}>Per day</Text>
        </View>
      </View>

      {/* Daily bar chart */}
      <Text style={s.sectionTitle}>Daily Calories (Last 7 Days)</Text>
      <View style={[s.card, Shadow.sm]}>
        <View style={s.barChart}>
          {dailyData.map((d, i) => (
            <View key={i} style={s.barCol}>
              <Text style={s.barVal}>{d.calories > 0 ? d.calories : ''}</Text>
              <View style={s.barTrack}>
                <View style={[s.barFill, { height: `${(d.calories / maxCal) * 100}%` }]} />
              </View>
              <Text style={s.barLabel}>{d.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Drink mix */}
      <Text style={s.sectionTitle}>Your Drink Mix</Text>
      <View style={[s.card, Shadow.sm]}>
        {topCats.length === 0 ? (
          <Text style={s.noData}>No data yet — start scanning!</Text>
        ) : topCats.map(([cat, count]) => {
          const pct = count / totalScans
          return (
            <View key={cat} style={s.mixRow}>
              <Text style={s.mixEmoji}>{CATEGORY_EMOJI[cat] ?? '🥤'}</Text>
              <View style={{ flex: 1 }}>
                <View style={s.mixLabelRow}>
                  <Text style={s.mixName}>{cat.replace('_', ' ')}</Text>
                  <Text style={s.mixCount}>{count}x · {Math.round(pct * 100)}%</Text>
                </View>
                <View style={s.mixBar}>
                  <View style={[s.mixFill, {
                    width: `${pct * 100}%`,
                    backgroundColor: CATEGORY_COLOR[cat] ?? Colors.primary,
                  }]} />
                </View>
              </View>
            </View>
          )
        })}
      </View>

      {/* Caffeine pattern */}
      <Text style={s.sectionTitle}>Caffeine by Day</Text>
      <View style={[s.card, Shadow.sm]}>
        {dailyData.map((d, i) => {
          const dayCaf = scans
            .filter(s => s.timestamp?.slice(0, 10) === new Date(Date.now() - (6-i)*86400000).toISOString().slice(0,10))
            .reduce((t, s) => t + Math.round((s.nutrition?.caffeineGrams ?? 0) * 1000), 0)
          const maxCaf = 400
          return (
            <View key={i} style={s.cafRow}>
              <Text style={s.cafDay}>{d.label}</Text>
              <View style={s.cafTrack}>
                <View style={[s.cafFill, {
                  width: `${Math.min(dayCaf/maxCaf,1)*100}%`,
                  backgroundColor: dayCaf > maxCaf * 0.8 ? Colors.warning : Colors.purple,
                }]} />
              </View>
              <Text style={s.cafVal}>{dayCaf}mg</Text>
            </View>
          )
        })}
        <Text style={s.cafLimit}>400mg daily limit recommended</Text>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: Colors.bg },
  content:       { paddingBottom: 24 },
  header:        { backgroundColor: Colors.primary, paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:   { color: '#fff', fontSize: 24, fontWeight: '800' },
  toggle:        { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 3 },
  toggleBtn:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18 },
  toggleActive:  { backgroundColor: '#fff' },
  toggleTxt:     { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  toggleActiveTxt:{ color: Colors.primary },
  tilesRow:      { flexDirection: 'row', margin: 16, gap: 8 },
  tile:          { flex: 1, backgroundColor: '#fff', borderRadius: Radius.md, padding: 12, alignItems: 'center', gap: 4 },
  tileEmoji:     { fontSize: 20 },
  tileVal:       { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  tileLbl:       { fontSize: 10, color: Colors.textSecond },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginHorizontal: 16, marginBottom: 8 },
  card:          { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, marginBottom: 16 },
  barChart:      { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 6 },
  barCol:        { flex: 1, alignItems: 'center', gap: 4 },
  barVal:        { fontSize: 8, color: Colors.textSecond },
  barTrack:      { flex: 1, width: '80%', backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill:       { backgroundColor: Colors.accent, borderRadius: 4 },
  barLabel:      { fontSize: 10, color: Colors.textSecond },
  noData:        { color: Colors.textMuted, textAlign: 'center', paddingVertical: 16 },
  mixRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  mixEmoji:      { fontSize: 20, width: 28 },
  mixLabelRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  mixName:       { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, textTransform: 'capitalize' },
  mixCount:      { fontSize: 12, color: Colors.textSecond },
  mixBar:        { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  mixFill:       { height: 6, borderRadius: 3 },
  cafRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  cafDay:        { width: 30, fontSize: 12, color: Colors.textSecond, fontWeight: '600' },
  cafTrack:      { flex: 1, height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  cafFill:       { height: 8, borderRadius: 4 },
  cafVal:        { width: 42, fontSize: 11, color: Colors.textSecond, textAlign: 'right' },
  cafLimit:      { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 8 },
})
