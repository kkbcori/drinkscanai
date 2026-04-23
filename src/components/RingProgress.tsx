import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

interface Props {
  size: number
  strokeWidth: number
  progress: number  // 0-1
  color: string
  bg?: string
  label?: string
  value?: string
  unit?: string
}

export default function RingProgress({
  size, strokeWidth, progress, color, bg = '#E4ECF3',
  label, value, unit
}: Props) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const filled = Math.min(progress, 1) * circ
  const cx = size / 2
  const cy = size / 2

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle cx={cx} cy={cy} r={r} stroke={bg} strokeWidth={strokeWidth} fill="none" />
          <Circle
            cx={cx} cy={cy} r={r}
            stroke={color} strokeWidth={strokeWidth} fill="none"
            strokeDasharray={`${filled} ${circ}`}
            strokeLinecap="round"
            rotation="-90"
            origin={`${cx}, ${cy}`}
          />
        </Svg>
        {value !== undefined && (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: size * 0.22, fontWeight: '800', color: '#0A1628' }}>
              {value}
            </Text>
            {unit && (
              <Text style={{ fontSize: size * 0.12, color: '#6B7A99', marginTop: -2 }}>
                {unit}
              </Text>
            )}
          </View>
        )}
      </View>
      {label && (
        <Text style={{ fontSize: 11, color: '#6B7A99', marginTop: 4, fontWeight: '600' }}>
          {label}
        </Text>
      )}
    </View>
  )
}
