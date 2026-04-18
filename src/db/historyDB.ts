// historyDB.ts
// Local SQLite history log.
// In production use react-native-quick-sqlite.
// This module provides the interface and in-memory store for development.

export interface LogEntry {
  id: string
  drink_name: string
  drink_id: string
  volume_ml: number
  fill_percent: number
  calories: number
  caffeine_mg: number
  carbs_g: number
  protein_g: number
  fat_g: number
  height_mm: number
  diameter_mm: number
  confidence: string
  timestamp: number
}

// In-memory store for development — replace with SQLite in production
const store: LogEntry[] = []

export async function addEntry(entry: Omit<LogEntry, 'id' | 'timestamp'>): Promise<LogEntry> {
  const full: LogEntry = {
    ...entry,
    id: Math.random().toString(36).slice(2),
    timestamp: Date.now(),
  }
  store.unshift(full)
  return full
}

export async function getHistory(limitToToday = true): Promise<LogEntry[]> {
  if (!limitToToday) return [...store]
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  return store.filter(e => e.timestamp >= startOfDay.getTime())
}

export async function clearHistory(): Promise<void> {
  store.length = 0
}
