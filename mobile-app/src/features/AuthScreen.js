import React, { useState, useEffect, useRef } from 'react';
import { Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Modal } from 'react-native';
import { Feather, AntDesign } from '@expo/vector-icons';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, sendEmailVerification, GoogleAuthProvider, signInWithPopup, EmailAuthProvider, linkWithCredential, signInWithCredential } from 'firebase/auth';

let GoogleSignin = null;
let statusCodes = null;

try {
  const GoogleSigninModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = GoogleSigninModule.GoogleSignin;
  statusCodes = GoogleSigninModule.statusCodes;
  
  if (GoogleSignin) {
    GoogleSignin.configure({
      webClientId: '646797174375-53mha1tul9jaatq16sou4o4lv2620m6m.apps.googleusercontent.com',
      scopes: ['profile', 'email'],
    });
  }
} catch (e) {
  console.log("Google Sign-In is not supported in this client environment:", e.message);
}

import { doc, getDoc, setDoc } from 'firebase/firestore';
import YaqeenLogo from './YaqeenLogo';
import { SKILLS_LIST, SKILL_KEYWORDS, generateProviderKeywords } from '../utils/translations';

const SKILL_ICONS = {
  "AC Technician": { family: 'Feather', name: 'wind' },
  "Plumber": { family: 'Feather', name: 'droplet' },
  "Electrician": { family: 'Feather', name: 'zap' },
  "Carpenter": { family: 'Feather', name: 'tool' },
  "Painter": { family: 'Feather', name: 'aperture' },
  "Saloon": { family: 'Feather', name: 'scissors' },
  "Beauty Parlor": { family: 'Feather', name: 'heart' },
  "Tutor": { family: 'Feather', name: 'book-open' },
  "Junk Collector": { family: 'Feather', name: 'trash-2' },
  "Garbage Collector": { family: 'Feather', name: 'trash' },
  "Water Tanker": { family: 'Feather', name: 'truck' },
  "Doctor": { family: 'Feather', name: 'activity' },
  "Nurse": { family: 'Feather', name: 'plus-circle' },
  "Car Wash & Detailing": { family: 'AntDesign', name: 'car' },
  "Appliance Repair": { family: 'Feather', name: 'tv' },
  "Cleaning & Janitorial": { family: 'Feather', name: 'home' },
  "Gardening & Landscaping": { family: 'Feather', name: 'feather' },
  "Pest Control": { family: 'Feather', name: 'slash' },
  "Home Security & CCTV": { family: 'Feather', name: 'video' },
  "Sofa & Upholstery Repair": { family: 'Feather', name: 'layers' },
  "Masonry & Construction": { family: 'Feather', name: 'box' },
  "Barber & Grooming": { family: 'Feather', name: 'scissors' },
  "Tailoring & Stitching": { family: 'Feather', name: 'scissors' },
  "IT & Computer Repair": { family: 'Feather', name: 'monitor' },
  "Mobile Phone Repair": { family: 'Feather', name: 'smartphone' },
  "Moving & Packers": { family: 'Feather', name: 'package' },
  "Automobile Mechanic": { family: 'Feather', name: 'settings' },
  "Generator Repair": { family: 'Feather', name: 'zap' },
  "Key Maker & Locksmith": { family: 'Feather', name: 'key' },
  "Disinfection & Sanitization": { family: 'Feather', name: 'shield' },
  "Other": { family: 'Feather', name: 'plus-circle' }
};

const renderSkillIcon = (skill, size = 16, color = '#A855F7') => {
  const iconConfig = SKILL_ICONS[skill] || { family: 'Feather', name: 'help-circle' };
  if (iconConfig.family === 'AntDesign') {
    return <AntDesign name={iconConfig.name} size={size} color={color} />;
  }
  return <Feather name={iconConfig.name} size={size} color={color} />;
};

export default function AuthScreen({
  isDarkMode,
  COLORS,
  styles,
  db,
  auth,
  loading,
  setLoading,
  setUser,
  setIsProviderMode,
  addToast,
  getBackendUrl,
  notifyAction,
  isLoggingInRef
}) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [loginRole, setLoginRole] = useState('user');
  const [regRole, setRegRole] = useState('user');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showGooglePassword, setShowGooglePassword] = useState(false);
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  
  const [lookupMode, setLookupMode] = useState('ai_search');
  const [lookupQuery, setLookupQuery] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [foundShop, setFoundShop] = useState(null);
  
  const [shopName, setShopName] = useState('');
  const [shopBranch, setShopBranch] = useState('');
  const [visitingCharges, setVisitingCharges] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [shopLink, setShopLink] = useState('');
  const [primarySkill, setPrimarySkill] = useState('');
  const [customSkill, setCustomSkill] = useState('');
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [skillSearchQuery, setSkillSearchQuery] = useState('');
  
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [showGoogleRegModal, setShowGoogleRegModal] = useState(false);
  const [googlePassword, setGooglePassword] = useState('');
  const [tempGoogleUser, setTempGoogleUser] = useState(null);
  
  const [error, setError] = useState(null);

  const handleAuth = async () => {
    if (!email || !password || (!isLoginMode && !name)) {
      setError('Please fill all required fields');
      return;
    }
    if (!isLoginMode && regRole === 'provider') {
      if (!primarySkill) {
        setError('Please select your primary skill');
        return;
      }
      if (primarySkill === 'Other' && !customSkill.trim()) {
        setError('Please type your custom profession');
        return;
      }
    }
    setLoading(true);
    setError(null);
    isLoggingInRef.current = true;

    try {
      if (isLoginMode) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const loggedUser = userCredential.user;

        const userSnap = await getDoc(doc(db, 'users', loggedUser.uid));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setIsProviderMode(userData.role === 'provider');
          setUser(loggedUser);
        } else {
           await auth.signOut();
           isLoggingInRef.current = false;
           throw new Error("ACCESS DENIED: Profile not found. Please register first.");
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });

        // Send verification email immediately after account creation
        try {
          await sendEmailVerification(userCredential.user);
          addToast("Verification email sent! Please check your Inbox or Spam folder.", "info");
        } catch (verifyErr) {
          console.warn("[AUTH] Failed to send verification email:", verifyErr.message);
        }
        
        let pLat = null;
        let pLng = null;
        if (regRole === 'provider') {
          try {
            const fullAddress = `${shopAddress ? shopAddress + ', ' : ''}${area}, ${city}`;
            const geocodeRes = await fetch(getBackendUrl('/api/forward-geocode'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address: fullAddress })
            });
            const geocodeData = await geocodeRes.json();
            if (geocodeRes.ok && geocodeData.lat && geocodeData.lng) {
              pLat = geocodeData.lat;
              pLng = geocodeData.lng;
            }
          } catch (err) {
            console.warn("Failed to geocode provider registration address:", err);
          }
        }

        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          role: regRole,
          name: name,
          providerID: regRole === 'provider' ? `PRO-${userCredential.user.uid.substring(0, 4).toUpperCase()}` : null,
          shopName: regRole === 'provider' ? '' : null,
          branch: regRole === 'provider' ? '' : null,
          visitingCharges: regRole === 'provider' ? 0 : null,
          phoneNumber: regRole === 'provider' ? '' : null,
          shopLink: regRole === 'provider' ? '' : null,
          city: city || null,
          area: area || null,
          shopAddress: regRole === 'provider' ? '' : null,
          landmark: regRole === 'provider' ? '' : null,
          latitude: pLat,
          longitude: pLng,
          locationCoords: pLat ? { lat: pLat, lng: pLng } : null,
          primarySkill: regRole === 'provider' ? (primarySkill === 'Other' ? customSkill.trim() : primarySkill) : null,
          roleTitle: regRole === 'provider' ? (primarySkill === 'Other' ? customSkill.trim() : primarySkill) : null,
          servicesList: regRole === 'provider' ? generateProviderKeywords(primarySkill, customSkill, null) : null,
          isVerified: false,
          createdAt: Date.now()
        });

        setIsProviderMode(regRole === 'provider');
        setUser({ ...userCredential.user, displayName: name });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      isLoggingInRef.current = false;
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    isLoggingInRef.current = true;

    try {
      let googleUser;
      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
          prompt: 'select_account'
        });
        const result = await signInWithPopup(auth, provider);
        googleUser = result.user;
      } else {
        if (!GoogleSignin) {
          throw new Error("Google Sign-In is not supported in the standard Expo Go app. Please use Email/Password login, or build a custom Expo Development Build to use Google Sign-In.");
        }
        await GoogleSignin.hasPlayServices();
        
        // Force account selection on native by signing out prior to sign-in request
        try {
          await GoogleSignin.signOut();
        } catch (soErr) {
          console.log("[Google Sign-Out] No active Google session to clear:", soErr.message);
        }

        const userInfo = await GoogleSignin.signIn();
        const idToken = userInfo.data?.idToken || userInfo.idToken;
        if (!idToken) throw new Error("No ID token found");
        const googleCredential = GoogleAuthProvider.credential(idToken);
        const result = await signInWithCredential(auth, googleCredential);
        googleUser = result.user;
      }

      const userSnap = await getDoc(doc(db, 'users', googleUser.uid));
      if (!userSnap.exists()) {
        setTempGoogleUser(googleUser);
        setShowGoogleRegModal(true);
      } else {
        const userData = userSnap.data();
        setUser(googleUser);
        setIsProviderMode(userData.role === 'provider');
        addToast(`Welcome back, ${userData.displayName || 'User'}!`, 'success');
      }
    } catch (err) {
      if (err.code === statusCodes?.SIGN_IN_CANCELLED) {
        console.log("User cancelled Google Sign In");
      } else if (err.code === statusCodes?.IN_PROGRESS) {
        console.log("Google Sign In already in progress");
      } else if (err.code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) {
        addToast("Google Play Services not available", "error");
      } else {
        addToast("Google Login Error: " + err.message, "error");
        console.warn("Google Login failed:", err);
      }
    } finally {
      setLoading(false);
      isLoggingInRef.current = false;
    }
  };

  const handleGoogleFinalize = async () => {
    if (!googlePassword || (regRole === 'provider' && (!primarySkill || (primarySkill === 'Other' && !customSkill.trim())))) {
      setError("Please fill all required fields");
      return;
    }
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(tempGoogleUser.email, googlePassword);
      try {
        await linkWithCredential(auth.currentUser, credential);
      } catch (linkErr) {
        console.warn("Linking failed (might already be linked):", linkErr.message);
      }

      await setDoc(doc(db, 'users', tempGoogleUser.uid), {
        uid: tempGoogleUser.uid,
        name: tempGoogleUser.displayName || 'Google User',
        email: tempGoogleUser.email,
        role: regRole,
        shopName: regRole === 'provider' ? '' : null,
        branch: regRole === 'provider' ? '' : null,
        visitingCharges: regRole === 'provider' ? 0 : null,
        phoneNumber: regRole === 'provider' ? '' : null,
        shopLink: regRole === 'provider' ? '' : null,
        city: city || null,
        area: area || null,
        shopAddress: regRole === 'provider' ? '' : null,
        landmark: regRole === 'provider' ? '' : null,
        primarySkill: regRole === 'provider' ? (primarySkill === 'Other' ? customSkill.trim() : primarySkill) : null,
        roleTitle: regRole === 'provider' ? (primarySkill === 'Other' ? customSkill.trim() : primarySkill) : null,
        servicesList: regRole === 'provider' ? generateProviderKeywords(primarySkill, customSkill, null) : null,
        isVerified: true,
        createdAt: Date.now()
      });

      setIsProviderMode(regRole === 'provider');
      setUser(tempGoogleUser);
      setShowGoogleRegModal(false);
      setTempGoogleUser(null);
      setGooglePassword('');
      addToast("Account linked and finalized!", 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      addToast("Password reset link sent to your email!", 'success');
      setShowForgotModal(false);
      setForgotEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLookupShop = async () => {
    if (!lookupQuery) return;
    setIsLookingUp(true);
    setError(null);
    setFoundShop(null);
    try {
      const url = getBackendUrl('/api/lookup-shop');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: lookupQuery, 
          isLink: lookupMode === 'ai_link' 
        })
      });
      
      const text = await response.text();
      let data;
      try {
        if (!text || !text.trim()) {
          throw new Error("Empty response");
        }
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server returned an invalid response (${response.status}). Please check if the backend is running.`);
      }

      if (data.success) {
        setFoundShop(data.shop);
        addToast("Shop found! Please verify.", 'success');
      } else {
        throw new Error(data.error || "Could not find shop details.");
      }
    } catch (err) {
      setError(err.message);
      addToast(err.message, 'error');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleApplyShopDetails = () => {
    if (!foundShop) return;
    setShopName(foundShop.name || '');
    setShopBranch(foundShop.branch || '');
    setCity(foundShop.city || '');
    setArea(foundShop.area || '');
    setShopAddress(foundShop.address || '');
    setLandmark(foundShop.landmark || '');
    setShopLink(foundShop.shopLink || '');
    // Pre-fill phone number if available — provider can correct if needed
    if (foundShop.phone) {
      const cleaned = foundShop.phone.replace(/[^0-9]/g, '').slice(0, 11);
      if (cleaned) setPhoneNumber(cleaned);
    }

    setFoundShop(null);
    setLookupMode('manual');
    addToast("Details applied!", 'success');
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} style={{ backgroundColor: COLORS.background }}>
      <View style={styles.authContainer}>
        <View style={[styles.authCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <YaqeenLogo size={70} isDarkMode={isDarkMode} />
            <Text style={[styles.title, { color: COLORS.textPrimary, marginTop: 16 }]}>{isLoginMode ? 'Welcome to Yaqeen' : 'Join Yaqeen'}</Text>
            <Text style={[styles.subtitle, { color: COLORS.textSecondary }]}>AI Service Orchestrator</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
            <TouchableOpacity 
              style={[styles.toggleBtn, { flex: 1, marginBottom: 0 }, (isLoginMode ? loginRole === 'user' : regRole === 'user') && styles.toggleBtnActive]} 
              onPress={() => isLoginMode ? setLoginRole('user') : setRegRole('user')}
            >
              <Text style={[styles.toggleText, (isLoginMode ? loginRole === 'user' : regRole === 'user') && styles.toggleTextActive]}>User</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleBtn, { flex: 1, marginBottom: 0 }, (isLoginMode ? loginRole === 'provider' : regRole === 'provider') && styles.toggleBtnActive]} 
              onPress={() => isLoginMode ? setLoginRole('provider') : setRegRole('provider')}
            >
              <Text style={[styles.toggleText, (isLoginMode ? loginRole === 'provider' : regRole === 'provider') && styles.toggleTextActive]}>Provider</Text>
            </TouchableOpacity>
          </View>

          {!isLoginMode && (
            <View>
              <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor={COLORS.textSecondary} value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="City" placeholderTextColor={COLORS.textSecondary} value={city} onChangeText={setCity} />
              <TextInput style={styles.input} placeholder="Area / Sector" placeholderTextColor={COLORS.textSecondary} value={area} onChangeText={setArea} />
              
              {regRole === 'provider' && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.inputLabel, { color: COLORS.textPrimary, marginBottom: 8, fontWeight: '700' }]}>
                    Select Primary Skill *
                  </Text>
                  
                  <TouchableOpacity 
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderWidth: 1,
                      borderColor: showSkillDropdown ? COLORS.primary : COLORS.border,
                      borderRadius: 12,
                      padding: 12,
                      backgroundColor: isDarkMode ? '#1e1b4b' : '#faf5ff',
                      marginBottom: 8
                    }}
                    onPress={() => setShowSkillDropdown(!showSkillDropdown)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {primarySkill ? renderSkillIcon(primarySkill, 18, COLORS.primary) : <Feather name="briefcase" size={18} color={COLORS.textSecondary} />}
                      <Text style={{ color: primarySkill ? COLORS.textPrimary : COLORS.textSecondary, fontSize: 14, fontWeight: '600' }}>
                        {primarySkill || "Choose your skill..."}
                      </Text>
                    </View>
                    <Feather name={showSkillDropdown ? "chevron-up" : "chevron-down"} size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>

                  {showSkillDropdown && (
                    <View style={{
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      borderRadius: 12,
                      padding: 10,
                      backgroundColor: COLORS.card,
                      maxHeight: 250,
                      marginBottom: 12,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      elevation: 3
                    }}>
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        marginBottom: 8,
                        backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc'
                      }}>
                        <Feather name="search" size={14} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
                        <TextInput
                          style={{
                            flex: 1,
                            color: COLORS.textPrimary,
                            fontSize: 13,
                            paddingVertical: 6,
                            height: 36
                          }}
                          placeholder="Search skills..."
                          placeholderTextColor={COLORS.textSecondary}
                          value={skillSearchQuery}
                          onChangeText={setSkillSearchQuery}
                        />
                        {skillSearchQuery ? (
                          <TouchableOpacity onPress={() => setSkillSearchQuery('')}>
                            <Feather name="x" size={14} color={COLORS.textSecondary} />
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      <ScrollView nestedScrollEnabled={true} keyboardShouldPersistTaps="handled" style={{ maxHeight: 180 }}>
                        {SKILLS_LIST
                          .filter(skill => skill.toLowerCase().includes(skillSearchQuery.toLowerCase()))
                          .map((skill) => {
                            const isSelected = primarySkill === skill;
                            return (
                              <TouchableOpacity
                                key={skill}
                                onPress={() => {
                                  setPrimarySkill(skill);
                                  setShowSkillDropdown(false);
                                  setSkillSearchQuery('');
                                }}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  paddingVertical: 10,
                                  paddingHorizontal: 8,
                                  borderRadius: 8,
                                  backgroundColor: isSelected ? COLORS.primary + '22' : 'transparent',
                                  marginBottom: 2
                                }}
                              >
                                <View style={{ marginRight: 8 }}>
                                  {renderSkillIcon(skill, 16, isSelected ? COLORS.primary : COLORS.textSecondary)}
                                </View>
                                <Text style={{
                                  color: isSelected ? COLORS.primary : COLORS.textPrimary,
                                  fontSize: 13,
                                  fontWeight: isSelected ? '700' : '500',
                                  flex: 1
                                }}>
                                  {skill}
                                </Text>
                                {isSelected && <Feather name="check" size={14} color={COLORS.primary} />}
                              </TouchableOpacity>
                            );
                          })}
                        {SKILLS_LIST.filter(skill => skill.toLowerCase().includes(skillSearchQuery.toLowerCase())).length === 0 && (
                          <View style={{ alignItems: 'center', marginVertical: 8 }}>
                            <Text style={{ color: COLORS.textSecondary, textAlign: 'center', marginBottom: 8, fontSize: 12 }}>
                              No matching skills found.
                            </Text>
                            <TouchableOpacity
                              onPress={() => {
                                setPrimarySkill('Other');
                                setCustomSkill(skillSearchQuery);
                                setShowSkillDropdown(false);
                                setSkillSearchQuery('');
                              }}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: COLORS.primary + '15',
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: COLORS.primary + '33'
                              }}
                            >
                              <Feather name="plus-circle" size={14} color={COLORS.primary} style={{ marginRight: 6 }} />
                              <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '700' }}>
                                Use "{skillSearchQuery}" as custom skill
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  )}

                  {primarySkill === 'Other' && (
                    <View style={{ marginTop: 4 }}>
                      <Text style={[styles.inputLabel, { color: COLORS.textSecondary, marginBottom: 4, fontSize: 12 }]}>
                        Type your profession:
                      </Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Welding Specialist, Solar Installer"
                        placeholderTextColor={COLORS.textSecondary}
                        value={customSkill}
                        onChangeText={setCustomSkill}
                      />
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          <TextInput style={styles.input} placeholder="Email" placeholderTextColor={COLORS.textSecondary} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <View style={{ position: 'relative', width: '100%', marginBottom: 12 }}>
            <TextInput 
              style={[styles.input, { paddingRight: 45, marginBottom: 0 }]} 
              placeholder="Password" 
              placeholderTextColor={COLORS.textSecondary} 
              value={password} 
              onChangeText={setPassword} 
              secureTextEntry={!showPassword} 
            />
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: 12, top: 12, bottom: 12, justifyContent: 'center' }}
            >
              <Feather name={showPassword ? "eye" : "eye-off"} size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {isLoginMode && (
            <TouchableOpacity 
              style={{ alignSelf: 'flex-end', marginBottom: 20, marginTop: -8 }} 
              onPress={() => { setError(null); setShowForgotModal(true); setForgotEmail(email); }}
            >
              <Text style={{ color: COLORS.primary, fontSize: 13, fontWeight: '700' }}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {error && <Text style={styles.errorTextAuth}>{error}</Text>}

          <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isLoginMode ? `Login as ${loginRole === 'user' ? 'User' : 'Provider'}` : `Sign Up as ${regRole === 'user' ? 'User' : 'Provider'}`}</Text>}
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: COLORS.border }} />
            <Text style={{ color: COLORS.textSecondary, marginHorizontal: 10, fontSize: 12 }}>OR</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: COLORS.border }} />
          </View>

          <TouchableOpacity style={[styles.googleButton, { borderColor: COLORS.border }]} onPress={handleGoogleLogin} disabled={loading}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AntDesign name="google" size={18} color={COLORS.textPrimary} style={{ marginRight: 10 }} />
              <Text style={[styles.googleButtonText, { color: COLORS.textPrimary }]}>Continue with Google</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.switchButton} onPress={() => setIsLoginMode(!isLoginMode)}>
            <Text style={styles.switchButtonText}>{isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Login"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Forgot Password Modal */}
      <Modal visible={showForgotModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 400 }]}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={[styles.modalMessage, { marginBottom: 16 }]}>
              Enter your email address and we'll send you a link to reset your password.
            </Text>

            <TextInput 
              style={styles.input} 
              placeholder="Email Address" 
              placeholderTextColor={COLORS.textSecondary} 
              value={forgotEmail} 
              onChangeText={setForgotEmail} 
              autoCapitalize="none"
              keyboardType="email-address"
            />

            {error && <Text style={[styles.errorTextAuth, { marginBottom: 12 }]}>{error}</Text>}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={() => { setShowForgotModal(false); setError(null); }}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, { flex: 1, marginTop: 0 }]} onPress={handleForgotPassword} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Link</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Google Registration Finalize Modal */}
      <Modal visible={showGoogleRegModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 400, maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Finalize Registration</Text>
              <Text style={[styles.modalMessage, { marginBottom: 16 }]}>
                Please set a password for your email login and choose your role.
              </Text>

              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                <TouchableOpacity 
                  style={[styles.toggleBtn, { flex: 1, marginBottom: 0 }, regRole === 'user' && styles.toggleBtnActive]} 
                  onPress={() => setRegRole('user')}
                >
                  <Text style={[styles.toggleText, regRole === 'user' && styles.toggleTextActive]}>User</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.toggleBtn, { flex: 1, marginBottom: 0 }, regRole === 'provider' && styles.toggleBtnActive]} 
                  onPress={() => setRegRole('provider')}
                >
                  <Text style={[styles.toggleText, regRole === 'provider' && styles.toggleTextActive]}>Provider</Text>
                </TouchableOpacity>
              </View>

              <TextInput style={styles.input} placeholder="City" placeholderTextColor={COLORS.textSecondary} value={city} onChangeText={setCity} />
              <TextInput style={styles.input} placeholder="Area / Sector" placeholderTextColor={COLORS.textSecondary} value={area} onChangeText={setArea} />

              <View style={{ position: 'relative', width: '100%', marginBottom: 12 }}>
                <TextInput 
                  style={[styles.input, { paddingRight: 45, marginBottom: 0 }]} 
                  placeholder="Set Password for Email Login" 
                  placeholderTextColor={COLORS.textSecondary} 
                  value={googlePassword} 
                  onChangeText={setGooglePassword} 
                  secureTextEntry={!showGooglePassword} 
                />
                <TouchableOpacity 
                  onPress={() => setShowGooglePassword(!showGooglePassword)}
                  style={{ position: 'absolute', right: 12, top: 12, bottom: 12, justifyContent: 'center' }}
                >
                  <Feather name={showGooglePassword ? "eye" : "eye-off"} size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {regRole === 'provider' && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.inputLabel, { color: COLORS.textPrimary, marginBottom: 8, fontWeight: '700' }]}>
                    Select Primary Skill *
                  </Text>
                  
                  <TouchableOpacity 
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderWidth: 1,
                      borderColor: showSkillDropdown ? COLORS.primary : COLORS.border,
                      borderRadius: 12,
                      padding: 12,
                      backgroundColor: isDarkMode ? '#1e1b4b' : '#faf5ff',
                      marginBottom: 8
                    }}
                    onPress={() => setShowSkillDropdown(!showSkillDropdown)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {primarySkill ? renderSkillIcon(primarySkill, 18, COLORS.primary) : <Feather name="briefcase" size={18} color={COLORS.textSecondary} />}
                      <Text style={{ color: primarySkill ? COLORS.textPrimary : COLORS.textSecondary, fontSize: 14, fontWeight: '600' }}>
                        {primarySkill || "Choose your skill..."}
                      </Text>
                    </View>
                    <Feather name={showSkillDropdown ? "chevron-up" : "chevron-down"} size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>

                  {showSkillDropdown && (
                    <View style={{
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      borderRadius: 12,
                      padding: 10,
                      backgroundColor: COLORS.card,
                      maxHeight: 250,
                      marginBottom: 12,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      elevation: 3
                    }}>
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        marginBottom: 8,
                        backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc'
                      }}>
                        <Feather name="search" size={14} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
                        <TextInput
                          style={{
                            flex: 1,
                            color: COLORS.textPrimary,
                            fontSize: 13,
                            paddingVertical: 6,
                            height: 36
                          }}
                          placeholder="Search skills..."
                          placeholderTextColor={COLORS.textSecondary}
                          value={skillSearchQuery}
                          onChangeText={setSkillSearchQuery}
                        />
                        {skillSearchQuery ? (
                          <TouchableOpacity onPress={() => setSkillSearchQuery('')}>
                            <Feather name="x" size={14} color={COLORS.textSecondary} />
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      <ScrollView nestedScrollEnabled={true} keyboardShouldPersistTaps="handled" style={{ maxHeight: 180 }}>
                        {SKILLS_LIST
                          .filter(skill => skill.toLowerCase().includes(skillSearchQuery.toLowerCase()))
                          .map((skill) => {
                            const isSelected = primarySkill === skill;
                            return (
                              <TouchableOpacity
                                key={skill}
                                onPress={() => {
                                  setPrimarySkill(skill);
                                  setShowSkillDropdown(false);
                                  setSkillSearchQuery('');
                                }}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  paddingVertical: 10,
                                  paddingHorizontal: 8,
                                  borderRadius: 8,
                                  backgroundColor: isSelected ? COLORS.primary + '22' : 'transparent',
                                  marginBottom: 2
                                }}
                              >
                                <View style={{ marginRight: 8 }}>
                                  {renderSkillIcon(skill, 16, isSelected ? COLORS.primary : COLORS.textSecondary)}
                                </View>
                                <Text style={{
                                  color: isSelected ? COLORS.primary : COLORS.textPrimary,
                                  fontSize: 13,
                                  fontWeight: isSelected ? '700' : '500',
                                  flex: 1
                                }}>
                                  {skill}
                                </Text>
                                {isSelected && <Feather name="check" size={14} color={COLORS.primary} />}
                              </TouchableOpacity>
                            );
                          })}
                        {SKILLS_LIST.filter(skill => skill.toLowerCase().includes(skillSearchQuery.toLowerCase())).length === 0 && (
                          <View style={{ alignItems: 'center', marginVertical: 8 }}>
                            <Text style={{ color: COLORS.textSecondary, textAlign: 'center', marginBottom: 8, fontSize: 12 }}>
                              No matching skills found.
                            </Text>
                            <TouchableOpacity
                              onPress={() => {
                                setPrimarySkill('Other');
                                setCustomSkill(skillSearchQuery);
                                setShowSkillDropdown(false);
                                setSkillSearchQuery('');
                              }}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: COLORS.primary + '15',
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: COLORS.primary + '33'
                              }}
                            >
                              <Feather name="plus-circle" size={14} color={COLORS.primary} style={{ marginRight: 6 }} />
                              <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '700' }}>
                                Use "{skillSearchQuery}" as custom skill
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  )}

                  {primarySkill === 'Other' && (
                    <View style={{ marginTop: 4 }}>
                      <Text style={[styles.inputLabel, { color: COLORS.textSecondary, marginBottom: 4, fontSize: 12 }]}>
                        Type your profession:
                      </Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Welding Specialist, Solar Installer"
                        placeholderTextColor={COLORS.textSecondary}
                        value={customSkill}
                        onChangeText={setCustomSkill}
                      />
                    </View>
                  )}
                </View>
              )}

              {error && <Text style={[styles.errorTextAuth, { marginBottom: 12 }]}>{error}</Text>}

              <TouchableOpacity style={styles.button} onPress={handleGoogleFinalize} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Complete Registration</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
