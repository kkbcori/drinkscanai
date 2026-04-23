import React, { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { getRecentScans } from '../db/historyDB'
import { Colors, CATEGORY_EMOJI, CATEGORY_COLOR, Shadow, Radius } from '../theme'

export default function LogScreen() {
  const [scans, setScans]   = useState<any[]>([])
  const [search, setSearch] = useState('')

  useFocusEffect(useCallback(() => {
    setScans(getRecentScans(100))
  }, []))

  const filtered = search
    ? scans.filter(s => s.identification?.drinkName?.toLowerCase().includes(search.toLowerCase()))
    : scans

  // Group by date
  const groups: Record<string, any[]> = {}
  filtered.forEach(s => {
    const d = s.timestamp?.slice(0, 10) ?? 'Unknown'
    if (!groups[d]) groups[d] = []
    groups[d].push(s)
  })

  const formatDate = (d: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    if (d === today) return 'Today'
    if (d === yesterday) return 'Yesterday'
    return new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  }

  const dayTotal = (items: any[]) => ({
    cal: items.reduce((t, s) => t + (s.nutrition?.calories ?? 0), 0),
    caf: items.reduce((t, s) => t + Math.round((s.nutrition?.caffeineGrams ?? 0) * 1000), 0),
    vol: items.reduce((t, s) => t + (s.volume?.liquidVolumeMl ?? 0), 0),
  })

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Drink Log</Text>
        <Text style={s.headerSub}>{scans.length} total scans</Text>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          placeholder="Search drinks..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={s.clearBtn}>
            <Text style={{ color: Colors.textSecond }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {Object.keys(groups).length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 48 }}>📋</Text>
            <Text style={s.emptyTitle}>No scans yet</Text>
            <Text style={s.emptySub}>Your drink history will appear here</Text>
          </View>
        ) : Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0])).map(([date, items]) => {
          const totals = dayTotal(items)
          return (
            <View key={date}>
              {/* Day header */}
              <View style={s.dayHeader}>
                <Text style={s.dayTitle}>{formatDate(date)}</Text>
                <Text style={s.dayMeta}>
                  {totals.cal} cal · {totals.caf}mg caffeine · {(totals.vol/1000).toFixed(1)}L
                </Text>
              </View>

              {items.map((scan, i) => (
                <View key={scan.scanId ?? i} style={[s.scanCard, Shadow.sm]}>
                  <View style={[s.scanIcon, { backgroundColor: (CATEGORY_COLOR[scan.identification?.category] ?? Colors.primary) + '20' }]}>
                    <Text style={s.scanEmoji}>{CATEGORY_EMOJI[scan.identification?.category] ?? '🥤'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.scanTop}>
                      <Text style={s.scanName}>{scan.identification?.drinkName ?? 'Unknown'}</Text>
                      <Text style={s.scanTime}>
                        {new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <View style={s.scanStats}>
                      <Chip label={`${scan.nutrition?.calories ?? 0} cal`} color={Colors.danger} />
                      <Chip label={`${scan.volume?.liquidVolumeMl ?? 0}ml`} color={Colors.primary} />
                      {(scan.nutrition?.caffeineGrams ?? 0) > 0 && (
                        <Chip label={`${Math.round((scan.nutrition?.caffeineGrams ?? 0) * 1000)}mg ⚡`} color={Colors.purple} />
                      )}
                    </View>
                    {scan.userCorrection && (
                      <Text style={s.corrected}>✏️ Corrected</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <View style={[chip.wrap, { backgroundColor: color + '15' }]}>
      <Text style={[chip.text, { color }]}>{label}</Text>
    </View>
  )
}

const chip = StyleSheet.create({
  wrap: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginRight: 4 },
  text: { fontSize: 11, fontWeight: '600' },
})

const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: Colors.bg },
  header:      { backgroundColor: Colors.primary, paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  headerSub:   { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  searchWrap:  { margin: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: Radius.md, paddingHorizontal: 14, ...Shadow.sm },
  search:      { flex: 1, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary },
  clearBtn:    { padding: 8 },
  dayHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 16, paddingVertical: 8 },
  dayTitle:    { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  dayMeta:     { fontSize: 12, color: Colors.textSecond },
  scanCard:    { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#fff', borderRadius: Radius.md, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  scanIcon:    { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  scanEmoji:   { fontSize: 22 },
  scanTop:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  scanName:    { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  scanTime:    { fontSize: 12, color: Colors.textMuted },
  scanStats:   { flexDirection: 'row', flexWrap: 'wrap' },
  corrected:   { fontSize: 11, color: Colors.warning, marginTop: 4 },
  empty:       { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptySub:    { fontSize: 14, color: Colors.textSecond },
})
