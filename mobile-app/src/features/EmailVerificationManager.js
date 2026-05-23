import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { sendEmailVerification } from 'firebase/auth';
import { t } from '../utils/translations';

/**
 * EmailVerificationManager — handles background verification checking and top warning banner.
 */
export default function EmailVerificationManager({
  auth,
  user,
  userProfile,
  setUserProfile,
  isDarkMode,
  COLORS,
  styles,
  addToast,
  isEmailVerified,
  setIsEmailVerified
}) {
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const resendTimeoutRef = React.useRef(null);

  const [isChecking, setIsChecking] = useState(false);

  // Background polling every 1.5 seconds to check if user has clicked the verification link
  useEffect(() => {
    if (isEmailVerified || !auth.currentUser) return;

    // Direct Google Auth Auto-Verification Check
    const isGoogleUser = auth.currentUser.providerData?.some(p => p.providerId === 'google.com');
    if (isGoogleUser) {
      console.log("[AUTH] Google Auth user detected. Bypassing email verification requirement.");
      setIsEmailVerified(true);
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const startTime = performance.now();
        await auth.currentUser.reload();
        const duration = performance.now() - startTime;
        console.log(`[PERFORMANCE] Auto background verification check resolved in ${duration.toFixed(0)}ms (${(duration / 1000).toFixed(2)}s)`);
        
        if (auth.currentUser.emailVerified) {
          setIsEmailVerified(true);
          addToast("Email Verified Successfully!", "success");
          clearInterval(intervalId);
        }
      } catch (err) {
        console.warn("Background verification check failed:", err.message);
      }
    }, 10000);

    return () => clearInterval(intervalId);
  }, [isEmailVerified, auth.currentUser]);

  const handleManualCheck = async () => {
    if (!auth.currentUser) return;
    setIsChecking(true);
    const startTime = performance.now();
    try {
      await auth.currentUser.reload();
      const duration = performance.now() - startTime;
      const seconds = (duration / 1000).toFixed(2);
      console.log(`[PERFORMANCE] Manual check completed in ${duration.toFixed(0)}ms (${seconds}s)`);
      if (auth.currentUser.emailVerified) {
        setIsEmailVerified(true);
        addToast(`Email Verified! (Response time: ${seconds}s)`, "success");
      } else {
        addToast(`Email not verified yet. (Response time: ${seconds}s)`, "info");
      }
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setIsChecking(false);
    }
  };

  const handleResend = async () => {
    if (!auth.currentUser) return;
    setIsResending(true);
    setResendSuccess(false);
    if (resendTimeoutRef.current) clearTimeout(resendTimeoutRef.current);
    try {
      await sendEmailVerification(auth.currentUser);
      setResendSuccess(true);
      addToast("Verification link sent! Please check your Inbox or Spam folder.", "success");
      resendTimeoutRef.current = setTimeout(() => setResendSuccess(false), 5000);
    } catch (err) {
      if (err.code === 'auth/too-many-requests') {
        addToast("Please wait a few minutes before requesting another verification email.", "warning");
      } else {
        addToast(err.message, "error");
      }
    } finally {
      setIsResending(false);
    }
  };

  if (isEmailVerified) return null;

    const lang = userProfile?.language || 'ENGLISH';

    return (
      <View style={{
        backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
        borderBottomWidth: 1,
        borderBottomColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
        paddingVertical: 12,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Feather name="alert-triangle" size={16} color={COLORS.danger} style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 13, color: isDarkMode ? '#FCA5A5' : '#991B1B', fontWeight: '700', flex: 1 }}>
              {t('verifyBanner', lang)}
            </Text>
          </View>
          {resendSuccess && (
            <Text style={{ fontSize: 11, color: isDarkMode ? '#FCD34D' : '#92400E', fontWeight: '600', marginTop: 4, marginLeft: 24 }}>
              Check your Inbox or Spam folder.
            </Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={handleManualCheck}
            disabled={isChecking}
            style={{
              backgroundColor: isDarkMode ? '#2A2A2A' : '#E2E8F0',
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderWidth: 1,
              borderColor: isDarkMode ? '#3A3A3A' : '#CBD5E1'
            }}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color={COLORS.textPrimary} />
            ) : (
              <Text style={{ color: COLORS.textPrimary, fontSize: 11, fontWeight: '800' }}>
                {t('checkNow', lang)}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleResend}
            disabled={isResending || resendSuccess}
            style={{
              backgroundColor: COLORS.danger,
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6
            }}
          >
            {isResending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                {resendSuccess ? t('linkSent', lang) : t('resendLink', lang)}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }
