import React, { useState, useEffect } from 'react';
import { Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { Feather, AntDesign } from '@expo/vector-icons';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { t, SKILLS_LIST, SKILL_KEYWORDS, generateProviderKeywords } from '../utils/translations';

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

export default function ProviderDashboard({
  user,
  userProfile,
  isEmailVerified,
  setUserProfile,
  setIsProviderMode,
  db,
  isDarkMode,
  COLORS,
  styles,
  getShadow,
  addToast,
  getBackendUrl,
  availableJobs,
  myProviderJobs,
  handleAcceptJob,
  setActiveChatBooking,
  setSelectedRoutingJob,
  setRoutingModalVisible,
  parseBookingTime,
  getTimeRemainingString,
  sendNotification,
  darkMapStyle,
  MapView,
  Marker
}) {
  const lang = userProfile?.language || 'ENGLISH';

  if (userProfile && userProfile.role !== 'provider') {
    return (
      <View style={{ 
        paddingHorizontal: 20, 
        paddingVertical: 40, 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: 400
      }}>
        {/* Glassmorphic Shield Card */}
        <View style={{
          width: '100%',
          backgroundColor: isDarkMode ? '#1A1125' : '#FAF5FF',
          borderRadius: 24,
          padding: 24,
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: COLORS.danger + '44',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.1,
          shadowRadius: 16,
          elevation: 4
        }}>
          {/* Animated/Glowing Shield Icon */}
          <View style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: COLORS.danger + '15',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 20,
            borderWidth: 1,
            borderColor: COLORS.danger + '33'
          }}>
            <Feather name="shield" size={36} color={COLORS.danger} />
          </View>

          {/* Heading */}
          <Text style={{
            fontSize: 20,
            fontWeight: '900',
            color: COLORS.danger,
            letterSpacing: 1.5,
            marginBottom: 10,
            textAlign: 'center'
          }}>ACCESS ERROR</Text>

          {/* Message */}
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: COLORS.textPrimary,
            textAlign: 'center',
            marginBottom: 6
          }}>You're not a provider</Text>

          <Text style={{
            fontSize: 12,
            color: COLORS.textSecondary,
            textAlign: 'center',
            lineHeight: 18,
            marginBottom: 24,
            paddingHorizontal: 10
          }}>
            Your account role is currently configured as a customer. Switch back to the Customer portal to request services or book verified local professionals.
          </Text>

          {/* Premium Glassmorphic Switch Back Button */}
          <TouchableOpacity
            style={{
              width: '100%',
              backgroundColor: COLORS.primary,
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              shadowColor: COLORS.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 3
            }}
            onPress={() => {
              if (setIsProviderMode) {
                setIsProviderMode(false);
                addToast("Switched to Customer Mode", "info");
              }
            }}
          >
            <Feather name="user" size={16} color="#FFFFFF" />
            <Text style={{
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: '800',
              letterSpacing: 0.5
            }}>Switch to Customer Portal</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const hasServices = userProfile?.services && Object.keys(userProfile.services).length > 0;
  const isProfileComplete = !!(
    hasServices &&
    userProfile?.shopName?.trim() &&
    userProfile?.shopAddress?.trim() &&
    userProfile?.phoneNumber?.trim() &&
    userProfile?.visitingCharges && Number(userProfile.visitingCharges) > 0 &&
    userProfile?.city?.trim() &&
    userProfile?.area?.trim()
  );

  const getProfileIncompleteMessage = () => {
    const missing = [];
    const isUrdu = lang === 'URDU';
    
    if (!hasServices) {
      missing.push(isUrdu ? 'ریٹ شیٹ میں کم از کم ایک سروس' : 'at least one Service in Rate Sheet');
    }
    if (!userProfile?.shopName?.trim()) {
      missing.push(isUrdu ? 'دکان کا نام' : 'Shop Name');
    }
    if (!userProfile?.shopAddress?.trim()) {
      missing.push(isUrdu ? 'دکان کا پتہ' : 'Shop Address');
    }
    if (!userProfile?.phoneNumber?.trim()) {
      missing.push(isUrdu ? 'فون نمبر' : 'Phone Number');
    }
    if (!userProfile?.visitingCharges || Number(userProfile.visitingCharges) <= 0) {
      missing.push(isUrdu ? 'فلیٹ وزٹنگ فیس (> 0)' : 'Flat Visiting Fee (> 0)');
    }
    if (!userProfile?.city?.trim()) {
      missing.push(isUrdu ? 'شہر' : 'City');
    }
    if (!userProfile?.area?.trim()) {
      missing.push(isUrdu ? 'علاقہ' : 'Area');
    }

    if (missing.length === 0) return '';

    if (isUrdu) {
      return `آپ کا کاروباری پروفائل نامکمل ہے۔ براہ کرم درج ذیل معلومات مکمل کریں: ${missing.join('، ')}۔ جب تک پروفائل مکمل نہیں ہوگا، آپ کسی سروس تک رسائی حاصل نہیں کر سکتے۔`;
    } else {
      return `Your business profile is incomplete. Please complete the following fields: ${missing.join(', ')}. You won't be able to access any provider services until these details are completed.`;
    }
  };

  // Flat Visiting Fee
  const [visitingCharges, setVisitingCharges] = useState(String(userProfile?.visitingCharges || '0'));
  
  // Profile update fields
  const [updateCityVal, setUpdateCityVal] = useState(userProfile?.city || '');
  const [updateAreaVal, setUpdateAreaVal] = useState(userProfile?.area || '');
  const [updateShopNameVal, setUpdateShopNameVal] = useState(userProfile?.shopName || '');
  const [updateBranchVal, setUpdateBranchVal] = useState(userProfile?.branch || '');
  const [updateVisitingChargesVal, setUpdateVisitingChargesVal] = useState(String(userProfile?.visitingCharges || '0'));
  const [updateShopAddressVal, setUpdateShopAddressVal] = useState(userProfile?.shopAddress || '');
  const [updateLandmarkVal, setUpdateLandmarkVal] = useState(userProfile?.landmark || '');
  const [updatePhoneVal, setUpdatePhoneVal] = useState(String(userProfile?.phoneNumber || ''));
  const [updateShopLinkVal, setUpdateShopLinkVal] = useState(userProfile?.shopLink || '');
  const getInitialSkillState = () => {
    const initialSkill = userProfile?.primarySkill || userProfile?.roleTitle || '';
    if (initialSkill && !SKILLS_LIST.includes(initialSkill)) {
      return { primary: 'Other', custom: initialSkill };
    }
    return { primary: initialSkill, custom: '' };
  };

  const initialSkills = getInitialSkillState();
  const [primarySkill, setPrimarySkill] = useState(initialSkills.primary);
  const [customSkill, setCustomSkill] = useState(initialSkills.custom);
  const [currentPassword, setCurrentPassword] = useState('');
  
  // UI states
  const [showBusinessProfileCard, setShowBusinessProfileCard] = useState(false);
  const [isProviderBroadcastsExpanded, setProviderBroadcastsExpanded] = useState(true);
  const [isProviderAssignedExpanded, setProviderAssignedExpanded] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [skillSearchQuery, setSkillSearchQuery] = useState('');
  
  // Lookup states
  const [lookupMode, setLookupMode] = useState('ai_search');
  const [lookupQuery, setLookupQuery] = useState('');
  const [foundShop, setFoundShop] = useState(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setVisitingCharges(String(userProfile.visitingCharges || '0'));
      setUpdateCityVal(userProfile.city || '');
      setUpdateAreaVal(userProfile.area || '');
      setUpdateShopNameVal(userProfile.shopName || '');
      setUpdateBranchVal(userProfile.branch || '');
      setUpdateVisitingChargesVal(String(userProfile.visitingCharges || '0'));
      setUpdateShopAddressVal(userProfile.shopAddress || '');
      setUpdateLandmarkVal(userProfile.landmark || '');
      setUpdatePhoneVal(String(userProfile.phoneNumber || ''));
      setUpdateShopLinkVal(userProfile.shopLink || '');
      
      const skillVal = userProfile.primarySkill || userProfile.roleTitle || '';
      if (skillVal && !SKILLS_LIST.includes(skillVal)) {
        setPrimarySkill('Other');
        setCustomSkill(skillVal);
      } else {
        setPrimarySkill(skillVal);
        setCustomSkill('');
      }
    }
  }, [userProfile]);

  // Availability states
  const [showAvailabilityCard, setShowAvailabilityCard] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [workingDays, setWorkingDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [startTime, setStartTime] = useState('09:00 AM');
  const [endTime, setEndTime] = useState('06:00 PM');

  // Load availability from userProfile
  useEffect(() => {
    if (userProfile && userProfile.availability) {
      if (userProfile.availability.workingDays) setWorkingDays(userProfile.availability.workingDays);
      if (userProfile.availability.startTime) setStartTime(userProfile.availability.startTime);
      if (userProfile.availability.endTime) setEndTime(userProfile.availability.endTime);
    }
  }, [userProfile]);

  const handleUpdateAvailability = async () => {
    if (isEmailVerified === false) {
      addToast("Access blocked: Please verify your email first.", "error");
      return;
    }
    if (!isProfileComplete) {
      addToast(getProfileIncompleteMessage(), "error");
      return;
    }
    setAvailabilityLoading(true);
    try {
      const docRef = doc(db, 'users', user.uid);
      await updateDoc(docRef, {
        availability: {
          workingDays,
          startTime,
          endTime,
          updatedAt: Date.now()
        }
      });
      setUserProfile(prev => ({ ...prev, availability: { workingDays, startTime, endTime } }));
      addToast("Availability schedule updated!", "success");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const toggleDay = (day) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter(d => d !== day));
    } else {
      setWorkingDays([...workingDays, day]);
    }
  };

  const handleLookupShop = async () => {
    if (!lookupQuery) return;
    setIsLookingUp(true);
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
      addToast(err.message || "Failed to connect to backend", 'error');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleApplyShopDetails = () => {
    if (!foundShop) return;
    setUpdateShopNameVal(foundShop.name || '');
    setUpdateBranchVal(foundShop.branch || '');
    setUpdateCityVal(foundShop.city || '');
    setUpdateAreaVal(foundShop.area || '');
    setUpdateShopAddressVal(foundShop.address || '');
    setUpdateLandmarkVal(foundShop.landmark || '');
    setUpdateShopLinkVal(foundShop.shopLink || '');

    setFoundShop(null);
    setLookupMode('manual');
    addToast("Details applied!", 'success');
  };

  const handleUpdateShopProfile = async () => {
    if (isEmailVerified === false) {
      addToast("Access blocked: Please verify your email first.", "error");
      return;
    }
    if (!hasServices) {
      addToast(lang === 'URDU' ? 'برائے مہربانی پہلے ریٹ شیٹ میں کم از کم ایک سروس شامل کریں۔' : 'Please add at least one service in the Rate Sheet first.', "error");
      return;
    }
    if (!primarySkill) {
      addToast("Please select your primary skill.", "error");
      return;
    }
    if (primarySkill === 'Other' && !customSkill.trim()) {
      addToast("Please type your custom profession.", "error");
      return;
    }
    if (!updatePhoneVal || updatePhoneVal.replace(/[^0-9]/g, '').length !== 11) {
      addToast("Phone number must be exactly 11 numeric digits.", "error");
      return;
    }
    if (Number(updateVisitingChargesVal) > 99999) {
      addToast("Visiting fee cannot exceed 5 figures (max PKR 99,999).", "error");
      return;
    }
    if (Number(updateVisitingChargesVal) < 0) {
      addToast("Visiting fee cannot be negative.", "error");
      return;
    }
    setProfileLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const normalize = (str) => str ? str.toLowerCase().trim().replace(/[\s-]/g, '') : '';
      
      let lat = null;
      let lng = null;
      try {
        const fullAddress = `${updateShopAddressVal ? updateShopAddressVal + ', ' : ''}${updateAreaVal}, ${updateCityVal}`;
        const geocodeRes = await fetch(getBackendUrl('/api/forward-geocode'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: fullAddress })
        });
        const geocodeData = await geocodeRes.json();
        if (geocodeRes.ok && geocodeData.lat && geocodeData.lng) {
          lat = geocodeData.lat;
          lng = geocodeData.lng;
        }
      } catch (err) {
        console.warn("Failed to geocode provider address:", err);
      }

      const updateData = {
        city: updateCityVal,
        area: updateAreaVal,
        city_norm: normalize(updateCityVal),
        area_norm: normalize(updateAreaVal),
        shopName: updateShopNameVal,
        branch: updateBranchVal,
        visitingCharges: Number(updateVisitingChargesVal) || 0,
        shopAddress: updateShopAddressVal,
        landmark: updateLandmarkVal,
        shopLink: updateShopLinkVal,
        phoneNumber: updatePhoneVal.replace(/[^0-9]/g, '').slice(0, 11),
        primarySkill: primarySkill === 'Other' ? customSkill.trim() : primarySkill,
        roleTitle: primarySkill === 'Other' ? customSkill.trim() : primarySkill,
        servicesList: generateProviderKeywords(primarySkill, customSkill, userProfile?.services),
      };

      if (lat && lng) {
        updateData.latitude = lat;
        updateData.longitude = lng;
        updateData.locationCoords = { lat, lng };
      }

      await updateDoc(userRef, updateData);
      setUserProfile(prev => ({ ...prev, ...updateData }));
      addToast("Business Profile Updated!", 'success');
      setCurrentPassword('');
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setProfileLoading(false);
    }
  };

  const assignedJobs = myProviderJobs
    .filter(j => !['COMPLETED', 'CANCELLED', 'CANCELLED_BY_USER', 'REJECTED', 'PENDING', 'NEGOTIATION', 'NEGOTIATING'].includes(j.status?.toUpperCase()))
    .sort((a, b) => {
      const timeA = parseBookingTime(a.time, a.createdAt).getTime();
      const timeB = parseBookingTime(b.time, b.createdAt).getTime();
      return timeA - timeB;
    });

  return (
    <View style={{ paddingHorizontal: 20 }}>
      {/* 1. Amber Service Requirement Banner */}
      {!isProfileComplete && (
        <View style={{
          backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
          borderColor: isDarkMode ? 'rgba(245, 158, 11, 0.25)' : '#FDE68A',
          borderWidth: 1.5,
          padding: 16,
          borderRadius: 16,
          marginBottom: 20,
          flexDirection: lang === 'URDU' ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 12,
          shadowColor: '#F59E0B',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 2
        }}>
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Feather name="alert-triangle" size={20} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ 
              fontSize: 13, 
              color: isDarkMode ? '#FDE68A' : '#92400E', 
              fontWeight: '800', 
              lineHeight: 18,
              textAlign: lang === 'URDU' ? 'right' : 'left'
            }}>
              {getProfileIncompleteMessage()}
            </Text>
          </View>
        </View>
      )}

      {/* Quick Visiting Charges Quick-Update Panel */}
      <View style={[styles.card, { borderColor: COLORS.primary + '66', borderWidth: 1.5, padding: 16, marginBottom: 24, borderRadius: 16, backgroundColor: isDarkMode ? '#15101E' : '#F9F6FE' }]}>
        <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 160 }}>
            <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="dollar-sign" size={16} color={COLORS.primary} />
              <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, textAlign: lang === 'URDU' ? 'right' : 'left' }}>
                {t('myFlatVisitingFee', lang)}
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2, textAlign: lang === 'URDU' ? 'right' : 'left' }}>
              {lang === 'URDU' ? 'سروس نہ ملنے یا مخصوص نہ ہونے کی صورت میں بھی چارج کیا جائے گا۔' : 'Charged even if no service is found/specified.'}
            </Text>
          </View>
          <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <TextInput 
              style={[styles.input, { width: 90, marginBottom: 0, textAlign: 'center', paddingHorizontal: 8, paddingVertical: 0, height: 38, borderColor: COLORS.border, borderWidth: 1, borderRadius: 8 }]}
              keyboardType="numeric"
              placeholder={t('placeholderCharges', lang)}
              placeholderTextColor={COLORS.textSecondary + '88'}
              value={visitingCharges}
              onChangeText={setVisitingCharges}
            />
            <TouchableOpacity 
              style={{ backgroundColor: COLORS.primary, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, height: 38, justifyContent: 'center', alignItems: 'center', opacity: (isEmailVerified === false || !isProfileComplete) ? 0.6 : 1 }}
              onPress={async () => {
                if (isEmailVerified === false) {
                  addToast("Access blocked: Please verify your email first.", "error");
                  return;
                }
                if (!isProfileComplete) {
                  addToast(getProfileIncompleteMessage(), "error");
                  return;
                }
                if (!visitingCharges || isNaN(Number(visitingCharges))) {
                  addToast("Please enter a valid number", "error");
                  return;
                }
                if (Number(visitingCharges) > 99999) {
                  addToast("Visiting fee cannot exceed 5 figures (max PKR 99,999)", "error");
                  return;
                }
                if (Number(visitingCharges) < 0) {
                  addToast("Visiting fee cannot be negative", "error");
                  return;
                }
                try {
                  const userRef = doc(db, 'users', user.uid);
                  await updateDoc(userRef, { visitingCharges: Number(visitingCharges) });
                  setUserProfile(prev => ({ ...prev, visitingCharges: Number(visitingCharges) }));
                  addToast("Visiting fee updated successfully!", "success");
                } catch (err) {
                  addToast(err.message, "error");
                }
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>
                {lang === 'URDU' ? 'محفوظ کریں' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Collapsible Business Profile Card */}
      <View style={[styles.card, { borderColor: COLORS.primary + '33', borderWidth: 1, padding: 16, marginBottom: 24, borderRadius: 16, backgroundColor: isDarkMode ? '#110C1A' : '#FAFAFA' }]}>
        <TouchableOpacity 
          style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' }}
          onPress={() => setShowBusinessProfileCard(!showBusinessProfileCard)}
        >
          <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary + '15', justifyContent: 'center', alignItems: 'center' }}>
              <Feather name="briefcase" size={18} color={COLORS.primary} />
            </View>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, textAlign: lang === 'URDU' ? 'right' : 'left' }}>
                {t('configureBusinessProfile', lang)}
              </Text>
              <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2, textAlign: lang === 'URDU' ? 'right' : 'left' }}>
                {t('editShopDetails', lang)}
              </Text>
            </View>
          </View>
          <Feather name={showBusinessProfileCard ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {showBusinessProfileCard ? (
          <View style={{ marginTop: 20 }}>
            {isEmailVerified === false ? (
              <View style={{
                backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
                borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.25)' : '#FEE2E2',
                borderWidth: 1,
                padding: 12,
                borderRadius: 10,
                marginBottom: 16,
                flexDirection: lang === 'URDU' ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 8
              }}>
                <Feather name="alert-triangle" size={16} color={COLORS.danger} />
                <Text style={{ fontSize: 12, color: isDarkMode ? '#FCA5A5' : '#991B1B', fontWeight: '800', flex: 1, textAlign: lang === 'URDU' ? 'right' : 'left' }}>
                  {lang === 'URDU' ? 'کاروباری معلومات کو ترتیب دینے کے لیے اوپر والے بینر سے اپنے ای میل ایڈریس کی تصدیق کریں۔' : 'Verify your email address using the notification banner at the top to configure business profile settings.'}
                </Text>
              </View>
            ) : null}
            {!!userProfile?.providerID ? (
              <View style={{ marginBottom: 16, backgroundColor: COLORS.primary + '10', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary + '22', flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textPrimary }}>
                  {t('providerIdLabel', lang)}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.primary }}>
                  {userProfile.providerID} <Text style={{ fontSize: 10, fontWeight: '400', color: COLORS.textSecondary }}>({t('readOnlyLabel', lang)})</Text>
                </Text>
              </View>
            ) : null}
            <View style={{ marginBottom: 20, backgroundColor: isDarkMode ? 'rgba(168, 85, 247, 0.05)' : 'rgba(168, 85, 247, 0.03)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.primary + '33' }}>
              <Text style={[styles.inputLabel, { color: COLORS.primary, marginBottom: 12, textAlign: lang === 'URDU' ? 'right' : 'left' }]}>
                {t('useAiFindShop', lang)}
              </Text>
              <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', gap: 8, marginBottom: 16 }}>
                <TouchableOpacity 
                  style={[{ flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' }, lookupMode === 'ai_search' && { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' }]} 
                  onPress={() => setLookupMode('ai_search')}
                >
                  <Feather name="search" size={14} color={lookupMode === 'ai_search' ? COLORS.primary : COLORS.textSecondary} />
                  <Text style={{ fontSize: 10, color: lookupMode === 'ai_search' ? COLORS.primary : COLORS.textSecondary, marginTop: 4, fontWeight: '700' }}>
                    {t('aiSearch', lang)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[{ flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' }, lookupMode === 'ai_link' && { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' }]} 
                  onPress={() => setLookupMode('ai_link')}
                >
                  <Feather name="link" size={14} color={lookupMode === 'ai_link' ? COLORS.primary : COLORS.textSecondary} />
                  <Text style={{ fontSize: 10, color: lookupMode === 'ai_link' ? COLORS.primary : COLORS.textSecondary, marginTop: 4, fontWeight: '700' }}>
                    {t('aiLink', lang)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[{ flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' }, lookupMode === 'manual' ? { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' } : null]} 
                  onPress={() => { setLookupMode('manual'); setFoundShop(null); }}
                >
                  <Feather name="edit-3" size={14} color={lookupMode === 'manual' ? COLORS.primary : COLORS.textSecondary} />
                  <Text style={{ fontSize: 10, color: lookupMode === 'manual' ? COLORS.primary : COLORS.textSecondary, marginTop: 4, fontWeight: '700' }}>
                    {t('manual', lang)}
                  </Text>
                </TouchableOpacity>
              </View>

              {lookupMode !== 'manual' ? (
                <View>
                  <View style={{ position: 'relative' }}>
                    <TextInput 
                      style={[styles.input, { marginBottom: 0, textAlign: lang === 'URDU' ? 'right' : 'left' }]} 
                      placeholder={lookupMode === 'ai_search' ? t('enterShopNameCity', lang) : t('pasteGoogleMapsLink', lang)} 
                      placeholderTextColor={COLORS.textSecondary + '88'}
                      value={lookupQuery ? String(lookupQuery) : ''}
                      onChangeText={setLookupQuery}
                    />
                    <TouchableOpacity 
                      style={{ position: 'absolute', right: lang === 'URDU' ? undefined : 8, left: lang === 'URDU' ? 8 : undefined, top: 8, bottom: 8, backgroundColor: COLORS.primary, paddingHorizontal: 16, borderRadius: 8, justifyContent: 'center' }}
                      onPress={handleLookupShop}
                      disabled={isLookingUp}
                    >
                      {isLookingUp ? <ActivityIndicator color="#fff" size="small" /> : <Feather name={lang === 'URDU' ? "arrow-left" : "arrow-right"} size={18} color="#fff" />}
                    </TouchableOpacity>
                  </View>
                  
                  {foundShop ? (
                    <View style={{ marginTop: 16, backgroundColor: COLORS.card, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.success + '44' }}>
                      <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success, marginRight: lang === 'URDU' ? 0 : 8, marginLeft: lang === 'URDU' ? 8 : 0 }} />
                        <Text style={{ color: COLORS.textPrimary, fontWeight: '800', fontSize: 14, textAlign: lang === 'URDU' ? 'right' : 'left' }}>
                          {t('isThisYourShop', lang)}
                        </Text>
                      </View>
                      <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 13, textAlign: lang === 'URDU' ? 'right' : 'left' }}>{foundShop.name}</Text>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2, textAlign: lang === 'URDU' ? 'right' : 'left' }}>{foundShop.address}</Text>
                      <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '700', marginTop: 4, textAlign: lang === 'URDU' ? 'right' : 'left' }}>{foundShop.area}, {foundShop.city}</Text>
                      
                      <TouchableOpacity 
                        style={{ backgroundColor: COLORS.success, padding: 10, borderRadius: 8, marginTop: 12, alignItems: 'center' }}
                        onPress={handleApplyShopDetails}
                      >
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>
                          {t('yesUseDetails', lang)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { textAlign: lang === 'URDU' ? 'right' : 'left' }]}>{t('cityLabel', lang)}</Text>
                <TextInput style={[styles.input, { textAlign: lang === 'URDU' ? 'right' : 'left' }]} value={updateCityVal ? String(updateCityVal) : ''} onChangeText={setUpdateCityVal} placeholder={t('placeholderCity', lang)} placeholderTextColor={COLORS.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { textAlign: lang === 'URDU' ? 'right' : 'left' }]}>{t('areaLabel', lang)}</Text>
                <TextInput style={[styles.input, { textAlign: lang === 'URDU' ? 'right' : 'left' }]} value={updateAreaVal ? String(updateAreaVal) : ''} onChangeText={setUpdateAreaVal} placeholder={t('placeholderArea', lang)} placeholderTextColor={COLORS.textSecondary} />
              </View>
            </View>
            <Text style={[styles.inputLabel, { textAlign: lang === 'URDU' ? 'right' : 'left' }]}>{t('shopNameLabel', lang)}</Text>
            <TextInput style={[styles.input, { textAlign: lang === 'URDU' ? 'right' : 'left' }]} value={updateShopNameVal ? String(updateShopNameVal) : ''} onChangeText={setUpdateShopNameVal} placeholder={t('placeholderBusinessName', lang)} placeholderTextColor={COLORS.textSecondary} />

            <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { textAlign: lang === 'URDU' ? 'right' : 'left' }]}>{t('branchLabel', lang)}</Text>
                <TextInput style={[styles.input, { textAlign: lang === 'URDU' ? 'right' : 'left' }]} value={updateBranchVal ? String(updateBranchVal) : ''} onChangeText={setUpdateBranchVal} placeholder={t('placeholderBranchName', lang)} placeholderTextColor={COLORS.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { textAlign: lang === 'URDU' ? 'right' : 'left' }]}>{t('visitingChargesLabel', lang)}</Text>
                <TextInput style={[styles.input, { textAlign: lang === 'URDU' ? 'right' : 'left' }]} value={updateVisitingChargesVal !== undefined && updateVisitingChargesVal !== null ? String(updateVisitingChargesVal) : ''} onChangeText={setUpdateVisitingChargesVal} placeholder={t('placeholderCharges', lang)} placeholderTextColor={COLORS.textSecondary} keyboardType="numeric" />
              </View>
            </View>

            <Text style={[styles.inputLabel, { textAlign: lang === 'URDU' ? 'right' : 'left' }]}>{t('shopAddressLabel', lang)}</Text>
            <TextInput style={[styles.input, { textAlign: lang === 'URDU' ? 'right' : 'left' }]} value={updateShopAddressVal ? String(updateShopAddressVal) : ''} onChangeText={setUpdateShopAddressVal} placeholder={t('placeholderAddress', lang)} placeholderTextColor={COLORS.textSecondary} />

            <Text style={[styles.inputLabel, { textAlign: lang === 'URDU' ? 'right' : 'left' }]}>{t('landmarkLabel', lang)}</Text>
            <TextInput style={[styles.input, { textAlign: lang === 'URDU' ? 'right' : 'left' }]} value={updateLandmarkVal ? String(updateLandmarkVal) : ''} onChangeText={setUpdateLandmarkVal} placeholder={t('placeholderLandmark', lang)} placeholderTextColor={COLORS.textSecondary} />

            <Text style={[styles.inputLabel, { textAlign: lang === 'URDU' ? 'right' : 'left' }]}>{t('phoneLabel', lang)}</Text>
            <TextInput 
              style={[styles.input, { textAlign: lang === 'URDU' ? 'right' : 'left' }]} 
              value={updatePhoneVal ? String(updatePhoneVal) : ''} 
              onChangeText={(val) => setUpdatePhoneVal(val.replace(/[^0-9]/g, '').slice(0, 11))} 
              placeholder={t('placeholderPhone', lang)} 
              placeholderTextColor={COLORS.textSecondary} 
              keyboardType="phone-pad" 
              maxLength={11}
            />

            <Text style={[styles.inputLabel, { textAlign: lang === 'URDU' ? 'right' : 'left' }]}>{t('mapsLinkLabel', lang)}</Text>
            <TextInput style={[styles.input, { textAlign: lang === 'URDU' ? 'right' : 'left' }]} value={updateShopLinkVal ? String(updateShopLinkVal) : ''} onChangeText={setUpdateShopLinkVal} placeholder={t('placeholderShopLink', lang)} placeholderTextColor={COLORS.textSecondary} autoCapitalize="none" />

            {/* Mandatory Primary Skill Selector Dropdown */}
            <View style={{ marginBottom: 16, marginTop: 8 }}>
              <Text style={[styles.inputLabel, { textAlign: lang === 'URDU' ? 'right' : 'left', color: COLORS.primary }]}>
                {t('selectPrimarySkill', lang)} *
              </Text>

              {/* Collapsible Dropdown Header (Select Box) */}
              <TouchableOpacity
                onPress={() => {
                  setShowSkillDropdown(!showSkillDropdown);
                  setSkillSearchQuery(''); // reset search on toggle
                }}
                style={{
                  flexDirection: lang === 'URDU' ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: showSkillDropdown ? COLORS.primary : (isDarkMode ? 'rgba(255,255,255,0.1)' : COLORS.border),
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#F9F7FD',
                  marginTop: 6
                }}
              >
                <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
                  {primarySkill ? (
                    <>
                      {renderSkillIcon(primarySkill, 18, COLORS.primary)}
                      <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textPrimary }}>
                        {t(primarySkill, lang)}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Feather name="briefcase" size={18} color={COLORS.textSecondary} />
                      <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' }}>
                        {lang === 'URDU' ? 'مہارت منتخب کریں...' : 'Select your primary skill...'}
                      </Text>
                    </>
                  )}
                </View>
                <Feather name={showSkillDropdown ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>

              {/* Dropdown Expanded Menu */}
              {showSkillDropdown && (
                <View style={{
                  backgroundColor: isDarkMode ? '#171221' : '#FDFCFF',
                  borderColor: COLORS.primary + '33',
                  borderWidth: 1.5,
                  borderRadius: 12,
                  padding: 12,
                  marginTop: 6,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 6,
                  elevation: 3
                }}>
                  {/* Real-time Search Input */}
                  <View style={{
                    flexDirection: lang === 'URDU' ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : COLORS.border,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    marginBottom: 10,
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#F5F5F7'
                  }}>
                    <Feather name="search" size={14} color={COLORS.textSecondary} style={lang === 'URDU' ? { marginLeft: 8 } : { marginRight: 8 }} />
                    <TextInput
                      style={{
                        flex: 1,
                        fontSize: 12,
                        color: COLORS.textPrimary,
                        padding: 0,
                        height: 30,
                        textAlign: lang === 'URDU' ? 'right' : 'left'
                      }}
                      placeholder={lang === 'URDU' ? 'مہارت تلاش کریں...' : 'Search your skill...'}
                      placeholderTextColor={COLORS.textSecondary + 'aa'}
                      value={skillSearchQuery}
                      onChangeText={setSkillSearchQuery}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {!!skillSearchQuery && (
                      <TouchableOpacity onPress={() => setSkillSearchQuery('')}>
                        <Feather name="x" size={14} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Scrollable Filtered Skills List */}
                  <ScrollView
                    nestedScrollEnabled={true}
                    keyboardShouldPersistTaps="handled"
                    style={{ maxHeight: 200 }}
                  >
                    {SKILLS_LIST.filter(skill => {
                      const rawMatch = skill.toLowerCase().includes(skillSearchQuery.toLowerCase());
                      const translatedMatch = t(skill, lang).toLowerCase().includes(skillSearchQuery.toLowerCase());
                      return rawMatch || translatedMatch;
                    }).map((skill) => {
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
                            flexDirection: lang === 'URDU' ? 'row-reverse' : 'row',
                            alignItems: 'center',
                            paddingVertical: 10,
                            paddingHorizontal: 10,
                            borderRadius: 8,
                            backgroundColor: isSelected ? COLORS.primary + '15' : 'transparent',
                            marginVertical: 1
                          }}
                        >
                          <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                            {renderSkillIcon(skill, 16, isSelected ? COLORS.primary : COLORS.textSecondary)}
                            <Text style={{
                              fontSize: 12,
                              fontWeight: isSelected ? '800' : '600',
                              color: isSelected ? COLORS.primary : COLORS.textPrimary,
                              textAlign: lang === 'URDU' ? 'right' : 'left'
                            }}>
                              {t(skill, lang)}
                            </Text>
                          </View>
                          {isSelected && (
                            <Feather name="check" size={14} color={COLORS.primary} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                    {SKILLS_LIST.filter(skill => {
                      const rawMatch = skill.toLowerCase().includes(skillSearchQuery.toLowerCase());
                      const translatedMatch = t(skill, lang).toLowerCase().includes(skillSearchQuery.toLowerCase());
                      return rawMatch || translatedMatch;
                    }).length === 0 && (
                      <View style={{ alignItems: 'center', marginVertical: 8 }}>
                        <Text style={{ color: COLORS.textSecondary, textAlign: 'center', marginBottom: 8, fontSize: 12 }}>
                          {lang === 'URDU' ? 'کوئی مماثل مہارت نہیں ملی۔' : 'No matching skills found.'}
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            setPrimarySkill('Other');
                            setCustomSkill(skillSearchQuery);
                            setShowSkillDropdown(false);
                            setSkillSearchQuery('');
                          }}
                          style={{
                            flexDirection: lang === 'URDU' ? 'row-reverse' : 'row',
                            alignItems: 'center',
                            backgroundColor: COLORS.primary + '15',
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: COLORS.primary + '33'
                          }}
                        >
                          <Feather name="plus-circle" size={14} color={COLORS.primary} style={lang === 'URDU' ? { marginLeft: 6 } : { marginRight: 6 }} />
                          <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '700' }}>
                            {lang === 'URDU' 
                              ? `"${skillSearchQuery}" کو اپنی مہارت کے طور پر استعمال کریں` 
                              : `Use "${skillSearchQuery}" as custom skill`}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </ScrollView>
                </View>
              )}

              {/* Custom Skill Input Field (when "Other" is selected) */}
              {primarySkill === 'Other' && (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.inputLabel, { textAlign: lang === 'URDU' ? 'right' : 'left', color: COLORS.primary }]}>
                    {lang === 'URDU' ? "اپنی مہارت درج کریں" : "Type Your Profession"} *
                  </Text>
                  <TextInput 
                    style={[styles.input, { textAlign: lang === 'URDU' ? 'right' : 'left', marginTop: 6 }]} 
                    value={customSkill ? String(customSkill) : ''} 
                    onChangeText={setCustomSkill} 
                    placeholder={lang === 'URDU' ? "مثال کے طور پر: مالی، مکینک" : "e.g. Gardener, Mechanic"} 
                    placeholderTextColor={COLORS.textSecondary} 
                  />
                </View>
              )}
            </View>

            <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 24, opacity: 0.5 }} />
            
            <Text style={[styles.inputLabel, { textAlign: lang === 'URDU' ? 'right' : 'left' }]}>{t('currentPasswordLabel', lang)}</Text>
            <View style={[styles.inputWrapper, { flexDirection: lang === 'URDU' ? 'row-reverse' : 'row' }]}>
              <Feather name="lock" size={16} color={COLORS.textSecondary} style={[styles.inputIcon, lang === 'URDU' ? { marginRight: 0, marginLeft: 10 } : { marginRight: 10, marginLeft: 0 }]} />
              <TextInput 
                style={[styles.compactInput, { textAlign: lang === 'URDU' ? 'right' : 'left' }]} 
                value={currentPassword ? String(currentPassword) : ''} 
                onChangeText={setCurrentPassword} 
                placeholder={t('enterPasswordPlaceholder', lang)} 
                placeholderTextColor={COLORS.textSecondary + '66'}
                secureTextEntry
              />
            </View>

            <TouchableOpacity 
              style={[styles.button, { marginTop: 20 }]} 
              onPress={handleUpdateShopProfile}
              disabled={profileLoading}
            >
              {profileLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('updateBusinessBtn', lang)}</Text>}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* Availability Card */}
      <View style={[styles.card, { borderColor: COLORS.primary + '33', borderWidth: 1, padding: 16, marginBottom: 24, borderRadius: 16, backgroundColor: isDarkMode ? '#110C1A' : '#FAFAFA' }]}>
        <TouchableOpacity 
          style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' }}
          onPress={() => setShowAvailabilityCard(!showAvailabilityCard)}
        >
          <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary + '15', justifyContent: 'center', alignItems: 'center' }}>
              <Feather name="calendar" size={18} color={COLORS.primary} />
            </View>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, textAlign: lang === 'URDU' ? 'right' : 'left' }}>
                {t('configureWorkingHours', lang)}
              </Text>
              <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2, textAlign: lang === 'URDU' ? 'right' : 'left' }}>
                {t('setWorkingDays', lang)}
              </Text>
            </View>
          </View>
          <Feather name={showAvailabilityCard ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {showAvailabilityCard && (
          <View style={{ marginTop: 20 }}>
            <Text style={[styles.inputLabel, { color: COLORS.primary, marginBottom: 12, textAlign: lang === 'URDU' ? 'right' : 'left' }]}>
              {lang === 'URDU' ? 'کام کے دن' : 'Working Days'}
            </Text>
            <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                const isActive = workingDays.includes(day);
                const translatedDay = lang === 'URDU' ? { Mon: 'پیر', Tue: 'منگل', Wed: 'بدھ', Thu: 'جمعرات', Fri: 'جمعہ', Sat: 'ہفتہ', Sun: 'اتوار' }[day] : day;
                return (
                  <TouchableOpacity
                    key={day}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isActive ? COLORS.primary : COLORS.border,
                      backgroundColor: isActive ? COLORS.primary : (isDarkMode ? '#1E1E1E' : '#FFFFFF'),
                    }}
                    onPress={() => toggleDay(day)}
                  >
                    <Text style={{ color: isActive ? '#FFFFFF' : COLORS.textSecondary, fontWeight: '700', fontSize: 12 }}>{translatedDay}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { textAlign: lang === 'URDU' ? 'right' : 'left' }]}>
                  {lang === 'URDU' ? 'شروع کرنے کا وقت' : 'Start Time'}
                </Text>
                <TextInput style={[styles.input, { textAlign: lang === 'URDU' ? 'right' : 'left' }]} value={startTime} onChangeText={setStartTime} placeholder={lang === 'URDU' ? 'مثال کے طور پر، 09:00 صبح' : 'e.g. 09:00 AM'} placeholderTextColor={COLORS.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { textAlign: lang === 'URDU' ? 'right' : 'left' }]}>
                  {lang === 'URDU' ? 'ختم ہونے کا وقت' : 'End Time'}
                </Text>
                <TextInput style={[styles.input, { textAlign: lang === 'URDU' ? 'right' : 'left' }]} value={endTime} onChangeText={setEndTime} placeholder={lang === 'URDU' ? 'مثال کے طور پر، 06:00 شام' : 'e.g. 06:00 PM'} placeholderTextColor={COLORS.textSecondary} />
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.button, { marginTop: 10 }]} 
              onPress={handleUpdateAvailability}
              disabled={availabilityLoading}
            >
              {availabilityLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{lang === 'URDU' ? 'دستیابی محفوظ کریں' : 'Save Availability'}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity 
        style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 4 }}
        onPress={() => setProviderBroadcastsExpanded(!isProviderBroadcastsExpanded)}
      >
        <Text style={[styles.sectionTitle, { marginBottom: 0, textAlign: lang === 'URDU' ? 'right' : 'left' }]}>
          {t('availableBroadcasts', lang)} ({availableJobs.length})
        </Text>
        <Feather 
          name={isProviderBroadcastsExpanded ? "chevron-up" : "chevron-down"} 
          size={18} 
          color={COLORS.textPrimary} 
        />
      </TouchableOpacity>
      
      {isProviderBroadcastsExpanded && (
        <>
          <Text style={{ color: COLORS.textSecondary, marginBottom: 16, fontSize: 13, fontWeight: '600', textAlign: lang === 'URDU' ? 'right' : 'left' }}>
            {lang === 'URDU' ? `آپ کے قریبی علاقے ${userProfile?.area || 'علاقے'}، ${userProfile?.city || 'شہر'} میں دستیاب کام۔` : `Jobs available near you in ${userProfile?.area || 'your area'}, ${userProfile?.city || 'your city'}.`}
          </Text>

          <View style={{ gap: 16, marginBottom: 20 }}>
            {availableJobs.length > 0 ? availableJobs.map((item) => (
              <View key={item.id} style={styles.broadcastCard}>
                <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View>
                    <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={[styles.broadcastType, { color: COLORS.textPrimary, textAlign: lang === 'URDU' ? 'right' : 'left' }]}>{t(item.service, lang)}</Text>
                      {['NEGOTIATING', 'NEGOTIATION'].includes(item.status?.toUpperCase()) && (
                        <View style={{ backgroundColor: COLORS.warning + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ fontSize: 9, color: COLORS.warning, fontWeight: '800' }}>NEGOTIATING</Text>
                        </View>
                      )}
                      {['CONFIRMED', 'BOOKED'].includes(item.status?.toUpperCase()) && (
                        <View style={{ backgroundColor: COLORS.success + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ fontSize: 9, color: COLORS.success, fontWeight: '800' }}>{item.status?.toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.broadcastTime, { color: COLORS.textSecondary, textAlign: lang === 'URDU' ? 'right' : 'left' }]}>{item.time}</Text>
                  </View>
                  <View style={[styles.priceTag, { backgroundColor: COLORS.primary + '20' }]}>
                    <Text style={[styles.priceText, { color: COLORS.primary }]}>
                      {lang === 'URDU' ? `${item.price ? item.price.toLocaleString() : '1,500'} روپے` : `PKR ${item.price ? item.price.toLocaleString() : '1,500'}`}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.broadcastLocation, { color: COLORS.textSecondary, textAlign: lang === 'URDU' ? 'right' : 'left' }]} numberOfLines={1}>
                  <Feather name="map-pin" size={12} color={COLORS.primary} /> {item.location}
                </Text>
                
                {!!item.notes && item.notes !== item.service && (
                  <View style={{ 
                    backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.1)' : '#FFFBEB', 
                    padding: 10, 
                    borderRadius: 8, 
                    marginTop: 8, 
                    borderWidth: 1, 
                    borderColor: isDarkMode ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
                    flexDirection: lang === 'URDU' ? 'row-reverse' : 'row'
                  }}>
                    <Text style={{ color: isDarkMode ? '#FBBF24' : '#B45309', fontSize: 11, fontWeight: '700', textAlign: lang === 'URDU' ? 'right' : 'left' }}>
                      <Feather name="info" size={10} /> {lang === 'URDU' ? 'صارف کا نوٹ: ' : 'User Note: '} <Text style={{ fontWeight: '500' }}>{item.notes}</Text>
                    </Text>
                  </View>
                )}
                
                <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', gap: 10, marginTop: 8 }}>
                  <TouchableOpacity 
                    style={[styles.acceptButton, { flex: 1, height: 36, paddingVertical: 0, justifyContent: 'center', backgroundColor: COLORS.primary, opacity: (isEmailVerified === false || !isProfileComplete) ? 0.6 : 1 }]} 
                    onPress={() => {
                      if (isEmailVerified === false) {
                        addToast("Access blocked: Please verify your email first.", "error");
                        return;
                      }
                      if (!isProfileComplete) {
                        addToast(getProfileIncompleteMessage(), "error");
                        return;
                      }
                      handleAcceptJob(item.id);
                    }}
                  >
                    <Text style={[styles.acceptButtonText, { fontSize: 12 }]}>
                      {lang === 'URDU' ? 'کام قبول کریں' : 'Accept Job'}
                    </Text>
                  </TouchableOpacity>
                  {['NEGOTIATING', 'NEGOTIATION'].includes(item.status?.toUpperCase()) && (
                    <TouchableOpacity 
                      style={[styles.acceptButton, { flex: 1, height: 36, paddingVertical: 0, justifyContent: 'center', backgroundColor: COLORS.warning, opacity: !isProfileComplete ? 0.6 : 1 }]} 
                      onPress={() => {
                        if (!isProfileComplete) {
                          addToast(getProfileIncompleteMessage(), "error");
                          return;
                        }
                        setActiveChatBooking(item);
                      }}
                    >
                      <Text style={[styles.acceptButtonText, { fontSize: 12 }]}>
                        {lang === 'URDU' ? 'بات چیت کریں' : 'Chat & Negotiate'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                
                <TouchableOpacity 
                  style={[styles.secondaryButton, { marginTop: 8, borderColor: COLORS.primary, height: 36, paddingVertical: 0, justifyContent: 'center', alignItems: 'center' }]} 
                  onPress={() => {
                    setSelectedRoutingJob(item);
                    setRoutingModalVisible(true);
                  }}
                >
                  <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="map" size={12} color={COLORS.primary} style={[lang === 'URDU' ? { marginLeft: 6 } : { marginRight: 6 }]} />
                    <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 12 }}>
                      {lang === 'URDU' ? 'جاب روٹ دیکھیں' : 'View Job Route'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )) : (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Feather name="info" size={32} color={COLORS.textSecondary} />
                <Text style={{ color: COLORS.textSecondary, marginTop: 12, textAlign: 'center' }}>
                  {t('noBroadcasts', lang)}
                </Text>
              </View>
            )}
          </View>
        </>
      )}

      <View style={{ marginTop: 24, marginBottom: 20 }}>
        <TouchableOpacity 
          style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}
          onPress={() => setProviderAssignedExpanded(!isProviderAssignedExpanded)}
        >
          <Text style={[styles.sectionTitle, { marginBottom: 0, color: COLORS.textPrimary, textAlign: lang === 'URDU' ? 'right' : 'left' }]}>
            {t('myAssignedJobs', lang)} ({assignedJobs.length})
          </Text>
          <Feather 
            name={isProviderAssignedExpanded ? "chevron-up" : "chevron-down"} 
            size={18} 
            color={COLORS.textPrimary} 
          />
        </TouchableOpacity>

        {isProviderAssignedExpanded && (
          <View style={{ gap: 12 }}>
            {assignedJobs.length > 0 ? assignedJobs.map((job, idx) => {
              const bTime = parseBookingTime(job.time, job.createdAt);
              const timeRemainingStr = getTimeRemainingString(bTime);
              const isOverdue = bTime.getTime() - Date.now() < 0;
              const isDispatchLocked = (bTime.getTime() - Date.now()) > 3600000;
              
              return (
                <View key={job.id || idx} style={{ backgroundColor: isDarkMode ? '#111' : '#F8FAFC', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border }}>
                  <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: COLORS.textPrimary, fontWeight: '700', textAlign: lang === 'URDU' ? 'right' : 'left' }}>{t(job.service, lang)} - {job.customerName || (lang === 'URDU' ? 'صارف' : 'Customer')}</Text>
                    <View style={{ 
                      backgroundColor: ['CONFIRMED', 'BOOKED'].includes(job.status?.toUpperCase()) ? COLORS.success + '20' : 
                                       (job.status?.toUpperCase() === 'DISPATCHED' ? COLORS.primary + '20' : COLORS.warning + '20'), 
                      padding: 4, 
                      borderRadius: 4 
                    }}>
                      <Text style={{ 
                        fontSize: 10, 
                        color: ['CONFIRMED', 'BOOKED'].includes(job.status?.toUpperCase()) ? COLORS.success : 
                               (job.status?.toUpperCase() === 'DISPATCHED' ? COLORS.primary : COLORS.warning), 
                        fontWeight: '800' 
                      }}>{job.status}</Text>
                    </View>
                  </View>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 4, textAlign: lang === 'URDU' ? 'right' : 'left' }}>
                    {lang === 'URDU' ? `وقت: ${job.time}` : `Time: ${job.time}`}
                  </Text>
                  
                  <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', alignItems: 'center', backgroundColor: isOverdue ? COLORS.danger + '15' : COLORS.primary + '10', alignSelf: lang === 'URDU' ? 'flex-end' : 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginTop: 6, marginBottom: 6, borderWidth: 1, borderColor: isOverdue ? COLORS.danger + '30' : COLORS.primary + '20' }}>
                    <Feather name="clock" size={12} color={isOverdue ? COLORS.danger : COLORS.primary} style={[lang === 'URDU' ? { marginLeft: 6 } : { marginRight: 6 }]} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isOverdue ? COLORS.danger : COLORS.primary }}>
                      {timeRemainingStr}
                    </Text>
                  </View>
                  
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12, textAlign: lang === 'URDU' ? 'right' : 'left' }}>
                    {job.serviceMode === 'SHOP' 
                      ? (lang === 'URDU' ? `مقام: صارف آپ کی دکان پر آئے گا` : `Location: Customer will visit your shop`) 
                      : (lang === 'URDU' ? `مقام: ${job.location}` : `Location: ${job.location}`)}
                  </Text>
                  
                  {!!job.notes && job.notes !== job.service && (
                    <View style={{ 
                      backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.1)' : '#FFFBEB', 
                      padding: 10, 
                      borderRadius: 8, 
                      marginTop: 8, 
                      borderWidth: 1, 
                      borderColor: isDarkMode ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
                      flexDirection: lang === 'URDU' ? 'row-reverse' : 'row'
                    }}>
                      <Text style={{ color: isDarkMode ? '#FBBF24' : '#B45309', fontSize: 11, fontWeight: '700', textAlign: lang === 'URDU' ? 'right' : 'left' }}>
                        <Feather name="info" size={10} /> {lang === 'URDU' ? 'صارف کا نوٹ: ' : 'User Note: '} <Text style={{ fontWeight: '500' }}>{job.notes}</Text>
                      </Text>
                    </View>
                  )}
                
                <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                  {['NEGOTIATING', 'NEGOTIATION'].includes(job.status?.toUpperCase()) && (
                    <>
                      <TouchableOpacity 
                        style={[styles.button, { flex: 1, minWidth: 100, height: 36, padding: 0, justifyContent: 'center', backgroundColor: COLORS.success, opacity: (isEmailVerified === false || !isProfileComplete) ? 0.6 : 1 }]}
                        onPress={async () => {
                          if (isEmailVerified === false) {
                            addToast("Access blocked: Please verify your email first.", "error");
                            return;
                          }
                          if (!isProfileComplete) {
                            addToast(getProfileIncompleteMessage(), "error");
                            return;
                          }
                          await updateDoc(doc(db, 'bookings', job.id), { 
                            status: 'CONFIRMED', 
                            providerId: user.uid,
                            providerName: userProfile?.shopName || userProfile?.name || user.displayName || 'Professional Provider',
                            providerPhone: userProfile?.phoneNumber || 'N/A',
                            providerID: userProfile?.providerID || `PRO-${user.uid.substring(0, 4).toUpperCase()}`,
                            providerAddress: userProfile?.shopAddress || userProfile?.address || 'N/A'
                          });
                          sendNotification(job.userId, "Job Confirmed", "Your booking status has been updated to CONFIRMED!", job.id);
                          addToast("Job Accepted & Confirmed!", 'success');
                        }}
                      >
                        <Text style={[styles.buttonText, { fontSize: 12 }]}>
                          {lang === 'URDU' ? 'کام قبول کریں' : 'Accept Job'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.secondaryButton, { flex: 1, minWidth: 100, height: 36, padding: 0, justifyContent: 'center', borderColor: COLORS.danger }]}
                        onPress={async () => {
                          await updateDoc(doc(db, 'bookings', job.id), { status: 'REJECTED' });
                          sendNotification(job.userId, "Job Cancelled / Declined", "Your booking status has been updated to REJECTED.", job.id);
                          addToast("Job Declined", 'info');
                        }}
                      >
                        <Text style={[styles.secondaryButtonText, { fontSize: 12, color: COLORS.danger }]}>
                          {lang === 'URDU' ? 'مسترد کریں' : 'Decline'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {['CONFIRMED', 'BOOKED'].includes(job.status?.toUpperCase()) && (
                    <TouchableOpacity 
                      style={[
                        styles.button, 
                        { flex: 1, minWidth: 100, height: 36, padding: 0, justifyContent: 'center' },
                        isDispatchLocked && { opacity: 0.6 }
                      ]}
                      onPress={async () => {
                        if (isDispatchLocked) {
                          addToast(t('dispatchLimitError', lang), "error");
                          return;
                        }
                        await updateDoc(doc(db, 'bookings', job.id), { status: 'DISPATCHED' });
                        if (job.serviceMode === 'SHOP') {
                          sendNotification(job.userId, "Service Started", "Your service provider has started the job!", job.id);
                          addToast("Job status updated to STARTED", 'success');
                        } else {
                          sendNotification(job.userId, "Provider Dispatched", "Your service provider has been dispatched and is on the way!", job.id);
                          addToast("Job status updated to DISPATCHED", 'success');
                        }
                      }}
                    >
                      <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        {isDispatchLocked && <Feather name="lock" size={12} color="#fff" />}
                        <Text style={[styles.buttonText, { fontSize: 12 }]}>
                          {job.serviceMode === 'SHOP' ? (lang === 'URDU' ? 'سروس شروع کریں' : "Start User's Service") : (lang === 'URDU' ? 'روانہ ہوں' : 'Dispatch Now')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  {job.status?.toUpperCase() === 'DISPATCHED' && (
                    <TouchableOpacity 
                      style={[styles.button, { flex: 1, minWidth: 100, height: 36, padding: 0, justifyContent: 'center', backgroundColor: COLORS.success }]}
                      onPress={async () => {
                        await updateDoc(doc(db, 'bookings', job.id), { status: 'COMPLETED' });
                        sendNotification(job.userId, "Job Completed", "Thank you for using Yaqeen AI! Your service job has been marked as COMPLETED.", job.id);
                        addToast("Job COMPLETED!", 'success');
                      }}
                    >
                      <Text style={[styles.buttonText, { fontSize: 12 }]}>
                        {lang === 'URDU' ? 'مکمل نشان زد کریں' : 'Mark Complete'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {['NEGOTIATING', 'NEGOTIATION', 'BOOKED', 'CONFIRMED', 'DISPATCHED'].includes(job.status?.toUpperCase()) && (
                    <>
                      <TouchableOpacity 
                        style={[styles.secondaryButton, { flex: 1, minWidth: 90, height: 36, padding: 0, justifyContent: 'center', borderColor: COLORS.primary, opacity: !isProfileComplete ? 0.6 : 1 }]}
                        onPress={() => {
                          if (!isProfileComplete) {
                            addToast(getProfileIncompleteMessage(), "error");
                            return;
                          }
                          setActiveChatBooking(job);
                        }}
                      >
                        <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center' }}>
                          <Feather name="message-square" size={14} color={COLORS.primary} style={[lang === 'URDU' ? { marginLeft: 6 } : { marginRight: 6 }]} />
                          <Text style={[styles.secondaryButtonText, { fontSize: 12, color: COLORS.primary }]}>
                            {lang === 'URDU' ? 'چیٹ' : 'Chat'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      {job.serviceMode !== 'SHOP' && (
                        <TouchableOpacity 
                          style={[styles.secondaryButton, { flex: 1, minWidth: 90, height: 36, padding: 0, justifyContent: 'center', borderColor: COLORS.primary }]}
                          onPress={() => {
                            setSelectedRoutingJob(job);
                            setRoutingModalVisible(true);
                          }}
                        >
                          <View style={{ flexDirection: lang === 'URDU' ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center' }}>
                            <Feather name="map" size={14} color={COLORS.primary} style={[lang === 'URDU' ? { marginLeft: 6 } : { marginRight: 6 }]} />
                            <Text style={[styles.secondaryButtonText, { fontSize: 12, color: COLORS.primary }]}>
                              {lang === 'URDU' ? 'روٹ' : 'Route'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              </View>
            );
          }) : (
              <View style={{ padding: 20, alignItems: 'center', backgroundColor: isDarkMode ? '#111' : '#F8FAFC', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.border }}>
                <Text style={{ color: COLORS.textSecondary, textAlign: 'center' }}>
                  {lang === 'URDU' ? 'ابھی تک کوئی کام تفویض نہیں کیا گیا ہے۔' : 'No active jobs assigned yet.'}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
