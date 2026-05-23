import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { doc, updateDoc } from 'firebase/firestore';

const { width } = Dimensions.get('window');

/**
 * OnboardingManager — high-fidelity slideshow walkthrough for teaching application features.
 */
export default function OnboardingManager({
  visible,
  onClose,
  db,
  user,
  userProfile,
  setUserProfile,
  isDarkMode,
  COLORS,
  styles,
  addToast
}) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "Welcome to Yaqeen AI",
      description: "Automated intent understanding, voice command analysis, and intelligent nearby professional service discovery.",
      icon: "cpu",
      color: "#A855F7"
    },
    {
      title: "Secure Verification & Map Routing",
      description: "Get mapped to highly rated local providers near your sector, view routes live, and get real-time tracking.",
      icon: "map-pin",
      color: "#3B82F6"
    },
    {
      title: "Safe Payments & PDF Receipts",
      description: "Chat directly in manual negotiation rooms, track booking status, and instantly share verified payment receipts.",
      icon: "file-text",
      color: "#10B981"
    }
  ];

  const handleNext = async () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      await finishOnboarding();
    }
  };

  const finishOnboarding = async () => {
    try {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        updateDoc(userRef, { hasCompletedOnboarding: true }).catch(err => 
          console.warn("Failed async onboarding save:", err.message)
        );
        setUserProfile(prev => ({ ...prev, hasCompletedOnboarding: true }));
      }
      addToast("Let's get started!", "success");
      onClose();
    } catch (e) {
      console.warn("Failed to save onboarding completion:", e.message);
      onClose();
    }
  };

  if (!visible) return null;

  const activeSlide = slides[currentSlide];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
        <View style={[styles.modalCard, {
          width: '90%',
          maxWidth: 420,
          borderRadius: 28,
          padding: 28,
          alignItems: 'center',
          backgroundColor: isDarkMode ? '#1C1C1E' : '#FFFFFF',
          borderWidth: 1,
          borderColor: COLORS.border,
        }]}>
          {/* Skip Button */}
          <TouchableOpacity
            style={{ position: 'absolute', right: 20, top: 20 }}
            onPress={finishOnboarding}
          >
            <Text style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' }}>Skip</Text>
          </TouchableOpacity>

          {/* Icon Badge */}
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: activeSlide.color + '15',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 24,
            marginTop: 16
          }}>
            <Feather name={activeSlide.icon} size={36} color={activeSlide.color} />
          </View>

          {/* Text content */}
          <Text style={{
            fontSize: 22,
            fontWeight: '900',
            color: COLORS.textPrimary,
            textAlign: 'center',
            marginBottom: 12
          }}>
            {activeSlide.title}
          </Text>
          
          <Text style={{
            fontSize: 14,
            color: COLORS.textSecondary,
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: 32,
            paddingHorizontal: 12
          }}>
            {activeSlide.description}
          </Text>

          {/* Progress Indicators */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 32 }}>
            {slides.map((_, idx) => (
              <View
                key={idx}
                style={{
                  width: idx === currentSlide ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: idx === currentSlide ? COLORS.primary : COLORS.border
                }}
              />
            ))}
          </View>

          {/* Action Row */}
          <TouchableOpacity
            onPress={handleNext}
            style={{
              backgroundColor: COLORS.primary,
              width: '100%',
              paddingVertical: 16,
              borderRadius: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
              {currentSlide === slides.length - 1 ? "Start Exploring" : "Continue"}
            </Text>
            <Feather name="arrow-right" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
