import React, { useEffect, useRef } from 'react';
import { Text, Animated, Dimensions, Platform } from 'react-native';
import YaqeenLogo from '../features/YaqeenLogo';

export default function SplashScreen({ onAnimationComplete }) {
  const { height: screenHeight } = Dimensions.get('window');

  // Animated Splash Screen States
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const slideOpacity = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Logo Animation (Fade in & Scale up)
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1.0,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      // Hold logo for a brief moment
      Animated.delay(1000),
      // 2. Black expanding slide-down animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(slideOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      // Hold the black fully covered screen for a brief split-second
      Animated.delay(400),
      // Fade out the logo and purple background cover behind the solid black sheet
      Animated.timing(logoOpacity, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      // 3. Smooth splash fade off
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onAnimationComplete) {
        onAnimationComplete();
      }
    });
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#0D0D0D',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: splashOpacity,
        zIndex: 99999,
      }}
    >
      {/* Purple Background Cover */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#6B21A8',
          opacity: logoOpacity,
        }}
      />

      {/* Logo Container */}
      <Animated.View
        style={{
          opacity: logoOpacity,
          transform: [{ scale: logoScale }],
          alignItems: 'center',
        }}
      >
        <YaqeenLogo size={120} forceWhite />
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 32,
            fontWeight: '900',
            marginTop: 18,
            letterSpacing: 2,
          }}
        >
          YAQEEN
        </Text>
        <Text
          style={{
            color: '#F3E8FF',
            fontSize: 14,
            fontWeight: '600',
            marginTop: 4,
            letterSpacing: 1,
          }}
        >
          AI Service Orchestrator
        </Text>
      </Animated.View>

      {/* Dynamic expanding dark slide down overlay */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#0D0D0D',
          opacity: slideOpacity,
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-screenHeight, 0],
              }),
            },
          ],
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.15,
          shadowRadius: 20,
          elevation: 10,
        }}
      />
    </Animated.View>
  );
}
