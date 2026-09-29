import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';

const WEIGHT_FONTS: Record<string, string> = {
  '100': 'Poppins_400Regular',
  '200': 'Poppins_400Regular',
  '300': 'Poppins_400Regular',
  '400': 'Poppins_400Regular',
  normal: 'Poppins_400Regular',
  '500': 'Poppins_500Medium',
  '600': 'Poppins_600SemiBold',
  '700': 'Poppins_700Bold',
  '800': 'Poppins_700Bold',
  '900': 'Poppins_700Bold',
  bold: 'Poppins_700Bold',
};

export default function Text({ style, ...props }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  const weight = String(flat.fontWeight ?? '400');
  const fontFamily = WEIGHT_FONTS[weight] ?? 'Poppins_400Regular';
  return <RNText {...props} style={[{ fontFamily }, style]} />;
}
