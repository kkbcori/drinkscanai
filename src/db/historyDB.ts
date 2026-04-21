/**
 * Local Scan History Database
 * Schema is Supabase-ready for Phase 2 sync.
 */

import { open } from 'react-native-quick-sqlite'
import type { ScanResult, ScanHistoryItem } from '../types'

// Simple UUID generator — no external deps needed
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

let db: any = null

export function initDB(): void {
  try {
    db = open({ name: 'drinkscanai.db' })
    db.execute(`
      CREATE TABLE IF NOT EXISTS scans (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_id           TEXT NOT NULL UNIQUE,
        timestamp         TEXT NOT NULL,
        drink_id          TEXT NOT NULL,
        drink_name        TEXT NOT NULL,
        drink_category    TEXT NOT NULL,
        confidence        REAL NOT NULL,
        model_version     TEXT NOT NULL,
        total_volume_ml   REAL NOT NULL,
        fill_level_pct    REAL NOT NULL,
        liquid_volume_ml  REAL NOT NULL,
        volume_method     TEXT NOT NULL,
        calories          REAL NOT NULL,
        caffeine_grams    REAL NOT NULL,
        carbs_grams       REAL NOT NULL,
        protein_grams     REAL NOT NULL,
        fat_grams         REAL NOT NULL,
        sugar_grams       REAL NOT NULL,
        user_confirmed    INTEGER NOT NULL DEFAULT 0,
        user_correction   TEXT,
        synced_to_cloud   INTEGER NOT NULL DEFAULT 0,
        created_at        TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
  } catch (e) {
    console.error('DB init error:', e)
  }
}

export function saveScan(result: ScanResult): void {
  if (!db) initDB()
  try {
    db.execute(`
      INSERT OR REPLACE INTO scans (
        scan_id, timestamp,
        drink_id, drink_name, drink_category, confidence, model_version,
        total_volume_ml, fill_level_pct, liquid_volume_ml, volume_method,
        calories, caffeine_grams, carbs_grams, protein_grams, fat_grams, sugar_grams,
        user_confirmed, user_correction, synced_to_cloud
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      result.scanId, result.timestamp,
      result.identification.drinkId, result.identification.drinkName,
      result.identification.category, result.identification.confidence,
      result.identification.modelVersion,
      result.volume.totalVolumeMl, result.volume.fillLevelPct,
      result.volume.liquidVolumeMl, result.volume.method,
      result.nutrition.calories, result.nutrition.caffeineGrams,
      result.nutrition.carbsGrams, result.nutrition.proteinGrams,
      result.nutrition.fatGrams, result.nutrition.sugarGrams,
      result.userConfirmed ? 1 : 0,
      result.userCorrection ?? null,
      result.syncedToCloud ? 1 : 0,
    ])
  } catch (e) {
    console.error('Save scan error:', e)
  }
}

export function updateCorrection(scanId: string, correction: string): void {
  if (!db) initDB()
  db?.execute(
    `UPDATE scans SET user_correction=?, user_confirmed=0 WHERE scan_id=?`,
    [correction, scanId]
  )
}

export function confirmScan(scanId: string): void {
  if (!db) initDB()
  db?.execute(`UPDATE scans SET user_confirmed=1 WHERE scan_id=?`, [scanId])
}

export function getRecentScans(limit = 50): ScanHistoryItem[] {
  if (!db) initDB()
  try {
    const result = db?.execute(
      `SELECT * FROM scans ORDER BY created_at DESC LIMIT ?`, [limit]
    )
    return (result?.rows?._array ?? []).map((row: any) => ({
      id: row.id,
      scanId: row.scan_id,
      timestamp: row.timestamp,
      identification: {
        drinkId:      row.drink_id,
        drinkName:    row.drink_name,
        category:     row.drink_category,
        confidence:   row.confidence,
        modelVersion: row.model_version,
      },
      volume: {
        totalVolumeMl:  row.total_volume_ml,
        fillLevelPct:   row.fill_level_pct,
        liquidVolumeMl: row.liquid_volume_ml,
        method:         row.volume_method,
      },
      nutrition: {
        calories:      row.calories,
        caffeineGrams: row.caffeine_grams,
        carbsGrams:    row.carbs_grams,
        proteinGrams:  row.protein_grams,
        fatGrams:      row.fat_grams,
        sugarGrams:    row.sugar_grams,
      },
      userConfirmed:  row.user_confirmed === 1,
      userCorrection: row.user_correction ?? undefined,
      syncedToCloud:  row.synced_to_cloud === 1,
    }))
  } catch (e) {
    console.error('Get scans error:', e)
    return []
  }
}

export function getTodayStats() {
  if (!db) initDB()
  try {
    const result = db?.execute(`
      SELECT
        COUNT(*) as scan_count,
        SUM(calories) as total_calories,
        SUM(caffeine_grams * 1000) as total_caffeine_mg,
        SUM(liquid_volume_ml) as total_volume_ml
      FROM scans
      WHERE date(created_at) = date('now')
    `)
    const row = result?.rows?._array?.[0]
    return {
      scanCount:       row?.scan_count ?? 0,
      totalCalories:   Math.round(row?.total_calories ?? 0),
      totalCaffeineMg: Math.round(row?.total_caffeine_mg ?? 0),
      totalVolumeMl:   Math.round(row?.total_volume_ml ?? 0),
    }
  } catch (e) {
    return { scanCount: 0, totalCalories: 0, totalCaffeineMg: 0, totalVolumeMl: 0 }
  }
}

// Phase 2: returns unsynced scans to upload to Supabase
export function getUnsyncedScans(): ScanHistoryItem[] {
  if (!db) initDB()
  try {
    const result = db?.execute(
      `SELECT * FROM scans WHERE synced_to_cloud=0 ORDER BY created_at ASC LIMIT 100`
    )
    return result?.rows?._array ?? []
  } catch (e) { return [] }
}

// Phase 2: mark records as synced after Supabase upload
export function markAsSynced(scanIds: string[]): void {
  if (!db) initDB()
  const placeholders = scanIds.map(() => '?').join(',')
  db?.execute(
    `UPDATE scans SET synced_to_cloud=1 WHERE scan_id IN (${placeholders})`,
    scanIds
  )
}

export function generateScanId(): string {
  return generateUUID()
}
