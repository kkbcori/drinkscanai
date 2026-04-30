import React, { useRef, useEffect } from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import TodayScreen      from '../screens/TodayScreen'
import ScanScreen       from '../screens/ScanScreen'
import InsightsScreen   from '../screens/InsightsScreen'
import LogScreen        from '../screens/LogScreen'
import ProfileScreen    from '../screens/ProfileScreen'
import DiagnosticScreen from '../screens/DiagnosticScreen'
import { C } from '../theme'

const Tab = createBottomTabNavigator()

function AnimatedTabIcon({ emoji, label, focused }: { emoji:string; label:string; focused:boolean }) {
  const scale = useRef(new Animated.Value(focused?1.1:1)).current
  const opacity = useRef(new Animated.Value(focused?1:0.5)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: focused?1.15:1, useNativeDriver:true, tension:200, friction:10 }),
      Animated.timing(opacity, { toValue: focused?1:0.55, duration:200, useNativeDriver:true }),
    ]).start()
  }, [focused])

  return (
    <Animated.View style={{ alignItems:'center', paddingTop:6, transform:[{scale}], opacity }}>
      <Text style={{ fontSize:22 }}>{emoji}</Text>
      <Text style={[ti.lbl, focused && ti.active]}>{label}</Text>
      {focused && <View style={ti.dot} />}
    </Animated.View>
  )
}

function ScanTabBtn({ children, onPress }: any) {
  const scale = useRef(new Animated.Value(1)).current
  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue:0.9, duration:80, useNativeDriver:true }),
      Animated.spring(scale, { toValue:1, useNativeDriver:true, tension:300, friction:8 }),
    ]).start()
    onPress?.()
  }
  return (
    <TouchableOpacity style={sb.wrap} onPress={press} activeOpacity={1}>
      <Animated.View style={[sb.btn, {transform:[{scale}]}]}>
        <View style={sb.inner}>
          <Text style={sb.icon}>📷</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  )
}

const ti = StyleSheet.create({
  lbl:    { fontSize:10, color:C.text3, marginTop:3, fontWeight:'500' },
  active: { color:C.teal, fontWeight:'700' },
  dot:    { width:4, height:4, borderRadius:2, backgroundColor:C.teal, marginTop:2 },
})
const sb = StyleSheet.create({
  wrap:  { top:-24, alignItems:'center', justifyContent:'center' },
  btn:   { width:70, height:70, borderRadius:35, backgroundColor:C.bg1, padding:3, shadowColor:C.teal, shadowOffset:{width:0,height:4}, shadowOpacity:0.4, shadowRadius:12, elevation:8 },
  inner: { flex:1, borderRadius:32, backgroundColor:C.teal, alignItems:'center', justifyContent:'center' },
  icon:  { fontSize:30 },
})

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.bg0,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: 84,
          paddingBottom: 16,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen name="Today" component={TodayScreen}
        options={{ tabBarIcon:({focused})=><AnimatedTabIcon emoji="🏠" label="Today" focused={focused}/> }} />
      <Tab.Screen name="Insights" component={InsightsScreen}
        options={{ tabBarIcon:({focused})=><AnimatedTabIcon emoji="📊" label="Insights" focused={focused}/> }} />
      <Tab.Screen name="Scan" component={ScanScreen}
        options={{ tabBarButton:(props)=><ScanTabBtn {...props}/> }} />
      <Tab.Screen name="Log" component={LogScreen}
        options={{ tabBarIcon:({focused})=><AnimatedTabIcon emoji="📋" label="Log" focused={focused}/> }} />
      <Tab.Screen name="Debug" component={DiagnosticScreen}
        options={{ tabBarIcon:({focused})=><AnimatedTabIcon emoji="🔧" label="Debug" focused={focused}/> }} />
    </Tab.Navigator>
  )
}
