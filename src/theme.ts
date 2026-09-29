export const colors = {
  background: '#0A0A0D',
  surface: '#151519',
  surfaceMuted: '#1D1D22',
  border: '#2A2A31',
  borderStrong: '#3B3B44',
  text: '#F5F6F8',
  textMuted: '#9799A6',
  textFaint: '#5C5D68',
  accent: '#39FF9C',
  accentSoft: '#132A1F',
  accentGlow: 'rgba(57, 255, 156, 0.35)',
  onAccent: '#06110B',
  positive: '#39FF9C',
  positiveSoft: '#132A1F',
  warning: '#FFC24B',
  warningSoft: '#332711',
  danger: '#FF5C7A',
  dangerSoft: '#331119',
  info: '#3CD0FF',
  infoSoft: '#0F2A33',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
};

export const glow = {
  shadowColor: colors.accent,
  shadowOpacity: 0.45,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 0 },
  elevation: 8,
};

export const type = {
  family: undefined,
  label: { fontSize: 11, fontWeight: '600' as const, color: colors.textMuted, letterSpacing: 0.4 },
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  value: { fontSize: 28, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 14, fontWeight: '400' as const, color: colors.text },
  bodyStrong: { fontSize: 14, fontWeight: '600' as const, color: colors.text },
  caption: { fontSize: 12, fontWeight: '400' as const, color: colors.textMuted },
};
