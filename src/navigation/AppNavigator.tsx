import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import ScanScreen from '../screens/ScanScreen'
import HistoryScreen from '../screens/HistoryScreen'

const Tab = createBottomTabNavigator()

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#007AFF',
      }}
    >
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{ title: 'Scan Drink' }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: 'History' }}
      />
    </Tab.Navigator>
  )
}
