import React, { useCallback, useState, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Animated } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { C, CATEGORY_COLOR, CATEGORY_EMOJI } from '../theme'
import { getRecentScans } from '../db/historyDB'

type Period = '7d'|'30d'

export default function InsightsScreen() {
  const [period, setPeriod] = useState<Period>('7d')
  const [scans, setScans]   = useState<any[]>([])
  const barAnim = useRef(new Animated.Value(0)).current

  useFocusEffect(useCallback(() => {
    setScans(getRecentScans(500))
    Animated.timing(barAnim, { toValue:1, duration:800, useNativeDriver:false }).start()
  }, []))

  const days = period==='7d'?7:30
  const cutoff = new Date(Date.now()-days*86400000).toISOString()
  const filtered = scans.filter(s=>s.timestamp>cutoff)

  const total = {
    drinks: filtered.length,
    cal: filtered.reduce((t,s)=>t+(s.nutrition?.calories??0),0),
    caf: filtered.reduce((t,s)=>t+Math.round((s.nutrition?.caffeineGrams??0)*1000),0),
    vol: Math.round(filtered.reduce((t,s)=>t+(s.volume?.liquidVolumeMl??0),0)/1000*10)/10,
  }

  // Daily data last 7 days
  const daily = Array.from({length:7},(_,i)=>{
    const d = new Date(Date.now()-(6-i)*86400000)
    const ds = d.toISOString().slice(0,10)
    const ds2 = scans.filter(s=>s.timestamp?.slice(0,10)===ds)
    return {
      label: d.toLocaleDateString('en-US',{weekday:'short'}),
      cal: ds2.reduce((t,s)=>t+(s.nutrition?.calories??0),0),
      count: ds2.length,
    }
  })
  const maxCal = Math.max(...daily.map(d=>d.cal),1)

  // Category mix
  const byCat: Record<string,number> = {}
  filtered.forEach(s=>{ const c=s.identification?.category??'unknown'; byCat[c]=(byCat[c]??0)+1 })
  const topCats = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,6)

  return (
    <ScrollView style={s.root} contentContainerStyle={{paddingBottom:32}} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Insights</Text>
        <View style={s.toggle}>
          {(['7d','30d'] as Period[]).map(p=>(
            <TouchableOpacity key={p} style={[s.tBtn, period===p&&s.tBtnActive]} onPress={()=>setPeriod(p)}>
              <Text style={[s.tTxt, period===p&&s.tTxtActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Summary cards */}
      <View style={s.grid}>
        <SummaryCard emoji="🥤" label="Drinks" value={`${total.drinks}`} color={C.teal} />
        <SummaryCard emoji="🔥" label="Calories" value={total.cal.toLocaleString()} color={C.gold} />
        <SummaryCard emoji="⚡" label="Caffeine" value={`${total.caf}mg`} color={C.purple} />
        <SummaryCard emoji="💧" label="Volume" value={`${total.vol}L`} color={C.water} />
      </View>

      {/* Bar chart */}
      <Text style={s.section}>Daily Calories</Text>
      <View style={s.card}>
        <View style={s.barChart}>
          {daily.map((d,i)=>(
            <View key={i} style={s.barCol}>
              <Text style={s.barVal}>{d.cal>0?d.cal:''}</Text>
              <View style={s.barTrack}>
                <Animated.View style={[s.barFill,{
                  height: barAnim.interpolate({inputRange:[0,1],outputRange:['0%',`${(d.cal/maxCal)*100}%`]}),
                  backgroundColor: d.cal>1500?C.gold:C.teal,
                }]}/>
              </View>
              <Text style={s.barLabel}>{d.label}</Text>
              {d.count>0&&<View style={s.barDot}/>}
            </View>
          ))}
        </View>
      </View>

      {/* Category mix */}
      <Text style={s.section}>Your Drink Mix</Text>
      <View style={s.card}>
        {topCats.length===0
          ? <Text style={s.noData}>No data yet — start scanning!</Text>
          : topCats.map(([cat,count])=>{
            const pct = count/(filtered.length||1)
            const col = CATEGORY_COLOR[cat]??C.teal
            return (
              <View key={cat} style={s.mixRow}>
                <Text style={s.mixEmoji}>{CATEGORY_EMOJI[cat]??'🥤'}</Text>
                <View style={{flex:1}}>
                  <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:5}}>
                    <Text style={s.mixName}>{cat.replace('_',' ')}</Text>
                    <Text style={[s.mixPct,{color:col}]}>{count}× · {Math.round(pct*100)}%</Text>
                  </View>
                  <View style={s.mixTrack}>
                    <View style={[s.mixFill,{width:`${pct*100}%`,backgroundColor:col}]}/>
                  </View>
                </View>
              </View>
            )
          })
        }
      </View>

      {/* Avg per day */}
      <Text style={s.section}>Daily Average</Text>
      <View style={[s.card,{flexDirection:'row',justifyContent:'space-around'}]}>
        <Avg label="Drinks" value={(total.drinks/days).toFixed(1)} />
        <Avg label="Calories" value={Math.round(total.cal/days).toString()} />
        <Avg label="Caffeine" value={`${Math.round(total.caf/days)}mg`} />
      </View>
    </ScrollView>
  )
}

function SummaryCard({emoji,label,value,color}:{emoji:string,label:string,value:string,color:string}) {
  return (
    <View style={[sc.card,{borderColor:color+'30'}]}>
      <Text style={{fontSize:24,marginBottom:4}}>{emoji}</Text>
      <Text style={[sc.val,{color}]}>{value}</Text>
      <Text style={sc.lbl}>{label}</Text>
    </View>
  )
}
const sc = StyleSheet.create({
  card:{width:'47%',backgroundColor:C.bg2,borderRadius:18,padding:16,alignItems:'center',marginBottom:10,borderWidth:1},
  val:{fontSize:22,fontWeight:'900',color:C.text1,marginBottom:2},
  lbl:{fontSize:12,color:C.text2},
})

function Avg({label,value}:{label:string,value:string}) {
  return (
    <View style={{alignItems:'center'}}>
      <Text style={{fontSize:20,fontWeight:'800',color:C.text1}}>{value}</Text>
      <Text style={{fontSize:11,color:C.text2,marginTop:2}}>{label}/day</Text>
    </View>
  )
}

const s = StyleSheet.create({
  root:     {flex:1,backgroundColor:C.bg1},
  header:   {backgroundColor:C.bg0,paddingTop:60,paddingBottom:20,paddingHorizontal:20,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  title:    {fontSize:28,fontWeight:'900',color:C.text1},
  toggle:   {flexDirection:'row',backgroundColor:C.bg2,borderRadius:20,padding:3,borderWidth:1,borderColor:C.border},
  tBtn:     {paddingHorizontal:14,paddingVertical:6,borderRadius:18},
  tBtnActive:{backgroundColor:C.teal},
  tTxt:     {color:C.text2,fontSize:13,fontWeight:'600'},
  tTxtActive:{color:C.bg0,fontWeight:'800'},
  grid:     {flexDirection:'row',flexWrap:'wrap',marginHorizontal:16,marginTop:16,justifyContent:'space-between'},
  section:  {fontSize:15,fontWeight:'800',color:C.text1,marginHorizontal:16,marginBottom:10,marginTop:4},
  card:     {marginHorizontal:16,backgroundColor:C.bg2,borderRadius:20,padding:18,marginBottom:14,borderWidth:1,borderColor:C.border},
  barChart: {flexDirection:'row',alignItems:'flex-end',height:130,gap:6},
  barCol:   {flex:1,alignItems:'center',gap:4},
  barVal:   {fontSize:8,color:C.text3,height:12},
  barTrack: {flex:1,width:'80%',backgroundColor:C.bg3,borderRadius:4,overflow:'hidden',justifyContent:'flex-end'},
  barFill:  {borderRadius:4,width:'100%'},
  barLabel: {fontSize:10,color:C.text2},
  barDot:   {width:4,height:4,borderRadius:2,backgroundColor:C.teal},
  noData:   {color:C.text3,textAlign:'center',paddingVertical:20},
  mixRow:   {flexDirection:'row',alignItems:'center',marginBottom:14,gap:10},
  mixEmoji: {fontSize:20,width:28},
  mixName:  {fontSize:14,fontWeight:'600',color:C.text1,textTransform:'capitalize'},
  mixPct:   {fontSize:12,fontWeight:'700'},
  mixTrack: {height:5,backgroundColor:C.bg3,borderRadius:3,overflow:'hidden'},
  mixFill:  {height:5,borderRadius:3},
})
