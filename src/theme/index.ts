// DrinkScanAI — Brand palette matched to logo
// Dark charcoal + Electric green + White

export const C = {
  // Backgrounds
  bg0:      '#080C0A',   // deep black (matches logo bg)
  bg1:      '#0D1410',   // page bg
  bg2:      '#121A15',   // card bg
  bg3:      '#182010',   // elevated
  bgGlass:  'rgba(13,20,16,0.92)',

  // Brand green (matched to logo)
  green:    '#4ADE80',   // primary brand green
  greenDim: '#22C55E',
  greenSoft:'rgba(74,222,128,0.12)',
  greenGlow:'rgba(74,222,128,0.25)',

  // Secondary
  teal:     '#00E5CC',
  tealSoft: 'rgba(0,229,204,0.10)',
  gold:     '#F5C842',
  goldSoft: 'rgba(245,200,66,0.12)',
  red:      '#FF4757',
  orange:   '#FF8C42',
  purple:   '#A855F7',
  water:    '#4DA6FF',

  // Text
  text1:    '#F0FFF4',   // warm white with green tint
  text2:    '#7A9985',   // muted green-grey
  text3:    '#3D5445',   // very muted

  // Borders
  border:   '#1A2A1E',
  borderHi: '#243A28',

  // Category colours
  coffee:   '#C8844A',
  tea:      '#6BAF5E',
  juice:    '#F5A623',
  soda:     '#FF5B5B',
  milk:     '#C8C8D4',
  alcohol:  '#9B6BD4',
  smoothie: '#42C98D',
  energy:   '#FFD600',
  unknown:  '#7A9985',
}

export const CATEGORY_COLOR: Record<string,string> = {
  coffee:'#C8844A', tea:'#6BAF5E', juice:'#F5A623',
  soda:'#FF5B5B', water:'#4DA6FF', milk:'#C8C8D4',
  alcohol:'#9B6BD4', smoothie:'#42C98D', energy_drink:'#FFD600',
  sports:'#4ADE80', hot_drink:'#C8844A', fermented:'#A855F7',
  unknown:'#7A9985',
}

export const CATEGORY_EMOJI: Record<string,string> = {
  coffee:'☕', tea:'🍵', juice:'🥤', soda:'🫧', water:'💧',
  milk:'🥛', alcohol:'🍺', smoothie:'🥝', energy_drink:'⚡',
  sports:'🏃', hot_drink:'🍫', fermented:'🧃', unknown:'❓',
}
