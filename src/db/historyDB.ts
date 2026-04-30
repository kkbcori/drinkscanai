import { open } from '@op-engineering/op-sqlite'
import type { ScanResult, ScanHistoryItem } from '../types'

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

let db: any = null

export function initDB(): void {
  try {
    db = open({ name: 'drinkscanai.db' })
    db.execute(`
      CREATE TABLE IF NOT EXISTS scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_id TEXT NOT NULL UNIQUE,
        timestamp TEXT NOT NULL,
        drink_id TEXT NOT NULL,
        drink_name TEXT NOT NULL,
        drink_category TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0,
        model_version TEXT NOT NULL DEFAULT 'unknown',
        total_volume_ml REAL NOT NULL DEFAULT 0,
        fill_level_pct REAL NOT NULL DEFAULT 0,
        liquid_volume_ml REAL NOT NULL DEFAULT 0,
        volume_method TEXT NOT NULL DEFAULT 'fallback',
        calories REAL NOT NULL DEFAULT 0,
        caffeine_grams REAL NOT NULL DEFAULT 0,
        carbs_grams REAL NOT NULL DEFAULT 0,
        protein_grams REAL NOT NULL DEFAULT 0,
        fat_grams REAL NOT NULL DEFAULT 0,
        sugar_grams REAL NOT NULL DEFAULT 0,
        user_confirmed INTEGER NOT NULL DEFAULT 0,
        user_correction TEXT,
        synced_to_cloud INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    console.log('[DB] Initialized successfully')
  } catch (e) {
    console.error('[DB] Init error:', e)
  }
}

export function saveScan(result: ScanResult): boolean {
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
      0,
    ])
    console.log('[DB] Saved scan:', result.identification.drinkName)
    return true
  } catch (e) {
    console.error('[DB] Save error:', e)
    return false
  }
}

export function confirmScan(scanId: string): void {
  if (!db) initDB()
  try { db.execute(`UPDATE scans SET user_confirmed=1 WHERE scan_id=?`, [scanId]) }
  catch (e) { console.error('[DB] Confirm error:', e) }
}

export function updateCorrection(scanId: string, drinkName: string): void {
  if (!db) initDB()
  try { db.execute(`UPDATE scans SET user_correction=?, user_confirmed=0 WHERE scan_id=?`, [drinkName, scanId]) }
  catch (e) { console.error('[DB] Correction error:', e) }
}

export function getRecentScans(limit = 100): ScanHistoryItem[] {
  if (!db) initDB()
  try {
    const r = db.execute(`SELECT * FROM scans ORDER BY created_at DESC LIMIT ?`, [limit])
    const rows = r?.rows ?? r?.rows?._array ?? []
    return rows.map((row: any) => ({
      id: row.id,
      scanId: row.scan_id,
      timestamp: row.timestamp,
      identification: {
        drinkId: row.drink_id, drinkName: row.drink_name,
        category: row.drink_category, confidence: row.confidence,
        modelVersion: row.model_version,
      },
      volume: {
        totalVolumeMl: row.total_volume_ml, fillLevelPct: row.fill_level_pct,
        liquidVolumeMl: row.liquid_volume_ml, method: row.volume_method,
      },
      nutrition: {
        calories: row.calories, caffeineGrams: row.caffeine_grams,
        carbsGrams: row.carbs_grams, proteinGrams: row.protein_grams,
        fatGrams: row.fat_grams, sugarGrams: row.sugar_grams,
      },
      userConfirmed: row.user_confirmed === 1,
      userCorrection: row.user_correction ?? undefined,
      syncedToCloud: false,
    }))
  } catch (e) {
    console.error('[DB] Get scans error:', e)
    return []
  }
}

export function getTodayStats() {
  if (!db) initDB()
  try {
    const r = db.execute(`
      SELECT COUNT(*) as cnt,
             COALESCE(SUM(calories),0) as cal,
             COALESCE(SUM(caffeine_grams*1000),0) as caf,
             COALESCE(SUM(liquid_volume_ml),0) as vol
      FROM scans WHERE date(created_at)=date('now')
    `)
    const rows = r?.rows ?? r?.rows?._array ?? []
    const row = rows[0] ?? {}
    return {
      scanCount: row.cnt ?? 0,
      totalCalories: Math.round(row.cal ?? 0),
      totalCaffeineMg: Math.round(row.caf ?? 0),
      totalVolumeMl: Math.round(row.vol ?? 0),
    }
  } catch (e) {
    return { scanCount:0, totalCalories:0, totalCaffeineMg:0, totalVolumeMl:0 }
  }
}

export function generateScanId(): string { return generateUUID() }
