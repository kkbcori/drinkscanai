import React, { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, Alert, TextInput } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { C } from '../theme'
import { getGoals, saveGoals } from '../db/goalsDB'

const PRESETS = [
  { id:'health', label:'💪 General Health',   cal:2000, caf:300, water:2000 },
  { id:'active', label:'🏃 Active Lifestyle',  cal:2500, caf:400, water:2500 },
  { id:'keto',   label:'🥑 Low Carb / Keto',   cal:1800, caf:200, water:2000 },
  { id:'custom', label:'⚙️ Custom Goals',       cal:0,    caf:0,   water:0    },
]

export default function ProfileScreen() {
  const [goals, setGoals]     = useState(getGoals())
  const [editing, setEditing] = useState(false)
  const [cal, setCal]         = useState('')
  const [caf, setCaf]         = useState('')
  const [water, setWater]     = useState('')

  useFocusEffect(useCallback(() => {
    const g = getGoals()
    setGoals(g)
    setCal(String(g.dailyCalories))
    setCaf(String(g.dailyCaffeineMg))
    setWater(String(g.dailyWaterMl))
  }, []))

  const selectPreset = (p: typeof PRESETS[0]) => {
    if (p.id==='custom') { setEditing(true); return }
    const u = { ...goals, goalType:p.id, dailyCalories:p.cal, dailyCaffeineMg:p.caf, dailyWaterMl:p.water }
    setGoals(u); saveGoals(u)
    Alert.alert('✅ Goals Updated', p.label)
  }

  const saveCustom = () => {
    const u = { ...goals, goalType:'custom', dailyCalories:parseInt(cal)||2000, dailyCaffeineMg:parseInt(caf)||400, dailyWaterMl:parseInt(water)||2000 }
    setGoals(u); saveGoals(u); setEditing(false)
    Alert.alert('✅ Custom Goals Saved')
  }

  return (
    <ScrollView style={s.root} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.avatar}><Text style={{fontSize:44}}>🧑</Text></View>
        <Text style={s.name}>My Profile</Text>
        {goals.streakDays > 0 && <Text style={s.streak}>🔥 {goals.streakDays} day streak</Text>}
      </View>

      {/* Goals */}
      <Text style={s.section}>Daily Goals</Text>
      <View style={s.card}>
        <GoalRow icon="🔥" label="Calories" value={`${goals.dailyCalories} kcal`} color={C.gold} />
        <GoalRow icon="⚡" label="Caffeine limit" value={`${goals.dailyCaffeineMg}mg`} color={C.purple} />
        <GoalRow icon="💧" label="Hydration" value={`${(goals.dailyWaterMl/1000).toFixed(1)}L`} color={C.water} />
        <GoalRow icon="🥤" label="Daily drinks" value={`${goals.dailyDrinks??8}`} color={C.teal} last />
      </View>

      {/* Presets */}
      <Text style={s.section}>Goal Presets</Text>
      <View style={s.card}>
        {PRESETS.map(p=>(
          <TouchableOpacity key={p.id} style={[s.preset, goals.goalType===p.id&&s.presetActive]} onPress={()=>selectPreset(p)}>
            <Text style={s.presetLbl}>{p.label}</Text>
            {goals.goalType===p.id && <Text style={{color:C.teal,fontWeight:'800'}}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {editing && (
        <View style={s.card}>
          <Text style={[s.section,{marginHorizontal:0,marginBottom:14}]}>Custom Goals</Text>
          <InpRow label="Daily Calories (kcal)" value={cal} onChange={setCal} />
          <InpRow label="Caffeine Limit (mg)" value={caf} onChange={setCaf} />
          <InpRow label="Daily Water (ml)" value={water} onChange={setWater} />
          <TouchableOpacity style={s.saveBtn} onPress={saveCustom}>
            <Text style={s.saveBtnTxt}>Save Goals</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CoreML training info */}
      <Text style={s.section}>🧠 About CoreML</Text>
      <View style={s.card}>
        <Text style={s.infoTxt}>
          The app uses EfficientNet-B0 trained on ImageNet, adapted for 56 drink categories.
        </Text>
        <Text style={[s.infoTxt,{marginTop:8}]}>
          <Text style={{color:C.teal,fontWeight:'700'}}>Current accuracy: ~65%</Text>
          {'\n'}Every time you correct a misidentified drink, that correction is saved as training data.
          Once you have 500+ corrections, we can fine-tune the model for 85-92% accuracy.
        </Text>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Model</Text>
          <Text style={s.infoVal}>EfficientNet-B0 CoreML v1</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Classes</Text>
          <Text style={s.infoVal}>56 drink types</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Inference</Text>
          <Text style={s.infoVal}>~8ms Neural Engine</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Privacy</Text>
          <Text style={[s.infoVal,{color:C.green}]}>100% on-device</Text>
        </View>
      </View>

      <Text style={s.section}>App Info</Text>
      <View style={s.card}>
        <View style={s.infoRow}><Text style={s.infoLabel}>Version</Text><Text style={s.infoVal}>1.1.0</Text></View>
        <View style={s.infoRow}><Text style={s.infoLabel}>Cloud Sync</Text><Text style={[s.infoVal,{color:C.gold}]}>Phase 2 — Coming soon</Text></View>
        <View style={[s.infoRow,{borderBottomWidth:0}]}><Text style={s.infoLabel}>Storage</Text><Text style={s.infoVal}>On-device SQLite</Text></View>
      </View>
      <View style={{height:48}}/>
    </ScrollView>
  )
}

function GoalRow({icon,label,value,color,last}:any) {
  return (
    <View style={[gr.row,!last&&{borderBottomWidth:1,borderBottomColor:C.border}]}>
      <Text style={{fontSize:18,width:28}}>{icon}</Text>
      <Text style={gr.lbl}>{label}</Text>
      <View style={[gr.badge,{backgroundColor:color+'18',borderColor:color+'40'}]}>
        <Text style={[gr.val,{color}]}>{value}</Text>
      </View>
    </View>
  )
}
const gr = StyleSheet.create({
  row:{flexDirection:'row',alignItems:'center',paddingVertical:13},
  lbl:{flex:1,fontSize:15,color:C.text1},
  badge:{paddingHorizontal:10,paddingVertical:4,borderRadius:20,borderWidth:1},
  val:{fontSize:13,fontWeight:'700'},
})

function InpRow({label,value,onChange}:any) {
  return (
    <View style={{marginBottom:12}}>
      <Text style={{fontSize:12,color:C.text2,marginBottom:5}}>{label}</Text>
      <TextInput style={{borderWidth:1,borderColor:C.border,borderRadius:10,padding:11,fontSize:15,color:C.text1,backgroundColor:C.bg3}} value={value} onChangeText={onChange} keyboardType="numeric" />
    </View>
  )
}

const s = StyleSheet.create({
  root:       {flex:1,backgroundColor:C.bg1},
  header:     {backgroundColor:C.bg0,paddingTop:60,paddingBottom:32,alignItems:'center'},
  avatar:     {width:80,height:80,borderRadius:40,backgroundColor:C.bg2,alignItems:'center',justifyContent:'center',marginBottom:12,borderWidth:1,borderColor:C.border},
  name:       {fontSize:22,fontWeight:'900',color:C.text1},
  streak:     {color:C.gold,fontSize:14,fontWeight:'700',marginTop:8},
  section:    {fontSize:14,fontWeight:'800',color:C.text2,marginHorizontal:16,marginTop:20,marginBottom:8,textTransform:'uppercase',letterSpacing:1},
  card:       {marginHorizontal:16,backgroundColor:C.bg2,borderRadius:20,padding:16,borderWidth:1,borderColor:C.border},
  preset:     {paddingVertical:14,flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderBottomWidth:1,borderBottomColor:C.border},
  presetActive:{marginHorizontal:-16,paddingHorizontal:16,backgroundColor:C.teal+'12'},
  presetLbl:  {fontSize:15,color:C.text1},
  saveBtn:    {backgroundColor:C.teal,borderRadius:12,padding:14,alignItems:'center',marginTop:8},
  saveBtnTxt: {color:C.bg0,fontSize:16,fontWeight:'800'},
  infoTxt:    {fontSize:13,color:C.text2,lineHeight:20},
  infoRow:    {flexDirection:'row',justifyContent:'space-between',paddingVertical:10,borderBottomWidth:1,borderBottomColor:C.border},
  infoLabel:  {fontSize:13,color:C.text2},
  infoVal:    {fontSize:13,color:C.text1,fontWeight:'600'},
})
