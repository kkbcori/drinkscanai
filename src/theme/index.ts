export const Colors = {
  // Brand
  primary:    '#005F99',
  primaryDark:'#003F6B',
  accent:     '#00C2FF',
  accentSoft: '#E0F7FF',

  // Semantic
  success:    '#00C896',
  warning:    '#FF9500',
  danger:     '#FF453A',
  purple:     '#8B5CF6',

  // Neutrals
  bg:         '#F4F8FB',
  surface:    '#FFFFFF',
  border:     '#E4ECF3',
  textPrimary:'#0A1628',
  textSecond: '#6B7A99',
  textMuted:  '#A8B4C8',

  // Dark
  dark:       '#0A1628',
  darkSurface:'#142034',

  // Category colours
  coffee:     '#8B5E3C',
  tea:        '#5D8C3E',
  juice:      '#F59E0B',
  soda:       '#EF4444',
  water:      '#3B82F6',
  milk:       '#F3F4F6',
  alcohol:    '#7C3AED',
  smoothie:   '#10B981',
  energy:     '#F97316',
  unknown:    '#6B7A99',
}

export const CATEGORY_COLOR: Record<string, string> = {
  coffee:       Colors.coffee,
  tea:          Colors.tea,
  juice:        Colors.juice,
  soda:         Colors.soda,
  water:        Colors.water,
  milk:         '#94A3B8',
  alcohol:      Colors.alcohol,
  smoothie:     Colors.smoothie,
  energy_drink: Colors.energy,
  sports:       Colors.success,
  hot_drink:    Colors.coffee,
  fermented:    Colors.purple,
  unknown:      Colors.unknown,
}

export const CATEGORY_EMOJI: Record<string, string> = {
  coffee:       '☕',
  tea:          '🍵',
  juice:        '🥤',
  soda:         '🫧',
  water:        '💧',
  milk:         '🥛',
  alcohol:      '🍺',
  smoothie:     '🥝',
  energy_drink: '⚡',
  sports:       '🏃',
  hot_drink:    '🍫',
  fermented:    '🧃',
  unknown:      '❓',
}

export const Spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
}

export const Radius = {
  sm: 8, md: 12, lg: 16, xl: 24, round: 999,
}

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
}
