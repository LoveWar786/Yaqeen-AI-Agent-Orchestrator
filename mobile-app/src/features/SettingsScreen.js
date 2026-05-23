import React, { useState, useEffect } from 'react';
import { Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EmailAuthProvider, reauthenticateWithCredential, updateProfile, verifyBeforeUpdateEmail, updatePassword, deleteUser, sendEmailVerification } from 'firebase/auth';
import { doc, updateDoc, setDoc, getDocs, query, collection, where } from 'firebase/firestore';
import { t } from '../utils/translations';

export default function SettingsScreen({
  user,
  userProfile,
  setUser,
  setUserProfile,
  isDarkMode,
  COLORS,
  styles,
  db,
  auth,
  addToast,
  getBackendUrl,
  notifyAction,
  pendingEmail,
  setPendingEmail,
  showEmailVerifiedBadge,
  setShowEmailVerifiedBadge,
  tempPasswordRef,
  setDialogConfig,
  setDialogVisible,
  setCurrentTab
}) {
  const lang = userProfile?.language || 'ENGLISH';
  const [profileActiveTab, setProfileActiveTab] = useState('account');
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [updateNameVal, setUpdateNameVal] = useState(userProfile?.name || user?.displayName || '');
  const [updateEmailVal, setUpdateEmailVal] = useState(userProfile?.email || user?.email || '');
  const [updatePassVal, setUpdatePassVal] = useState('');
  const [confirmPassVal, setConfirmPassVal] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');

  // Sync inputs whenever the profile or user updates
  useEffect(() => {
    if (userProfile) {
      setUpdateNameVal(userProfile.name || user?.displayName || '');
      setUpdateEmailVal(userProfile.email || user?.email || '');
    } else if (user) {
      setUpdateNameVal(user.displayName || '');
      setUpdateEmailVal(user.email || '');
    }
  }, [userProfile, user]);
  
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [showDeletePass, setShowDeletePass] = useState(false);

  const [deleteConfirmPass, setDeleteConfirmPass] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');



  const [isResending, setIsResending] = useState(false);
  const [isCancellingEmail, setIsCancellingEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');

  // Account Preferences States
  const [showPrefModal, setShowPrefModal] = useState(false);
  const [prefLang, setPrefLang] = useState(userProfile?.language || 'ENGLISH');
  const isRTL = prefLang === 'URDU';
  const [prefPush, setPrefPush] = useState(userProfile?.pushNotificationsEnabled !== false);
  const [prefEmail, setPrefEmail] = useState(userProfile?.emailOffersEnabled !== false);
  const [prefFloating, setPrefFloating] = useState(userProfile?.showFloatingIcon !== false);

  const [customBackendVal, setCustomBackendVal] = useState(global.customBackendUrl || '');
  const showDeveloperSettings = __DEV__ || user?.email === 'dev@yaqeen-aiseekho.com';

  useEffect(() => {
    async function loadBackendUrl() {
      try {
        const storedUrl = await AsyncStorage.getItem('custom_backend_url');
        if (storedUrl) {
          setCustomBackendVal(storedUrl);
        } else {
          setCustomBackendVal('');
        }
      } catch (e) {
        console.warn("Failed to load backend URL:", e);
      }
    }
    if (showPrefModal) {
      loadBackendUrl();
    }
  }, [showPrefModal]);

  const saveCustomBackend = async () => {
    try {
      if (customBackendVal.trim() === '') {
        await AsyncStorage.removeItem('custom_backend_url');
        global.customBackendUrl = null;
        addToast("Custom backend URL removed. Defaulting to production Vercel.", "success");
      } else {
        const urlToSave = customBackendVal.trim();
        if (!urlToSave.startsWith('http://') && !urlToSave.startsWith('https://')) {
          addToast("Invalid URL! Must start with http:// or https://", "error");
          return;
        }
        await AsyncStorage.setItem('custom_backend_url', urlToSave);
        global.customBackendUrl = urlToSave;
        addToast("Backend URL updated successfully!", "success");
      }
    } catch (e) {
      addToast("Failed to save custom backend URL: " + e.message, "error");
    }
  };

  useEffect(() => {
    if (userProfile) {

      // Sync preferences
      setPrefLang(userProfile.language || 'ENGLISH');
      setPrefPush(userProfile.pushNotificationsEnabled !== false);
      setPrefEmail(userProfile.emailOffersEnabled !== false);
      setPrefFloating(userProfile.showFloatingIcon !== false);
    }
  }, [userProfile]);

  const savePreferences = async (updatedPrefs) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, updatedPrefs).catch(async (err) => {
        // Fallback to setDoc with merge if document does not exist yet
        await setDoc(userRef, updatedPrefs, { merge: true });
      });
      setUserProfile(prev => ({ ...prev, ...updatedPrefs }));
      addToast("Preferences updated successfully!", "success");
    } catch (e) {
      addToast("Failed to save preferences: " + e.message, "error");
    }
  };

  const handleSecureProfileUpdate = async (type) => {
    if (!currentPassword) {
      setError("Please enter your Current Password to save changes.");
      return;
    }
    setProfileLoading(true);
    setError(null);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      let notifications = [];

      // 1. NAME UPDATE
      const currentName = userProfile?.name || user?.displayName || '';
      if (type === 'all' && updateNameVal && updateNameVal !== currentName) {
        await updateProfile(auth.currentUser, { displayName: updateNameVal });
        setUser({ ...auth.currentUser, displayName: updateNameVal });
        
        // Write the custom name to the Firestore 'users' document
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { name: updateNameVal }).catch(async (err) => {
          await setDoc(userRef, { name: updateNameVal }, { merge: true });
        });
        
        if (setUserProfile) {
          setUserProfile(prev => ({ ...prev, name: updateNameVal }));
        }
        notifications.push("Name updated");
      }

      // 2. EMAIL UPDATE (Verification Flow)
      if (type === 'all' && updateEmailVal && updateEmailVal !== user.email) {
        const emailCheck = await getDocs(query(collection(db, 'users'), where('email', '==', updateEmailVal)));
        if (!emailCheck.empty) throw new Error("This email is already associated with another account.");

        await verifyBeforeUpdateEmail(auth.currentUser, updateEmailVal);
        tempPasswordRef.current = currentPassword;
        
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { pendingEmail: updateEmailVal, uid: user.uid }).catch(async (err) => {
          if (err.code === 'not-found') await setDoc(userRef, { uid: user.uid, pendingEmail: updateEmailVal, email: user.email });
          else throw err;
        });
        
        setPendingEmail(updateEmailVal);
        notifications.push("Verification link sent to new email");
      }

      // 3. PASSWORD UPDATE
      if (type === 'password' && updatePassVal) {
        if (updatePassVal !== confirmPassVal) throw new Error("Passwords do not match!");
        await updatePassword(auth.currentUser, updatePassVal);
        notifications.push("Password updated");
        setUpdatePassVal('');
        setConfirmPassVal('');
      }

      if (notifications.length > 0) {
        notifyAction("Profile Updated", notifications.join(", ") + ".");
      } else {
        notifyAction("No Changes", "No new information was detected to update.");
      }
      
      setCurrentPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!currentPassword) {
      setError("Please enter Current Password to resend verification.");
      return;
    }
    setIsResending(true);
    setResendSuccess('');
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await verifyBeforeUpdateEmail(auth.currentUser, pendingEmail);
      setResendSuccess("Email sent!");
      setTimeout(() => setResendSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsResending(false);
    }
  };

  const handleCancelEmailChange = async () => {
    setDialogConfig({
      title: "Cancel Change",
      message: "Are you sure you want to stop the email update process?",
      type: 'confirm',
      confirmText: 'Stop Process',
      cancelText: 'Go Back',
      onConfirm: async () => {
        setDialogVisible(false);
        setIsCancellingEmail(true);
        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { pendingEmail: null });
          setPendingEmail(null);
          addToast("Email change process has been stopped.", 'info');
        } catch (err) {
          setError(err.message);
        } finally {
          setIsCancellingEmail(false);
        }
      }
    });
    setDialogVisible(true);
  };



  return (
    <>
      <View style={styles.settingsWrapper}>
      {/* Top Navigation Tabs */}
      <View style={styles.settingsTopNav}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <Text style={styles.sidebarTitle}>Account</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity onPress={() => setShowPrefModal(true)} style={[styles.closeBtn, { marginRight: 4 }]}>
              <Feather name="settings" size={18} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCurrentTab('home')} style={styles.closeBtn}>
              <Feather name="x" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
          <TouchableOpacity 
            style={[styles.sidebarItem, profileActiveTab === 'account' && styles.sidebarItemActive, { flex: 1, minWidth: 100, justifyContent: 'center' }]} 
            onPress={() => setProfileActiveTab('account')}
          >
            <Feather name="user" size={18} color={profileActiveTab === 'account' ? COLORS.primary : COLORS.textSecondary} />
            <Text style={[styles.sidebarText, profileActiveTab === 'account' && styles.sidebarTextActive]}>Account</Text>
          </TouchableOpacity>



          <TouchableOpacity 
            style={[styles.sidebarItem, profileActiveTab === 'security' && styles.sidebarItemActive, { flex: 1, minWidth: 100, justifyContent: 'center' }]} 
            onPress={() => setProfileActiveTab('security')}
          >
            <Feather name="shield" size={18} color={profileActiveTab === 'security' ? COLORS.primary : COLORS.textSecondary} />
            <Text style={[styles.sidebarText, profileActiveTab === 'security' && styles.sidebarTextActive]}>Security</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.sidebarItem, profileActiveTab === 'danger' && styles.sidebarItemActive, { flex: 1, minWidth: 100, justifyContent: 'center' }]} 
            onPress={() => setProfileActiveTab('danger')}
          >
            <Feather name="trash-2" size={18} color={profileActiveTab === 'danger' ? COLORS.danger : COLORS.textSecondary} />
            <Text style={[styles.sidebarText, profileActiveTab === 'danger' && { color: COLORS.danger }]}>Danger</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Content Area */}
      <View style={styles.settingsContent}>
        <View>
          <Text style={styles.contentTitle}>
            {profileActiveTab === 'account' && 'Account Information'}
            {profileActiveTab === 'security' && 'Password & Security'}
            {profileActiveTab === 'danger' && 'Danger Zone'}
          </Text>
          <Text style={styles.contentSubtitle}>
            {profileActiveTab === 'account' && 'Update your personal details and email address.'}
            {profileActiveTab === 'security' && 'Secure your account with a strong password.'}
            {profileActiveTab === 'danger' && 'Permanently delete your account and data.'}
          </Text>
        </View>

        {error && (
          <View style={[styles.errorCard, { marginTop: 12 }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={{ marginTop: 24 }}>
          {profileActiveTab === 'account' && (
            <View>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <Feather name="user" size={16} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput 
                  style={styles.compactInput} 
                  value={updateNameVal} 
                  onChangeText={setUpdateNameVal} 
                  placeholder="Enter full name"
                  placeholderTextColor={COLORS.textSecondary + '66'}
                />
              </View>

              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Feather name="mail" size={16} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput 
                  style={styles.compactInput} 
                  value={updateEmailVal} 
                  onChangeText={setUpdateEmailVal} 
                  autoCapitalize="none"
                  placeholder="Enter email address"
                  placeholderTextColor={COLORS.textSecondary + '66'}
                />
              </View>

              {auth.currentUser && !auth.currentUser.emailVerified && !auth.currentUser.providerData?.some(p => p.providerId === 'google.com') && (
                <View style={{
                  backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
                  borderRadius: 12,
                  padding: 12,
                  marginTop: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                    <Feather name="alert-triangle" size={14} color={COLORS.danger} style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 12, color: isDarkMode ? '#FCA5A5' : '#991B1B', fontWeight: '700', flex: 1 }} numberOfLines={1}>
                      Email address is not verified
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        await sendEmailVerification(auth.currentUser);
                        addToast("Verification link resent! Please check your inbox.", "success");
                      } catch (err) {
                        addToast(err.message, "error");
                      }
                    }}
                    style={{
                      backgroundColor: COLORS.danger,
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      borderRadius: 6
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>Resend Email</Text>
                  </TouchableOpacity>
                </View>
              )}

              {pendingEmail && (
                <View style={{ 
                  marginTop: 12, 
                  padding: 16, 
                  backgroundColor: isDarkMode ? '#F59E0B15' : '#FFFBEB', 
                  borderWidth: 1, 
                  borderColor: isDarkMode ? '#F59E0B40' : '#FEF3C7', 
                  borderRadius: 16 
                }}>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Feather name="alert-circle" size={20} color={COLORS.warning} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.warning, fontSize: 16, fontWeight: '700' }}>Verification Pending</Text>
                      <Text style={{ color: isDarkMode ? COLORS.textSecondary : '#92400E', fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                        An email change to <Text style={{ fontWeight: '800' }}>{pendingEmail}</Text> is pending. 
                        Please check your inbox and verify the new email address to complete the update.
                      </Text>
                      
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 16 }}>
                        <TouchableOpacity 
                          onPress={handleResendVerification}
                          disabled={isResending}
                          style={{ 
                            backgroundColor: isDarkMode ? '#F59E0B30' : '#FEF3C7', 
                            paddingHorizontal: 12, 
                            paddingVertical: 8, 
                            borderRadius: 8,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          {isResending ? <ActivityIndicator size="small" color={COLORS.warning} /> : null}
                          <Text style={{ color: isDarkMode ? '#FBBF24' : '#92400E', fontSize: 11, fontWeight: '700' }}>
                            {isResending ? 'Resending...' : 'Resend Verification Email'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          onPress={handleCancelEmailChange}
                          disabled={isCancellingEmail}
                          style={{ paddingVertical: 8 }}
                        >
                          <Text style={{ color: isDarkMode ? COLORS.textSecondary : '#64748B', fontSize: 11, fontWeight: '700' }}>
                            {isCancellingEmail ? 'Cancelling...' : 'Cancel Change'}
                          </Text>
                        </TouchableOpacity>

                        {resendSuccess !== '' && (
                          <Text style={{ color: COLORS.success, fontSize: 11, fontWeight: '700' }}>{resendSuccess}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {showEmailVerifiedBadge && (
                 <View style={{ backgroundColor: COLORS.success + '15', padding: 8, borderRadius: 8, marginTop: 4, flexDirection: 'row', alignItems: 'center' }}>
                   <Feather name="check-circle" size={12} color={COLORS.success} style={{ marginRight: 6 }} />
                   <Text style={{ color: COLORS.success, fontSize: 11, fontWeight: '700' }}>EMAIL VERIFIED</Text>
                 </View>
               )}

              <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 24, opacity: 0.5 }} />

              <Text style={styles.inputLabel}>Current Password (Required to save changes)</Text>
              <View style={styles.inputWrapper}>
                <Feather name="lock" size={16} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput 
                  style={styles.compactInput} 
                  value={currentPassword} 
                  onChangeText={setCurrentPassword} 
                  placeholder="Enter current password" 
                  placeholderTextColor={COLORS.textSecondary + '66'}
                  secureTextEntry={!showCurrentPass} 
                />
                <TouchableOpacity onPress={() => setShowCurrentPass(!showCurrentPass)}>
                  <Feather name={showCurrentPass ? "eye-off" : "eye"} size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 24, opacity: 0.5 }} />

              <TouchableOpacity 
                style={styles.button} 
                onPress={() => handleSecureProfileUpdate('all')}
                disabled={profileLoading}
              >
                {profileLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save All Changes</Text>}
              </TouchableOpacity>
            </View>
          )}

          {profileActiveTab === 'security' && (
            <View>
              <Text style={styles.inputLabel}>New Password</Text>
              <View style={styles.inputWrapper}>
                <Feather name="lock" size={16} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput 
                  style={styles.compactInput} 
                  value={updatePassVal} 
                  onChangeText={setUpdatePassVal} 
                  placeholder="Enter new password"
                  placeholderTextColor={COLORS.textSecondary + '66'}
                  secureTextEntry={!showNewPass}
                />
                <TouchableOpacity onPress={() => setShowNewPass(!showNewPass)}>
                  <Feather name={showNewPass ? "eye-off" : "eye"} size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <View style={styles.inputWrapper}>
                <Feather name="lock" size={16} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput 
                  style={styles.compactInput} 
                  value={confirmPassVal} 
                  onChangeText={setConfirmPassVal} 
                  placeholder="Re-type new password"
                  placeholderTextColor={COLORS.textSecondary + '66'}
                  secureTextEntry={!showConfirmPass}
                />
                <TouchableOpacity onPress={() => setShowConfirmPass(!showConfirmPass)}>
                  <Feather name={showConfirmPass ? "eye-off" : "eye"} size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 24, opacity: 0.5 }} />

              <Text style={styles.inputLabel}>Current Password (Required)</Text>
              <View style={styles.inputWrapper}>
                <Feather name="lock" size={16} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput 
                  style={styles.compactInput} 
                  value={currentPassword} 
                  onChangeText={setCurrentPassword} 
                  placeholder="Enter current password" 
                  placeholderTextColor={COLORS.textSecondary + '66'}
                  secureTextEntry={!showCurrentPass}
                />
                <TouchableOpacity onPress={() => setShowCurrentPass(!showCurrentPass)}>
                  <Feather name={showCurrentPass ? "eye-off" : "eye"} size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[styles.button, { marginTop: 12 }]} 
                onPress={() => handleSecureProfileUpdate('password')}
                disabled={profileLoading}
              >
                {profileLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update Password</Text>}
              </TouchableOpacity>
            </View>
          )}

          {profileActiveTab === 'danger' && (
            <View style={styles.dangerBox}>
              <View style={styles.dangerHeader}>
                <View style={styles.warningIconCircle}>
                  <Feather name="alert-triangle" size={20} color={COLORS.danger} />
                </View>
                <View style={{ marginLeft: 16 }}>
                  <Text style={styles.dangerTitle}>Delete Account</Text>
                  <Text style={styles.dangerDesc}>This action is permanent and cannot be undone. It will delete your profile, saved data, and history.</Text>
                </View>
              </View>

              <Text style={[styles.inputLabel, { marginTop: 20 }]}>Enter your password to confirm</Text>
              <View style={styles.inputWrapper}>
                <Feather name="lock" size={16} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput 
                  style={styles.compactInput} 
                  value={deleteConfirmPass} 
                  onChangeText={setDeleteConfirmPass} 
                  placeholder="Your password" 
                  placeholderTextColor={COLORS.textSecondary + '66'}
                  secureTextEntry={!showDeletePass}
                />
                <TouchableOpacity onPress={() => setShowDeletePass(!showDeletePass)}>
                  <Feather name={showDeletePass ? "eye-off" : "eye"} size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Type DELETE to confirm</Text>
              <View style={styles.inputWrapper}>
                <TextInput 
                  style={styles.compactInput} 
                  value={deleteConfirmText} 
                  onChangeText={setDeleteConfirmText} 
                  placeholder="DELETE" 
                  placeholderTextColor={COLORS.textSecondary + '66'}
                />
              </View>
              
              <TouchableOpacity 
                style={[styles.dangerButton, { marginTop: 24, opacity: (deleteConfirmText === 'DELETE' && deleteConfirmPass) ? 1 : 0.5 }]} 
                onPress={async () => {
                  if (deleteConfirmText !== 'DELETE') return;
                  setProfileLoading(true);
                  try {
                    const credential = EmailAuthProvider.credential(user.email, deleteConfirmPass);
                    await reauthenticateWithCredential(auth.currentUser, credential);
                    await deleteUser(auth.currentUser);
                    setUser(null);
                  } catch (err) {
                    setError(err.message);
                  } finally {
                    setProfileLoading(false);
                  }
                }}
                disabled={profileLoading || deleteConfirmText !== 'DELETE' || !deleteConfirmPass}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="trash-2" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.buttonText}>Delete My Account Permanently</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}


        </View>
      </View>
    </View>

      {/* Preferences Modal (Settings Gear Window) */}
      <Modal transparent visible={showPrefModal} animationType="slide" onRequestClose={() => setShowPrefModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { width: '90%', maxWidth: 400, borderRadius: 24, padding: 24 }]}>
            {/* Header */}
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="settings" size={20} color={COLORS.primary} />
                <Text style={{ fontSize: 18, fontWeight: '900', color: COLORS.textPrimary }}>{t('preferences', lang)}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPrefModal(false)} style={{ padding: 4 }}>
                <Feather name="x" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Language Selector */}
            <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>{t('language', lang).toUpperCase()}</Text>
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              backgroundColor: COLORS.input, 
              paddingHorizontal: 16, 
              paddingVertical: 12, 
              borderRadius: 14, 
              borderWidth: 1, 
              borderColor: COLORS.border,
              marginBottom: 20
            }}>
              <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 14 }}>
                {prefLang === 'URDU' ? t('languageUrdu', lang) : t('languageEnglish', lang)}
              </Text>
              <TouchableOpacity 
                onPress={() => {
                  const nextLang = prefLang === 'ENGLISH' ? 'URDU' : 'ENGLISH';
                  setPrefLang(nextLang);
                  savePreferences({ language: nextLang });
                }}
                style={{ 
                  backgroundColor: COLORS.primary + '15', 
                  paddingVertical: 6, 
                  paddingHorizontal: 12, 
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: COLORS.primary + '30'
                }}
              >
                <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '800' }}>{t('edit', lang)}</Text>
              </TouchableOpacity>
            </View>

            {/* Checkbox 1: Receive Push Notifications */}
            <TouchableOpacity 
              onPress={() => {
                const nextVal = !prefPush;
                setPrefPush(nextVal);
                savePreferences({ pushNotificationsEnabled: nextVal });
              }}
              style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: 16, gap: 12 }}
            >
              <View style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: prefPush ? COLORS.primary : COLORS.border,
                backgroundColor: prefPush ? COLORS.primary : 'transparent',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                {prefPush && <Feather name="check" size={14} color="#fff" />}
              </View>
              <Text style={{ color: COLORS.textPrimary, fontWeight: '600', fontSize: 14, textAlign: isRTL ? 'right' : 'left', flex: 1 }}>{t('pushNotifications', lang)}</Text>
            </TouchableOpacity>

            {/* Checkbox 2: Receive Offers by Email */}
            <TouchableOpacity 
              onPress={() => {
                const nextVal = !prefEmail;
                setPrefEmail(nextVal);
                savePreferences({ emailOffersEnabled: nextVal });
              }}
              style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: 16, gap: 12 }}
            >
              <View style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: prefEmail ? COLORS.primary : COLORS.border,
                backgroundColor: prefEmail ? COLORS.primary : 'transparent',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                {prefEmail && <Feather name="check" size={14} color="#fff" />}
              </View>
              <Text style={{ color: COLORS.textPrimary, fontWeight: '600', fontSize: 14, textAlign: isRTL ? 'right' : 'left', flex: 1 }}>{t('emailOffers', lang)}</Text>
            </TouchableOpacity>

            {/* Checkbox 3: Show Floating Icon */}
            <TouchableOpacity 
              onPress={() => {
                const nextVal = !prefFloating;
                setPrefFloating(nextVal);
                savePreferences({ showFloatingIcon: nextVal });
              }}
              style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}
            >
              <View style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: prefFloating ? COLORS.primary : COLORS.border,
                backgroundColor: prefFloating ? COLORS.primary : 'transparent',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                {prefFloating && <Feather name="check" size={14} color="#fff" />}
              </View>
              <Text style={{ color: COLORS.textPrimary, fontWeight: '600', fontSize: 14, textAlign: isRTL ? 'right' : 'left', flex: 1 }}>{t('floatingIcon', lang)}</Text>
            </TouchableOpacity>

            {showDeveloperSettings && (
              <>
                {/* Divider */}
                <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 20, opacity: 0.5 }} />

                {/* Developer Settings: Custom Backend Connection */}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 }}>
                    DEVELOPER SETTINGS
                  </Text>
                  <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 12 }}>
                    Optionally specify a custom backend server (e.g., Ngrok tunnel) to override the default production Vercel server. Leave blank to use production.
                  </Text>
                  <View style={[styles.inputWrapper, { marginBottom: 12, backgroundColor: COLORS.input }]}>
                    <Feather name="link" size={16} color={COLORS.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.compactInput, { color: COLORS.textPrimary }]}
                      value={customBackendVal}
                      onChangeText={setCustomBackendVal}
                      placeholder="https://your-ngrok-tunnel.ngrok-free.app"
                      placeholderTextColor={COLORS.textSecondary + '66'}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={saveCustomBackend}
                    style={{
                      backgroundColor: COLORS.primary,
                      paddingVertical: 10,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>
                      Save Developer Settings
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
