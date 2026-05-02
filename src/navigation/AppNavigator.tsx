import React, { useRef, useEffect } from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Easing,
} from 'react-native'
import TodayScreen      from '../screens/TodayScreen'
import ScanScreen       from '../screens/ScanScreen'
import InsightsScreen   from '../screens/InsightsScreen'
import LogScreen        from '../screens/LogScreen'
import ProfileScreen    from '../screens/ProfileScreen'
import DiagnosticScreen from '../screens/DiagnosticScreen'
import { C } from '../theme'

const Tab = createBottomTabNavigator()

// ── Animated tab icon ─────────────────────────────────────────────────────
function TabIcon({
  emoji, label, focused,
  animation = 'bounce',
}: {
  emoji: string
  label: string
  focused: boolean
  animation?: 'bounce' | 'pulse' | 'rotate' | 'shake'
}) {
  const scale   = useRef(new Animated.Value(1)).current
  const rotate  = useRef(new Animated.Value(0)).current
  const translateX = useRef(new Animated.Value(0)).current
  const dotScale   = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (focused) {
      // Entrance animation based on type
      if (animation === 'bounce') {
        Animated.sequence([
          Animated.timing(scale, { toValue:1.35, duration:120, useNativeDriver:true, easing:Easing.out(Easing.back(3)) }),
          Animated.spring(scale, { toValue:1.1,  useNativeDriver:true, tension:300, friction:8 }),
        ]).start()
      } else if (animation === 'pulse') {
        Animated.loop(
          Animated.sequence([
            Animated.timing(scale, { toValue:1.2, duration:600, useNativeDriver:true }),
            Animated.timing(scale, { toValue:1.0, duration:600, useNativeDriver:true }),
          ]),
          { iterations: 2 }
        ).start()
      } else if (animation === 'rotate') {
        Animated.sequence([
          Animated.timing(rotate, { toValue:1, duration:400, useNativeDriver:true, easing:Easing.out(Easing.cubic) }),
          Animated.timing(scale,  { toValue:1.1, duration:150, useNativeDriver:true }),
        ]).start()
      } else if (animation === 'shake') {
        Animated.sequence([
          Animated.timing(translateX, { toValue:4,  duration:60, useNativeDriver:true }),
          Animated.timing(translateX, { toValue:-4, duration:60, useNativeDriver:true }),
          Animated.timing(translateX, { toValue:3,  duration:60, useNativeDriver:true }),
          Animated.timing(translateX, { toValue:0,  duration:60, useNativeDriver:true }),
          Animated.spring(scale, { toValue:1.1, useNativeDriver:true, tension:200, friction:8 }),
        ]).start()
      }
      // Active dot pops in
      Animated.spring(dotScale, { toValue:1, useNativeDriver:true, tension:300, friction:6 }).start()
    } else {
      Animated.parallel([
        Animated.timing(scale,  { toValue:1, duration:200, useNativeDriver:true }),
        Animated.timing(rotate, { toValue:0, duration:200, useNativeDriver:true }),
        Animated.timing(scale,  { toValue:1, duration:200, useNativeDriver:true }),
        Animated.spring(dotScale, { toValue:0, useNativeDriver:true, tension:300, friction:8 }),
      ]).start()
    }
  }, [focused])

  const rotateInterp = rotate.interpolate({ inputRange:[0,1], outputRange:['0deg','360deg'] })

  return (
    <View style={ti.wrap}>
      <Animated.Text style={[
        ti.emoji,
        { transform:[
          { scale },
          { rotate: animation==='rotate' ? rotateInterp : '0deg' },
          { translateX },
        ]},
        !focused && ti.dim,
      ]}>
        {emoji}
      </Animated.Text>
      <Text style={[ti.label, focused && ti.labelActive]}>{label}</Text>
      <Animated.View style={[ti.dot, { transform:[{scale:dotScale}] }]} />
    </View>
  )
}

// ── Scan button (centre) ──────────────────────────────────────────────────
function ScanTabButton({ children, onPress }: any) {
  const scale = useRef(new Animated.Value(1)).current
  const glow  = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Continuous glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue:1, duration:1500, useNativeDriver:true, easing:Easing.inOut(Easing.ease) }),
        Animated.timing(glow, { toValue:0, duration:1500, useNativeDriver:true, easing:Easing.inOut(Easing.ease) }),
      ])
    ).start()
  }, [])

  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue:0.88, duration:80,  useNativeDriver:true }),
      Animated.spring(scale, { toValue:1,    useNativeDriver:true, tension:300, friction:6 }),
    ]).start()
    onPress?.()
  }

  const glowOpacity = glow.interpolate({ inputRange:[0,1], outputRange:[0.3, 0.7] })
  const glowScale   = glow.interpolate({ inputRange:[0,1], outputRange:[1.0, 1.18] })

  return (
    <TouchableOpacity style={sb.wrap} onPress={press} activeOpacity={1}>
      {/* Glow ring */}
      <Animated.View style={[sb.glowRing, {
        opacity:   glowOpacity,
        transform: [{ scale: glowScale }],
      }]} />
      {/* Button */}
      <Animated.View style={[sb.btn, { transform:[{ scale }] }]}>
        <View style={sb.inner}>
          <Text style={sb.icon}>📷</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  )
}

const ti = StyleSheet.create({
  wrap:        { alignItems:'center', paddingTop:4, paddingHorizontal:4, minWidth:56 },
  emoji:       { fontSize:24 },
  dim:         { opacity:0.45 },
  label:       { fontSize:9, color:C.text3, marginTop:3, fontWeight:'500', letterSpacing:0.3 },
  labelActive: { color:C.green, fontWeight:'800' },
  dot:         { width:4, height:4, borderRadius:2, backgroundColor:C.green, marginTop:2 },
})

const sb = StyleSheet.create({
  wrap:    { top:-22, alignItems:'center', justifyContent:'center', width:72 },
  glowRing:{ position:'absolute', width:72, height:72, borderRadius:36, backgroundColor:C.green, opacity:0.3 },
  btn:     { width:66, height:66, borderRadius:33, backgroundColor:C.bg1, padding:3,
             shadowColor:C.green, shadowOffset:{width:0,height:0}, shadowOpacity:0.5, shadowRadius:16, elevation:10 },
  inner:   { flex:1, borderRadius:30, backgroundColor:C.green, alignItems:'center', justifyContent:'center' },
  icon:    { fontSize:28 },
})

// ── Navigator ─────────────────────────────────────────────────────────────
export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor:  C.bg0,
          borderTopColor:   C.border,
          borderTopWidth:   1,
          height:           84,
          paddingBottom:    16,
          paddingTop:       4,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen name="Today" component={TodayScreen}
        options={{ tabBarIcon:({focused})=><TabIcon emoji="🏠" label="Home"    focused={focused} animation="bounce"  /> }} />
      <Tab.Screen name="Insights" component={InsightsScreen}
        options={{ tabBarIcon:({focused})=><TabIcon emoji="📊" label="Trends"  focused={focused} animation="pulse"   /> }} />
      <Tab.Screen name="Scan" component={ScanScreen}
        options={{ tabBarButton:(props)=><ScanTabButton {...props} /> }} />
      <Tab.Screen name="Log" component={LogScreen}
        options={{ tabBarIcon:({focused})=><TabIcon emoji="📋" label="Log"     focused={focused} animation="shake"   /> }} />
      <Tab.Screen name="Debug" component={DiagnosticScreen}
        options={{ tabBarIcon:({focused})=><TabIcon emoji="⚙️"  label="Debug"  focused={focused} animation="rotate"  /> }} />
    </Tab.Navigator>
  )
}
