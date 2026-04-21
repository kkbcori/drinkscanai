import React, { useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { getRecentScans, getTodayStats } from '../db/historyDB'
import type { ScanHistoryItem } from '../types'

const CATEGORY_EMOJI: Record<string, string> = {
  coffee:       '☕',
  tea:          '🍵',
  juice:        '🥤',
  soda:         '🫧',
  water:        '💧',
  milk:         '🥛',
  alcohol:      '🍺',
  smoothie:     '🥝',
  energy_drink: '⚡',
  unknown:      '❓',
}

export default function HistoryScreen() {
  const [scans, setScans] = useState<ScanHistoryItem[]>([])
  const [todayStats, setTodayStats] = useState({
    scanCount: 0,
    totalCalories: 0,
    totalCaffeineMg: 0,
    totalVolumeMl: 0,
  })
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(() => {
    setScans(getRecentScans(50))
    setTodayStats(getTodayStats())
  }, [])

  // Reload when tab gains focus
  useFocusEffect(useCallback(() => {
    loadData()
  }, [loadData]))

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    loadData()
    setRefreshing(false)
  }, [loadData])

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  const renderHeader = () => (
    <View>
      {/* Today's summary */}
      <View style={styles.todayCard}>
        <Text style={styles.todayTitle}>Today's Summary</Text>
        <View style={styles.todayStats}>
          <View style={styles.todayStat}>
            <Text style={styles.todayStatValue}>{todayStats.scanCount}</Text>
            <Text style={styles.todayStatLabel}>Drinks</Text>
          </View>
          <View style={styles.todayDivider} />
          <View style={styles.todayStat}>
            <Text style={[styles.todayStatValue, { color: '#FF6B35' }]}>
              {todayStats.totalCalories}
            </Text>
            <Text style={styles.todayStatLabel}>Calories</Text>
          </View>
          <View style={styles.todayDivider} />
          <View style={styles.todayStat}>
            <Text style={[styles.todayStatValue, { color: '#6B35FF' }]}>
              {todayStats.totalCaffeineMg}mg
            </Text>
            <Text style={styles.todayStatLabel}>Caffeine</Text>
          </View>
          <View style={styles.todayDivider} />
          <View style={styles.todayStat}>
            <Text style={[styles.todayStatValue, { color: '#007AFF' }]}>
              {todayStats.totalVolumeMl}ml
            </Text>
            <Text style={styles.todayStatLabel}>Volume</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent Scans</Text>
    </View>
  )

  const renderItem = ({ item }: { item: ScanHistoryItem }) => (
    <View style={styles.scanItem}>
      <View style={styles.scanEmoji}>
        <Text style={styles.emoji}>
          {CATEGORY_EMOJI[item.identification.category] ?? '❓'}
        </Text>
      </View>
      <View style={styles.scanInfo}>
        <View style={styles.scanRow}>
          <Text style={styles.drinkName}>{item.identification.drinkName}</Text>
          <Text style={styles.scanTime}>{formatTime(item.timestamp)}</Text>
        </View>
        <View style={styles.scanRow}>
          <Text style={styles.scanMeta}>
            {item.volume.liquidVolumeMl}ml · {item.nutrition.calories} cal
            {item.nutrition.caffeineGrams > 0
              ? ` · ${Math.round(item.nutrition.caffeineGrams * 1000)}mg caffeine`
              : ''}
          </Text>
          <Text style={styles.scanDate}>{formatDate(item.timestamp)}</Text>
        </View>
        {item.userCorrection && (
          <Text style={styles.correctionNote}>✏️ Corrected from original scan</Text>
        )}
        {!item.userConfirmed && !item.userCorrection && (
          <Text style={styles.pendingNote}>⏳ Unconfirmed</Text>
        )}
      </View>
    </View>
  )

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>🥤</Text>
      <Text style={styles.emptyTitle}>No scans yet</Text>
      <Text style={styles.emptySub}>
        Go to the Scan tab and scan your first drink!
      </Text>
    </View>
  )

  return (
    <View style={styles.container}>
      <FlatList
        data={scans}
        keyExtractor={item => item.scanId}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={scans.length === 0 ? styles.emptyList : undefined}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f5f5f5' },
  todayCard:        { backgroundColor: '#007AFF', margin: 16, borderRadius: 20, padding: 20 },
  todayTitle:       { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },
  todayStats:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayStat:        { alignItems: 'center', flex: 1 },
  todayStatValue:   { fontSize: 22, fontWeight: '800', color: '#fff' },
  todayStatLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  todayDivider:     { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.3)' },
  sectionTitle:     { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginHorizontal: 16, marginBottom: 8 },
  scanItem:         { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center' },
  scanEmoji:        { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  emoji:            { fontSize: 24 },
  scanInfo:         { flex: 1 },
  scanRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  drinkName:        { fontSize: 16, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  scanTime:         { fontSize: 13, color: '#888' },
  scanMeta:         { fontSize: 13, color: '#666', flex: 1 },
  scanDate:         { fontSize: 12, color: '#aaa' },
  correctionNote:   { fontSize: 11, color: '#FF9500', marginTop: 4 },
  pendingNote:      { fontSize: 11, color: '#aaa', marginTop: 4 },
  emptyList:        { flexGrow: 1 },
  emptyContainer:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji:       { fontSize: 64, marginBottom: 16 },
  emptyTitle:       { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  emptySub:         { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
})
