import React, { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, StatusBar,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { getRecentScans, getTodayStats } from '../db/historyDB'
import { getGoals, updateStreak } from '../db/goalsDB'
import RingProgress from '../components/RingProgress'
import { Colors, CATEGORY_EMOJI, CATEGORY_COLOR, Shadow, Radius } from '../theme'

export default function TodayScreen({ navigation }: any) {
  const [stats, setStats]   = useState({ scanCount: 0, totalCalories: 0, totalCaffeineMg: 0, totalVolumeMl: 0 })
  const [goals, setGoals]   = useState({ dailyCalories: 2000, dailyCaffeineMg: 400, dailyWaterMl: 2000, dailyDrinks: 8, streakDays: 0 })
  const [scans, setScans]   = useState<any[]>([])

  useFocusEffect(useCallback(() => {
    const s = getTodayStats()
    const g = getGoals()
    const streak = updateStreak()
    setStats(s)
    setGoals({ ...g, streakDays: streak })
    setScans(getRecentScans(5))
  }, []))

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const calPct     = Math.min(stats.totalCalories / goals.dailyCalories, 1)
  const cafPct     = Math.min(stats.totalCaffeineMg / goals.dailyCaffeineMg, 1)
  const waterPct   = Math.min(stats.totalVolumeMl / goals.dailyWaterMl, 1)
  const drinksPct  = Math.min(stats.scanCount / goals.dailyDrinks, 1)
  const calLeft    = Math.max(goals.dailyCalories - stats.totalCalories, 0)

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerDate}>{today}</Text>
          <Text style={s.headerTitle}>Good {greeting()} 👋</Text>
        </View>
        <TouchableOpacity style={s.streakBadge}>
          <Text style={s.streakFire}>🔥</Text>
          <Text style={s.streakNum}>{goals.streakDays}</Text>
          <Text style={s.streakLabel}>day streak</Text>
        </TouchableOpacity>
      </View>

      {/* Calorie hero card */}
      <View style={[s.heroCard, Shadow.md]}>
        <View style={s.heroLeft}>
          <Text style={s.heroLabel}>Calories remaining</Text>
          <Text style={s.heroValue}>{calLeft.toLocaleString()}</Text>
          <View style={s.heroRow}>
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{goals.dailyCalories.toLocaleString()}</Text>
              <Text style={s.heroStatLbl}>goal</Text>
            </View>
            <Text style={s.heroDivider}>−</Text>
            <View style={s.heroStat}>
              <Text style={[s.heroStatVal, { color: Colors.danger }]}>{stats.totalCalories}</Text>
              <Text style={s.heroStatLbl}>consumed</Text>
            </View>
          </View>
        </View>
        <RingProgress
          size={100} strokeWidth={10}
          progress={calPct} color={calPct > 0.9 ? Colors.danger : Colors.accent}
          value={`${Math.round(calPct * 100)}`} unit="%" label="of goal"
        />
      </View>

      {/* Rings row */}
      <Text style={s.sectionTitle}>Today's Goals</Text>
      <View style={[s.card, s.ringsRow, Shadow.sm]}>
        <RingProgress size={72} strokeWidth={7} progress={cafPct}
          color={cafPct > 0.85 ? Colors.warning : Colors.coffee}
          value={`${stats.totalCaffeineMg}`} unit="mg" label="Caffeine" />
        <RingProgress size={72} strokeWidth={7} progress={waterPct}
          color={Colors.primary}
          value={`${Math.round(stats.totalVolumeMl / 1000 * 10) / 10}`} unit="L" label="Hydration" />
        <RingProgress size={72} strokeWidth={7} progress={drinksPct}
          color={Colors.success}
          value={`${stats.scanCount}`} unit={`/${goals.dailyDrinks}`} label="Drinks" />
      </View>

      {/* Quick scan CTA */}
      <TouchableOpacity
        style={[s.scanCTA, Shadow.md]}
        onPress={() => navigation.navigate('Scan')}
      >
        <Text style={s.scanCTAIcon}>📷</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.scanCTATitle}>Scan a Drink</Text>
          <Text style={s.scanCTASub}>Tap to identify & log your drink</Text>
        </View>
        <Text style={s.scanCTAArrow}>→</Text>
      </TouchableOpacity>

      {/* Caffeine warning */}
      {stats.totalCaffeineMg > goals.dailyCaffeineMg * 0.8 && (
        <View style={[s.alertCard, { borderColor: Colors.warning }]}>
          <Text style={s.alertIcon}>⚠️</Text>
          <Text style={s.alertText}>
            You've had {stats.totalCaffeineMg}mg caffeine.
            Daily limit is {goals.dailyCaffeineMg}mg.
          </Text>
        </View>
      )}

      {/* Today's drinks */}
      <Text style={s.sectionTitle}>Today's Drinks</Text>
      {scans.length === 0 ? (
        <View style={[s.card, s.empty, Shadow.sm]}>
          <Text style={{ fontSize: 40 }}>🥤</Text>
          <Text style={s.emptyText}>No drinks logged yet</Text>
          <Text style={s.emptySubtext}>Tap Scan to log your first drink</Text>
        </View>
      ) : (
        scans.map((scan, i) => (
          <View key={scan.scanId ?? i} style={[s.drinkRow, Shadow.sm]}>
            <View style={[s.drinkDot, { backgroundColor: CATEGORY_COLOR[scan.identification?.category] ?? Colors.textMuted }]}>
              <Text style={s.drinkEmoji}>{CATEGORY_EMOJI[scan.identification?.category] ?? '🥤'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.drinkName}>{scan.identification?.drinkName ?? 'Unknown'}</Text>
              <Text style={s.drinkMeta}>
                {scan.volume?.liquidVolumeMl ?? 0}ml · {scan.nutrition?.calories ?? 0} cal
                {scan.nutrition?.caffeineGrams > 0 ? ` · ${Math.round((scan.nutrition?.caffeineGrams ?? 0) * 1000)}mg caffeine` : ''}
              </Text>
            </View>
            <Text style={s.drinkTime}>{formatTime(scan.timestamp)}</Text>
          </View>
        ))
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function formatTime(ts: string) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: Colors.bg },
  content:      { paddingBottom: 24 },
  header:       { backgroundColor: Colors.primary, paddingTop: 60, paddingBottom: 24, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerDate:   { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 2 },
  headerTitle:  { color: '#fff', fontSize: 22, fontWeight: '800' },
  streakBadge:  { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 10, alignItems: 'center' },
  streakFire:   { fontSize: 20 },
  streakNum:    { color: '#fff', fontSize: 18, fontWeight: '800', lineHeight: 20 },
  streakLabel:  { color: 'rgba(255,255,255,0.7)', fontSize: 10 },
  heroCard:     { margin: 16, backgroundColor: '#fff', borderRadius: Radius.xl, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLeft:     { flex: 1 },
  heroLabel:    { color: Colors.textSecond, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  heroValue:    { color: Colors.textPrimary, fontSize: 40, fontWeight: '900', lineHeight: 44 },
  heroRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  heroStat:     { alignItems: 'center' },
  heroStatVal:  { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  heroStatLbl:  { fontSize: 10, color: Colors.textSecond },
  heroDivider:  { color: Colors.textMuted, fontSize: 18, fontWeight: '300' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginHorizontal: 16, marginBottom: 8, marginTop: 4 },
  card:         { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, marginBottom: 12 },
  ringsRow:     { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 8 },
  scanCTA:      { margin: 16, backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  scanCTAIcon:  { fontSize: 28 },
  scanCTATitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  scanCTASub:   { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },
  scanCTAArrow: { color: '#fff', fontSize: 22, fontWeight: '300' },
  alertCard:    { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#FFF8E7', borderRadius: Radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1 },
  alertIcon:    { fontSize: 20 },
  alertText:    { flex: 1, color: '#7A4100', fontSize: 13, lineHeight: 18 },
  drinkRow:     { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#fff', borderRadius: Radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  drinkDot:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  drinkEmoji:   { fontSize: 22 },
  drinkName:    { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  drinkMeta:    { fontSize: 12, color: Colors.textSecond, marginTop: 2 },
  drinkTime:    { fontSize: 12, color: Colors.textMuted },
  empty:        { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText:    { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  emptySubtext: { fontSize: 13, color: Colors.textSecond },
})
