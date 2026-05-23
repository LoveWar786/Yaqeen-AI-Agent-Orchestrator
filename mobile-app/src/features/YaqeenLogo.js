import React from 'react';
import { View } from 'react-native';

const THEMES = {
  dark: {
    primary: '#A855F7',
    textPrimary: '#FFFFFF'
  },
  light: {
    primary: '#A855F7',
    textPrimary: '#0F172A'
  }
};

export default function YaqeenLogo({ size = 60, isDarkMode = true, forceWhite = false }) {
  const actualIsDarkMode = forceWhite ? true : isDarkMode;
  const COLORS = actualIsDarkMode ? THEMES.dark : THEMES.light;
  return (
    <View style={{ 
      width: size, 
      height: size, 
      borderRadius: size * 0.24, 
      backgroundColor: forceWhite ? 'rgba(255, 255, 255, 0.15)' : COLORS.primary, 
      justifyContent: 'center', 
      alignItems: 'center',
      shadowColor: forceWhite ? '#FFF' : COLORS.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5
    }}>
      <View style={{ width: size * 0.6, height: size * 0.6 }}>
        {/* Modern Y + Checkmark simulation using high-fidelity View blocks */}
        {/* Short leg of check / Left arm of Y */}
        <View style={{ 
          position: 'absolute', 
          left: '10%', 
          top: '35%', 
          width: '35%', 
          height: '14%', 
          backgroundColor: actualIsDarkMode ? '#FFF' : THEMES.light.textPrimary, 
          borderRadius: 10, 
          transform: [{ rotate: '45deg' }] 
        }} />
        {/* Long leg of check / Right arm of Y */}
        <View style={{ 
          position: 'absolute', 
          right: '5%', 
          top: '25%', 
          width: '55%', 
          height: '14%', 
          backgroundColor: actualIsDarkMode ? '#FFF' : THEMES.light.textPrimary, 
          borderRadius: 10, 
          transform: [{ rotate: '-45deg' }] 
        }} />
        {/* Stem of the Y */}
        <View style={{ 
          position: 'absolute', 
          left: '43%', 
          bottom: '10%', 
          width: '14%', 
          height: '35%', 
          backgroundColor: actualIsDarkMode ? '#FFF' : THEMES.light.textPrimary, 
          borderRadius: 10 
        }} />
      </View>
    </View>
  );
}
