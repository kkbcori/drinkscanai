import React, { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Switch, Alert, TextInput,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { getGoals, saveGoals } from '../db/goalsDB'
import { Colors, Shadow, Radius } from '../theme'

const GOAL_TYPES = [
  { id: 'health',    label: '💪 General Health',    cal: 2000, caf: 300, water: 2000 },
  { id: 'active',   label: '🏃 Active Lifestyle',   cal: 2500, caf: 400, water: 2500 },
  { id: 'keto',     label: '🥑 Keto / Low Carb',    cal: 1800, caf: 200, water: 2000 },
  { id: 'custom',   label: '⚙️  Custom Goals',       cal: 0,    caf: 0,   water: 0    },
]

export default function ProfileScreen() {
  const [goals, setGoals]         = useState(getGoals())
  const [editing, setEditing]     = useState(false)
  const [localCal, setLocalCal]   = useState('')
  const [localCaf, setLocalCaf]   = useState('')
  const [localWater, setLocalWater] = useState('')

  useFocusEffect(useCallback(() => {
    const g = getGoals()
    setGoals(g)
    setLocalCal(String(g.dailyCalories))
    setLocalCaf(String(g.dailyCaffeineMg))
    setLocalWater(String(g.dailyWaterMl))
  }, []))

  const pickGoalType = (type: typeof GOAL_TYPES[0]) => {
    if (type.id === 'custom') {
      setEditing(true)
      return
    }
    const updated = {
      ...goals,
      goalType: type.id,
      dailyCalories: type.cal,
      dailyCaffeineMg: type.caf,
      dailyWaterMl: type.water,
    }
    setGoals(updated)
    saveGoals(updated)
    Alert.alert('✅ Goals Updated', `Set to ${type.label}`)
  }

  const saveCustom = () => {
    const updated = {
      ...goals,
      goalType: 'custom',
      dailyCalories: parseInt(localCal) || 2000,
      dailyCaffeineMg: parseInt(localCaf) || 400,
      dailyWaterMl: parseInt(localWater) || 2000,
    }
    setGoals(updated)
    saveGoals(updated)
    setEditing(false)
    Alert.alert('✅ Goals Saved')
  }

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.avatar}>
          <Text style={s.avatarEmoji}>🧑</Text>
        </View>
        <Text style={s.name}>My Profile</Text>
        <View style={s.streakRow}>
          <Text style={s.streakTxt}>🔥 {goals.streakDays} day streak</Text>
        </View>
      </View>

      {/* Current goals summary */}
      <Text style={s.sectionTitle}>Daily Goals</Text>
      <View style={[s.card, Shadow.sm]}>
        <GoalRow emoji="🔥" label="Calories" value={`${goals.dailyCalories} kcal`} color={Colors.danger} />
        <GoalRow emoji="⚡" label="Caffeine limit" value={`${goals.dailyCaffeineMg} mg`} color={Colors.purple} />
        <GoalRow emoji="💧" label="Hydration" value={`${(goals.dailyWaterMl/1000).toFixed(1)} L`} color={Colors.primary} />
        <GoalRow emoji="🥤" label="Daily drinks" value={`${goals.dailyDrinks} drinks`} color={Colors.success} last />
      </View>

      {/* Goal presets */}
      <Text style={s.sectionTitle}>Goal Type</Text>
      <View style={[s.card, Shadow.sm]}>
        {GOAL_TYPES.map(type => (
          <TouchableOpacity
            key={type.id}
            style={[s.goalType, goals.goalType === type.id && s.goalTypeActive]}
            onPress={() => pickGoalType(type)}
          >
            <Text style={s.goalTypeLabel}>{type.label}</Text>
            {goals.goalType === type.id && <Text style={s.goalTypeTick}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom goals editor */}
      {editing && (
        <View style={[s.card, Shadow.sm]}>
          <Text style={[s.sectionTitle, { marginHorizontal: 0, marginBottom: 12 }]}>Custom Goals</Text>
          <InputRow label="Daily Calories (kcal)" value={localCal} onChange={setLocalCal} />
          <InputRow label="Caffeine Limit (mg)" value={localCaf} onChange={setLocalCaf} />
          <InputRow label="Daily Water (ml)" value={localWater} onChange={setLocalWater} />
          <TouchableOpacity style={s.saveBtn} onPress={saveCustom}>
            <Text style={s.saveBtnTxt}>Save Custom Goals</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* About */}
      <Text style={s.sectionTitle}>About</Text>
      <View style={[s.card, Shadow.sm]}>
        <InfoRow label="App Version"   value="1.0.0" />
        <InfoRow label="Model Version" value="heuristic_v1" />
        <InfoRow label="Storage"       value="On-device (private)" />
        <InfoRow label="Cloud Sync"    value="Coming in Phase 2" last />
      </View>

      <View style={{ height: 48 }} />
    </ScrollView>
  )
}

function GoalRow({ emoji, label, value, color, last }: any) {
  return (
    <View style={[gr.row, !last && gr.border]}>
      <Text style={gr.emoji}>{emoji}</Text>
      <Text style={gr.label}>{label}</Text>
      <View style={[gr.badge, { backgroundColor: color + '15' }]}>
        <Text style={[gr.value, { color }]}>{value}</Text>
      </View>
    </View>
  )
}
const gr = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  border:{ borderBottomWidth: 1, borderBottomColor: Colors.border },
  emoji: { fontSize: 20, width: 32 },
  label: { flex: 1, fontSize: 15, color: Colors.textPrimary },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  value: { fontSize: 14, fontWeight: '700' },
})

function InputRow({ label, value, onChange }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, color: Colors.textSecond, marginBottom: 4 }}>{label}</Text>
      <TextInput
        style={inp.input}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
      />
    </View>
  )
}
const inp = StyleSheet.create({
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 12, fontSize: 15, color: Colors.textPrimary },
})

function InfoRow({ label, value, last }: any) {
  return (
    <View style={[gr.row, !last && gr.border]}>
      <Text style={gr.label}>{label}</Text>
      <Text style={{ fontSize: 13, color: Colors.textSecond }}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  screen:         { flex: 1, backgroundColor: Colors.bg },
  header:         { backgroundColor: Colors.primary, paddingTop: 60, paddingBottom: 32, alignItems: 'center' },
  avatar:         { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarEmoji:    { fontSize: 40 },
  name:           { color: '#fff', fontSize: 22, fontWeight: '800' },
  streakRow:      { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginTop: 8 },
  streakTxt:      { color: '#fff', fontSize: 14, fontWeight: '600' },
  sectionTitle:   { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginHorizontal: 16, marginTop: 20, marginBottom: 8 },
  card:           { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, marginBottom: 4 },
  goalType:       { paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border },
  goalTypeActive: { backgroundColor: Colors.accentSoft, marginHorizontal: -16, paddingHorizontal: 16, borderBottomColor: Colors.border },
  goalTypeLabel:  { fontSize: 15, color: Colors.textPrimary },
  goalTypeTick:   { color: Colors.primary, fontSize: 16, fontWeight: '700' },
  saveBtn:        { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnTxt:     { color: '#fff', fontSize: 16, fontWeight: '700' },
})
