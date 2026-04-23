import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import TodayScreen    from '../screens/TodayScreen'
import ScanScreen     from '../screens/ScanScreen'
import InsightsScreen from '../screens/InsightsScreen'
import LogScreen      from '../screens/LogScreen'
import ProfileScreen  from '../screens/ProfileScreen'
import { Colors } from '../theme'

const Tab = createBottomTabNavigator()

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={[ti.wrap, focused && ti.focusedWrap]}>
      <Text style={ti.emoji}>{emoji}</Text>
      <Text style={[ti.label, focused && ti.focusedLabel]}>{label}</Text>
    </View>
  )
}

// Custom large scan button in the middle
function ScanTabButton({ children, onPress }: any) {
  return (
    <TouchableOpacity style={sb.wrap} onPress={onPress} activeOpacity={0.85}>
      <View style={sb.btn}>
        <Text style={sb.icon}>📷</Text>
      </View>
    </TouchableOpacity>
  )
}

const ti = StyleSheet.create({
  wrap:         { alignItems: 'center', paddingTop: 4 },
  focusedWrap:  {},
  emoji:        { fontSize: 22 },
  label:        { fontSize: 10, marginTop: 2, color: '#A8B4C8', fontWeight: '500' },
  focusedLabel: { color: Colors.primary, fontWeight: '700' },
})

const sb = StyleSheet.create({
  wrap: { top: -20, justifyContent: 'center', alignItems: 'center' },
  btn:  {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: { fontSize: 28 },
})

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#E4ECF3',
          borderTopWidth: 1,
          height: 82,
          paddingBottom: 16,
        },
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: '#A8B4C8',
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Today" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" label="Insights" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          tabBarButton: (props) => <ScanTabButton {...props} />,
        }}
      />
      <Tab.Screen
        name="Log"
        component={LogScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" label="Log" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  )
}
