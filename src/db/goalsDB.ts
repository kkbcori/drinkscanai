/**
 * User goals and profile — stored in SQLite, Supabase-ready
 */
import { open } from '@op-engineering/op-sqlite'

let db: any = null

function getDB() {
  if (!db) {
    db = open({ name: 'drinkscanai.db' })
    db.execute(`
      CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY,
        daily_calories INTEGER DEFAULT 2000,
        daily_caffeine_mg INTEGER DEFAULT 400,
        daily_water_ml INTEGER DEFAULT 2000,
        daily_drinks INTEGER DEFAULT 8,
        goal_type TEXT DEFAULT 'health',
        streak_days INTEGER DEFAULT 0,
        last_log_date TEXT DEFAULT '',
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `)
    const existing = db.execute('SELECT id FROM goals WHERE id=1')
    if (!(existing?.rows?.length > 0)) {
      db.execute(`INSERT INTO goals (id) VALUES (1)`)
    }
  }
  return db
}

export function getGoals() {
  try {
    const r = getDB().execute('SELECT * FROM goals WHERE id=1')
    const row = r?.rows?.[0]
    return {
      dailyCalories:   row?.daily_calories   ?? 2000,
      dailyCaffeineMg: row?.daily_caffeine_mg ?? 400,
      dailyWaterMl:    row?.daily_water_ml    ?? 2000,
      dailyDrinks:     row?.daily_drinks      ?? 8,
      goalType:        row?.goal_type         ?? 'health',
      streakDays:      row?.streak_days       ?? 0,
      lastLogDate:     row?.last_log_date     ?? '',
    }
  } catch { return { dailyCalories: 2000, dailyCaffeineMg: 400, dailyWaterMl: 2000, dailyDrinks: 8, goalType: 'health', streakDays: 0, lastLogDate: '' } }
}

export function saveGoals(goals: Partial<ReturnType<typeof getGoals>>) {
  try {
    getDB().execute(`
      UPDATE goals SET
        daily_calories=?, daily_caffeine_mg=?, daily_water_ml=?,
        daily_drinks=?, goal_type=?, updated_at=datetime('now')
      WHERE id=1
    `, [
      goals.dailyCalories ?? 2000,
      goals.dailyCaffeineMg ?? 400,
      goals.dailyWaterMl ?? 2000,
      goals.dailyDrinks ?? 8,
      goals.goalType ?? 'health',
    ])
  } catch(e) { console.error(e) }
}

export function updateStreak() {
  try {
    const goals = getGoals()
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    let streak = goals.streakDays
    if (goals.lastLogDate === yesterday) streak += 1
    else if (goals.lastLogDate !== today) streak = 1
    getDB().execute(
      `UPDATE goals SET streak_days=?, last_log_date=? WHERE id=1`,
      [streak, today]
    )
    return streak
  } catch { return 0 }
}
