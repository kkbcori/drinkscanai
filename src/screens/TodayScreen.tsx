import React, { useCallback, useState, useRef, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Animated, StatusBar } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { C, CATEGORY_COLOR, CATEGORY_EMOJI } from '../theme'
import { getTodayStats, getRecentScans } from '../db/historyDB'
import { getGoals } from '../db/goalsDB'

export default function TodayScreen({ navigation }: any) {
  const [stats, setStats] = useState({ scanCount:0, totalCalories:0, totalCaffeineMg:0, totalVolumeMl:0 })
  const [goals, setGoals] = useState({ dailyCalories:2000, dailyCaffeineMg:400, dailyWaterMl:2000, streakDays:0 })
  const [scans, setScans] = useState<any[]>([])

  const fadeAnim  = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  useFocusEffect(useCallback(() => {
    const s = getTodayStats()
    const g = getGoals()
    setStats(s)
    setGoals(g)
    setScans(getRecentScans(8))
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:400, useNativeDriver:true }),
      Animated.spring(slideAnim, { toValue:0, useNativeDriver:true, tension:80, friction:12 }),
    ]).start()
  }, []))

  const calLeft = Math.max(goals.dailyCalories - stats.totalCalories, 0)
  const calPct  = Math.min(stats.totalCalories / goals.dailyCalories, 1)
  const cafPct  = Math.min(stats.totalCaffeineMg / goals.dailyCaffeineMg, 1)
  const h       = new Date().getHours()
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'


  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerBg} />
          <Animated.View style={{opacity:fadeAnim, transform:[{translateY:slideAnim}]}}>
            <Text style={s.greeting}>{greeting} 👋</Text>
            <Text style={s.date}>{new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</Text>
            {goals.streakDays > 0 && (
              <View style={s.streak}>
                <Text style={s.streakTxt}>🔥 {goals.streakDays} day streak</Text>
              </View>
            )}
          </Animated.View>
        </View>

        <Animated.View style={{opacity:fadeAnim, transform:[{translateY:slideAnim}]}}>
          {/* Calorie hero */}
          <View style={s.heroCard}>
            <View style={s.heroLeft}>
              <Text style={s.heroLbl}>REMAINING TODAY</Text>
              <Text style={s.heroNum}>{calLeft.toLocaleString()}</Text>
              <Text style={s.heroUnit}>kcal</Text>
              <View style={s.heroTrack}>
                <View style={[s.heroFill, {width:`${calPct*100}%`, backgroundColor: calPct>0.9?C.red:C.teal}]} />
              </View>
              <Text style={s.heroSub}>{stats.totalCalories} of {goals.dailyCalories} consumed</Text>
            </View>
            <View style={s.heroRight}>
              <Ring value={stats.scanCount} max={goals.dailyDrinks??8} label="Drinks" color={C.teal} size={70} />
            </View>
          </View>

          {/* Stat pills */}
          <View style={s.pillsRow}>
            <Pill emoji="⚡" label="Caffeine" value={`${stats.totalCaffeineMg}mg`} max={goals.dailyCaffeineMg} color={C.purple} />
            <Pill emoji="💧" label="Volume" value={`${(stats.totalVolumeMl/1000).toFixed(1)}L`} max={goals.dailyWaterMl} color={C.water} />
          </View>

          {/* Caffeine warning */}
          {stats.totalCaffeineMg > goals.dailyCaffeineMg * 0.8 && (
            <View style={s.warn}>
              <Text style={s.warnTxt}>⚠️  {stats.totalCaffeineMg}mg caffeine — approaching daily limit of {goals.dailyCaffeineMg}mg</Text>
            </View>
          )}

          {/* Scan CTA */}
          <TouchableOpacity style={s.scanCTA} onPress={() => navigation.navigate('Scan')} activeOpacity={0.85}>
            <View style={s.scanCTAIcon}><Text style={{fontSize:28}}>📷</Text></View>
            <View style={{flex:1}}>
              <Text style={s.scanCTATitle}>Scan a Drink</Text>
              <Text style={s.scanCTASub}>Identify & log instantly with AI</Text>
            </View>
            <Text style={s.scanCTAArrow}>→</Text>
          </TouchableOpacity>

          {/* Recent drinks */}
          <Text style={s.section}>Today's Drinks</Text>
          {scans.length === 0 ? (
            <View style={s.empty}>
              <Text style={{fontSize:48}}>🥤</Text>
              <Text style={s.emptyTxt}>No drinks logged yet</Text>
              <Text style={s.emptySub}>Tap Scan to log your first drink</Text>
            </View>
          ) : scans.map((scan, i) => {
            const col = CATEGORY_COLOR[scan.identification?.category] ?? C.teal
            return (
              <View key={scan.scanId??i} style={s.drinkRow}>
                <View style={[s.drinkIcon,{backgroundColor:col+'20'}]}>
                  <Text style={{fontSize:22}}>{CATEGORY_EMOJI[scan.identification?.category]??'🥤'}</Text>
                </View>
                <View style={{flex:1}}>
                  <Text style={s.drinkName}>{scan.identification?.drinkName??'Unknown'}</Text>
                  <Text style={s.drinkMeta}>
                    {scan.volume?.liquidVolumeMl??0}ml · {scan.nutrition?.calories??0} cal
                    {scan.nutrition?.caffeineGrams>0?` · ${Math.round((scan.nutrition.caffeineGrams??0)*1000)}mg ⚡`:''}
                  </Text>
                </View>
                <Text style={s.drinkTime}>{new Date(scan.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</Text>
              </View>
            )
          })}
        </Animated.View>

        <View style={{height:32}} />
      </ScrollView>
    </View>
  )
}

function Ring({value,max,label,color,size}:{value:number,max:number,label:string,color:string,size:number}) {
  const pct = Math.min(value/Math.max(max,1), 1)
  return (
    <View style={{alignItems:'center'}}>
      <View style={{width:size,height:size,borderRadius:size/2,borderWidth:4,borderColor:C.bg3,alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
        <View style={{position:'absolute',bottom:0,left:0,right:0,height:`${pct*100}%`,backgroundColor:color+'30'}} />
        <Text style={{fontSize:size*0.25,fontWeight:'800',color}}>{value}</Text>
      </View>
      <Text style={{fontSize:10,color:C.text2,marginTop:4}}>{label}</Text>
    </View>
  )
}

function Pill({emoji,label,value,max,color}:{emoji:string,label:string,value:string,max:number,color:string}) {
  return (
    <View style={[ps.pill,{borderColor:color+'30'}]}>
      <Text style={{fontSize:20}}>{emoji}</Text>
      <View style={{flex:1}}>
        <Text style={ps.val}>{value}</Text>
        <Text style={ps.lbl}>{label}</Text>
      </View>
    </View>
  )
}
const ps = StyleSheet.create({
  pill:{flex:1,flexDirection:'row',alignItems:'center',backgroundColor:C.bg2,borderRadius:16,padding:14,gap:10,borderWidth:1},
  val:{fontSize:16,fontWeight:'800',color:C.text1},
  lbl:{fontSize:11,color:C.text2},
})

const s = StyleSheet.create({
  root:        {flex:1,backgroundColor:C.bg1},
  header:      {paddingTop:60,paddingBottom:28,paddingHorizontal:20,marginBottom:4},
  headerBg:    {position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:C.bg0},
  greeting:    {fontSize:26,fontWeight:'900',color:C.text1,marginBottom:4},
  date:        {fontSize:14,color:C.text2},
  streak:      {backgroundColor:C.gold+'20',borderRadius:20,paddingHorizontal:12,paddingVertical:4,marginTop:10,alignSelf:'flex-start',borderWidth:1,borderColor:C.gold+'40'},
  streakTxt:   {color:C.gold,fontSize:13,fontWeight:'700'},
  heroCard:    {marginHorizontal:16,backgroundColor:C.bg2,borderRadius:24,padding:22,flexDirection:'row',marginBottom:12,borderWidth:1,borderColor:C.border},
  heroLeft:    {flex:1},
  heroLbl:     {fontSize:10,color:C.teal,fontWeight:'700',letterSpacing:1.5,marginBottom:4},
  heroNum:     {fontSize:52,fontWeight:'900',color:C.text1,lineHeight:56},
  heroUnit:    {fontSize:14,color:C.text2,marginBottom:12},
  heroTrack:   {height:4,backgroundColor:C.bg3,borderRadius:2,overflow:'hidden',marginBottom:6},
  heroFill:    {height:4,borderRadius:2},
  heroSub:     {fontSize:12,color:C.text3},
  heroRight:   {alignItems:'flex-end',justifyContent:'center',paddingLeft:12},
  pillsRow:    {flexDirection:'row',gap:10,marginHorizontal:16,marginBottom:10},
  warn:        {marginHorizontal:16,backgroundColor:'rgba(255,140,66,0.12)',borderRadius:12,padding:12,marginBottom:10,borderWidth:1,borderColor:C.orange+'40'},
  warnTxt:     {color:C.orange,fontSize:13},
  scanCTA:     {marginHorizontal:16,backgroundColor:C.teal,borderRadius:20,padding:18,flexDirection:'row',alignItems:'center',gap:14,marginBottom:20},
  scanCTAIcon: {width:48,height:48,borderRadius:24,backgroundColor:'rgba(0,0,0,0.2)',alignItems:'center',justifyContent:'center'},
  scanCTATitle:{color:C.bg0,fontSize:17,fontWeight:'800'},
  scanCTASub:  {color:'rgba(0,0,0,0.6)',fontSize:13,marginTop:2},
  scanCTAArrow:{color:C.bg0,fontSize:22},
  section:     {fontSize:16,fontWeight:'800',color:C.text1,marginHorizontal:16,marginBottom:10},
  drinkRow:    {flexDirection:'row',alignItems:'center',backgroundColor:C.bg2,marginHorizontal:16,marginBottom:8,borderRadius:16,padding:14,gap:12,borderWidth:1,borderColor:C.border},
  drinkIcon:   {width:46,height:46,borderRadius:23,alignItems:'center',justifyContent:'center'},
  drinkName:   {fontSize:15,fontWeight:'700',color:C.text1},
  drinkMeta:   {fontSize:12,color:C.text2,marginTop:2},
  drinkTime:   {fontSize:12,color:C.text3},
  empty:       {alignItems:'center',paddingVertical:40,gap:8},
  emptyTxt:    {fontSize:17,fontWeight:'700',color:C.text1},
  emptySub:    {fontSize:14,color:C.text2},
})
