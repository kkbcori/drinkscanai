import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Text } from 'react-native'
import ScanScreen from '../screens/ScanScreen'
import HistoryScreen from '../screens/HistoryScreen'

const Tab = createBottomTabNavigator()

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: focused ? '#185FA5' : 'transparent',
          marginBottom: 2,
        }}
      />
      <Text
        style={{
          fontSize: 10,
          color: focused ? '#185FA5' : '#888',
          fontWeight: focused ? '500' : '400',
        }}>
        {name}
      </Text>
    </View>
  )
}

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#fff', elevation: 0, shadowOpacity: 0 },
        headerTitleStyle: { fontSize: 17, fontWeight: '500' },
        tabBarStyle: {
          borderTopColor: 'rgba(0,0,0,0.08)',
          borderTopWidth: 0.5,
          paddingTop: 6,
          paddingBottom: 4,
          height: 56,
        },
        tabBarShowLabel: false,
      }}>
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          title: 'DrinkScanAI',
          tabBarIcon: ({ focused }) => <TabIcon name="Scan" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: 'History',
          tabBarIcon: ({ focused }) => <TabIcon name="History" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  )
}
