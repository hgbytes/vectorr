export type ThemeMode = 'dark' | 'light';

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

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  accentGlow: string;
  onAccent: string;
  positive: string;
  positiveSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
}

const darkColors: ThemeColors = {
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

const lightColors: ThemeColors = {
  background: '#FAFAF9',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F3F1',
  border: '#E4E7E4',
  borderStrong: '#D3D8D3',
  text: '#12140F',
  textMuted: '#5B6058',
  textFaint: '#8B9088',
  accent: '#1FAE6B',
  accentSoft: '#E3F5EC',
  accentGlow: 'rgba(31, 174, 107, 0.22)',
  onAccent: '#FFFFFF',
  positive: '#1FAE6B',
  positiveSoft: '#E3F5EC',
  warning: '#B4790A',
  warningSoft: '#FBF0DC',
  danger: '#D53F52',
  dangerSoft: '#FBE7EA',
  info: '#1C86C9',
  infoSoft: '#E3F1FB',
};

export function getColors(mode: ThemeMode): ThemeColors {
  return mode === 'light' ? lightColors : darkColors;
}

export interface ThemeGlow {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
}

export function getGlow(colors: ThemeColors, mode: ThemeMode): ThemeGlow {
  if (mode === 'light') {
    return {
      shadowColor: colors.accent,
      shadowOpacity: 0.22,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    };
  }
  return {
    shadowColor: colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  };
}
