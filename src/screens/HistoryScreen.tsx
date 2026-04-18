import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { getHistory, LogEntry, clearHistory } from '../db/historyDB'

export default function HistoryScreen() {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [totals, setTotals] = useState({ calories: 0, caffeine: 0, carbs: 0 })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const data = await getHistory()
    setEntries(data)
    const t = data.reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories,
        caffeine: acc.caffeine + e.caffeine_mg,
        carbs: acc.carbs + e.carbs_g,
      }),
      { calories: 0, caffeine: 0, carbs: 0 }
    )
    setTotals(t)
  }

  async function handleClear() {
    await clearHistory()
    setEntries([])
    setTotals({ calories: 0, caffeine: 0, carbs: 0 })
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <View style={styles.container}>
      {/* Daily summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.dateLabel}>{today}</Text>
        <View style={styles.summaryGrid}>
          <SummaryCell label="Calories" value={Math.round(totals.calories)} unit="kcal" color="#E85D24" />
          <SummaryCell label="Caffeine" value={Math.round(totals.caffeine)} unit="mg" color="#534AB7" />
          <SummaryCell label="Carbs" value={Math.round(totals.carbs * 10) / 10} unit="g" color="#BA7517" />
        </View>
      </View>

      {/* Entry list */}
      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No scans yet today</Text>
          <Text style={styles.emptySubText}>Head to the Scan tab to log your first drink</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => <EntryRow entry={item} />}
          ListFooterComponent={
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <Text style={styles.clearBtnText}>Clear today's history</Text>
            </TouchableOpacity>
          }
        />
      )}
    </View>
  )
}

function SummaryCell({
  label, value, unit, color
}: { label: string; value: number; unit: string; color: string }) {
  return (
    <View style={styles.summaryCell}>
      <Text style={[styles.summaryCellValue, { color }]}>{value}</Text>
      <Text style={styles.summaryCellUnit}>{unit}</Text>
      <Text style={styles.summaryCellLabel}>{label}</Text>
    </View>
  )
}

function EntryRow({ entry }: { entry: LogEntry }) {
  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return (
    <View style={styles.entryRow}>
      <View style={styles.entryLeft}>
        <Text style={styles.entryName}>{entry.drink_name}</Text>
        <Text style={styles.entryMeta}>{entry.volume_ml}ml · {time}</Text>
      </View>
      <View style={styles.entryRight}>
        <Text style={styles.entryCalories}>{entry.calories} kcal</Text>
        <Text style={styles.entryCaffeine}>{entry.caffeine_mg}mg caffeine</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f0' },
  summaryCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  dateLabel: { fontSize: 13, color: '#888', marginBottom: 12 },
  summaryGrid: { flexDirection: 'row', gap: 10 },
  summaryCell: {
    flex: 1,
    backgroundColor: '#f5f5f0',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  summaryCellValue: { fontSize: 22, fontWeight: '600' },
  summaryCellUnit: { fontSize: 11, color: '#888' },
  summaryCellLabel: { fontSize: 11, color: '#666', marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 16, fontWeight: '500', color: '#1a1a1a', marginBottom: 8 },
  emptySubText: { fontSize: 13, color: '#888', textAlign: 'center' },
  entryRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.07)',
  },
  entryLeft: { flex: 1 },
  entryName: { fontSize: 14, fontWeight: '500', color: '#1a1a1a', marginBottom: 2 },
  entryMeta: { fontSize: 12, color: '#888' },
  entryRight: { alignItems: 'flex-end' },
  entryCalories: { fontSize: 15, fontWeight: '600', color: '#E85D24' },
  entryCaffeine: { fontSize: 11, color: '#888', marginTop: 2 },
  clearBtn: { marginTop: 8, alignItems: 'center', padding: 12 },
  clearBtnText: { fontSize: 13, color: '#999' },
})
