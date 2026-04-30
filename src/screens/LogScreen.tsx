import React, { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Animated } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { C, CATEGORY_COLOR, CATEGORY_EMOJI } from '../theme'
import { getRecentScans } from '../db/historyDB'

export default function LogScreen() {
  const [scans, setScans] = useState<any[]>([])
  const [search, setSearch] = useState('')

  useFocusEffect(useCallback(() => {
    setScans(getRecentScans(200))
  }, []))

  const filtered = search
    ? scans.filter(s => s.identification?.drinkName?.toLowerCase().includes(search.toLowerCase()))
    : scans

  const groups: Record<string,any[]> = {}
  filtered.forEach(s => {
    const d = s.timestamp?.slice(0,10) ?? 'Unknown'
    if (!groups[d]) groups[d] = []
    groups[d].push(s)
  })

  const today = new Date().toISOString().slice(0,10)
  const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10)
  const formatDate = (d:string) => {
    if(d===today) return 'Today'
    if(d===yesterday) return 'Yesterday'
    return new Date(d).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})
  }

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Drink Log</Text>
        <Text style={s.sub}>{scans.length} total scans</Text>
      </View>

      <View style={s.searchRow}>
        <TextInput style={s.search} value={search} onChangeText={setSearch}
          placeholder="Search drinks..." placeholderTextColor={C.text3}
          returnKeyType="search" />
        {search.length > 0 && (
          <TouchableOpacity onPress={()=>setSearch('')} style={s.clearBtn}>
            <Text style={{color:C.text2,fontSize:16}}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:32}}>
        {Object.keys(groups).length === 0 ? (
          <View style={s.empty}>
            <Text style={{fontSize:52}}>📋</Text>
            <Text style={s.emptyTxt}>No scans yet</Text>
            <Text style={s.emptySub}>Start scanning drinks to build your history</Text>
          </View>
        ) : Object.entries(groups).sort((a,b)=>b[0].localeCompare(a[0])).map(([date,items]) => {
          const dayTotal = {
            cal: items.reduce((t,s)=>t+(s.nutrition?.calories??0),0),
            caf: items.reduce((t,s)=>t+Math.round((s.nutrition?.caffeineGrams??0)*1000),0),
          }
          return (
            <View key={date}>
              <View style={s.dayHeader}>
                <Text style={s.dayTitle}>{formatDate(date)}</Text>
                <Text style={s.dayMeta}>{dayTotal.cal} cal · {dayTotal.caf}mg caffeine</Text>
              </View>
              {items.map((scan,i) => {
                const col = CATEGORY_COLOR[scan.identification?.category] ?? C.teal
                return (
                  <View key={scan.scanId??i} style={s.card}>
                    <View style={[s.iconWrap,{backgroundColor:col+'18'}]}>
                      <Text style={{fontSize:24}}>{CATEGORY_EMOJI[scan.identification?.category]??'🥤'}</Text>
                    </View>
                    <View style={{flex:1}}>
                      <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:6}}>
                        <Text style={s.drinkName}>{scan.identification?.drinkName??'Unknown'}</Text>
                        <Text style={s.time}>{new Date(scan.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</Text>
                      </View>
                      <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>
                        <Tag label={`${scan.nutrition?.calories??0} cal`} color={C.gold} />
                        <Tag label={`${scan.volume?.liquidVolumeMl??0}ml`} color={C.water} />
                        {(scan.nutrition?.caffeineGrams??0)>0 && <Tag label={`${Math.round((scan.nutrition.caffeineGrams??0)*1000)}mg ⚡`} color={C.purple} />}
                      </View>
                      {scan.userCorrection && <Text style={s.corrected}>✏️ Corrected · helps improve AI</Text>}
                      {scan.userConfirmed && !scan.userCorrection && <Text style={s.confirmed}>✅ Confirmed</Text>}
                    </View>
                  </View>
                )
              })}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

function Tag({label,color}:{label:string,color:string}) {
  return (
    <View style={{backgroundColor:color+'18',paddingHorizontal:8,paddingVertical:3,borderRadius:20,borderWidth:1,borderColor:color+'35'}}>
      <Text style={{fontSize:11,fontWeight:'700',color}}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  root:      {flex:1,backgroundColor:C.bg1},
  header:    {backgroundColor:C.bg0,paddingTop:60,paddingBottom:20,paddingHorizontal:20},
  title:     {fontSize:28,fontWeight:'900',color:C.text1},
  sub:       {fontSize:13,color:C.text2,marginTop:4},
  searchRow: {flexDirection:'row',alignItems:'center',margin:16,backgroundColor:C.bg2,borderRadius:14,paddingHorizontal:14,borderWidth:1,borderColor:C.border},
  search:    {flex:1,paddingVertical:13,fontSize:15,color:C.text1},
  clearBtn:  {padding:8},
  dayHeader: {flexDirection:'row',justifyContent:'space-between',alignItems:'baseline',paddingHorizontal:16,paddingVertical:8},
  dayTitle:  {fontSize:14,fontWeight:'800',color:C.text1},
  dayMeta:   {fontSize:12,color:C.text3},
  card:      {flexDirection:'row',alignItems:'flex-start',backgroundColor:C.bg2,marginHorizontal:16,marginBottom:8,borderRadius:16,padding:14,gap:12,borderWidth:1,borderColor:C.border},
  iconWrap:  {width:46,height:46,borderRadius:23,alignItems:'center',justifyContent:'center'},
  drinkName: {fontSize:15,fontWeight:'700',color:C.text1,flex:1},
  time:      {fontSize:12,color:C.text3},
  corrected: {fontSize:11,color:C.orange,marginTop:6},
  confirmed: {fontSize:11,color:C.green,marginTop:6},
  empty:     {alignItems:'center',paddingTop:80,gap:10},
  emptyTxt:  {fontSize:18,fontWeight:'800',color:C.text1},
  emptySub:  {fontSize:14,color:C.text2},
})
