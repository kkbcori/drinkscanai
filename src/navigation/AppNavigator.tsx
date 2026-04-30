import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import TodayScreen      from '../screens/TodayScreen'
import ScanScreen       from '../screens/ScanScreen'
import InsightsScreen   from '../screens/InsightsScreen'
import LogScreen        from '../screens/LogScreen'
import ProfileScreen    from '../screens/ProfileScreen'
import DiagnosticScreen from '../screens/DiagnosticScreen'
import { Colors } from '../theme'

const Tab = createBottomTabNavigator()

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 4 }}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text style={{ fontSize: 10, marginTop: 2, color: focused ? Colors.primary : '#A8B4C8', fontWeight: focused ? '700' : '500' }}>
        {label}
      </Text>
    </View>
  )
}

function ScanTabButton({ children, onPress }: any) {
  return (
    <TouchableOpacity style={{ top: -20, justifyContent: 'center', alignItems: 'center' }} onPress={onPress} activeOpacity={0.85}>
      <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 }}>
        <Text style={{ fontSize: 28 }}>📷</Text>
      </View>
    </TouchableOpacity>
  )
}

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#E4ECF3', borderTopWidth: 1, height: 82, paddingBottom: 16 },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: '#A8B4C8',
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen name="Today" component={TodayScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Today" focused={focused} /> }} />
      <Tab.Screen name="Insights" component={InsightsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📊" label="Insights" focused={focused} /> }} />
      <Tab.Screen name="Scan" component={ScanScreen}
        options={{ tabBarButton: (props) => <ScanTabButton {...props} /> }} />
      <Tab.Screen name="Log" component={LogScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📋" label="Log" focused={focused} /> }} />
      <Tab.Screen name="Debug" component={DiagnosticScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🔧" label="Debug" focused={focused} /> }} />
    </Tab.Navigator>
  )
}
