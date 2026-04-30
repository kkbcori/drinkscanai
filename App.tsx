import React, { useEffect, useRef } from 'react'
import { StatusBar, Animated, View, Text, StyleSheet, Image } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import AppNavigator from './src/navigation/AppNavigator'
import { initDB } from './src/db/historyDB'
import { preloadModel } from './src/ml/drinkClassifier'
import { C } from './src/theme'

export default function App() {
  const splashOpacity = useRef(new Animated.Value(1)).current
  const logoScale     = useRef(new Animated.Value(0.75)).current
  const logoOpacity   = useRef(new Animated.Value(0)).current
  const taglineOpacity= useRef(new Animated.Value(0)).current
  const [showSplash, setShowSplash] = React.useState(true)

  useEffect(() => {
    initDB()

    // Sequence: logo springs in → tagline fades in → hold → fade out
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale,   { toValue:1,    useNativeDriver:true, tension:70, friction:8 }),
        Animated.timing(logoOpacity, { toValue:1,    duration:400, useNativeDriver:true }),
      ]),
      Animated.delay(200),
      Animated.timing(taglineOpacity, { toValue:1, duration:400, useNativeDriver:true }),
      Animated.delay(900),
      Animated.timing(splashOpacity,  { toValue:0, duration:600, useNativeDriver:true }),
    ]).start(() => {
      setShowSplash(false)
      preloadModel().catch(() => {})
    })
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={C.bg0} />
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>

        {showSplash && (
          <Animated.View style={[ss.splash, { opacity: splashOpacity }]}>
            {/* Glow behind logo */}
            <View style={ss.glowWrap}>
              <View style={ss.glow} />
            </View>

            <Animated.View style={{
              transform: [{ scale: logoScale }],
              opacity: logoOpacity,
              alignItems: 'center',
            }}>
              <Image
                source={require('./ios/DrinkScanAI/Assets/logo.png')}
                style={ss.logo}
                resizeMode="contain"
              />
            </Animated.View>

            <Animated.Text style={[ss.tagline, { opacity: taglineOpacity }]}>
              SCAN. KNOW. TRACK.
            </Animated.Text>
          </Animated.View>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const ss = StyleSheet.create({
  splash:   {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.bg0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  glowWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  glow:     {
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: C.green,
    opacity: 0.06,
  },
  logo:     { width: 220, height: 220 },
  tagline:  {
    fontSize: 13,
    color: C.green,
    letterSpacing: 4,
    fontWeight: '700',
    marginTop: 8,
  },
})
