import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Animated, Dimensions } from 'react-native';
import * as Font from 'expo-font';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, updateProfile } from 'firebase/auth';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  setDoc,
  onSnapshot,
  limit,
  getDoc,
  deleteDoc,
  orderBy,
} from 'firebase/firestore';
import { parseBookingTime, getTimeRemainingString, parseRelativeTimeToDate } from './timeUtils';
import { fetchOSRMRoute, calculateStraightLineDistance } from './routing';
import { getBackendUrl } from './api';
import { useToast } from './ToastContext';
import { THEMES, getStyles } from '../theme/index';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { addToast } = useToast();

  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoginMode, setIsLoginMode] = useState(true);

  useEffect(() => {
    async function loadIconFonts() {
      try {
        await Font.loadAsync({
          'feather': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf'),
          'antdesign': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/AntDesign.ttf'),
          'material-community': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'),
        });
      } catch (e) {
        console.warn("Failed to load vector icon fonts:", e);
      } finally {
        setFontsLoaded(true);
      }
    }
    loadIconFonts();
  }, []);

  useEffect(() => {
    async function loadCustomBackendUrl() {
      try {
        const storedUrl = await AsyncStorage.getItem('custom_backend_url');
        if (storedUrl) {
          global.customBackendUrl = storedUrl;
        }
      } catch (e) {
        console.warn("Failed to load custom backend URL:", e);
      }
    }
    loadCustomBackendUrl();
  }, []);

  // Refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isLoggingInRef = useRef(false);
  const pendingEmailRef = useRef(null);
  const tempPasswordRef = useRef(null);
  const chatScrollView = useRef(null);

  // Animated Splash Screen States
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const slideOpacity = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const [showSplash, setShowSplash] = useState(true);

  // Auth state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // App state
  const [currentTab, setCurrentTab] = useState('home');
  const [inputText, setInputText] = useState('');
  const [serviceMode, setServiceMode] = useState(null);
  const [useLocation, setUseLocation] = useState(false);
  const [locationCoords, setLocationCoords] = useState(null);
  const [currentAddress, setCurrentAddress] = useState(null);
  const [loading, setLoading] = useState(false);

  // Booking State
  const [searchResult, setSearchResult] = useState(null);
  const [finalBooking, setFinalBooking] = useState(null);
  const [searchContext, setSearchContext] = useState(null);
  const [typoSuggestion, setTypoSuggestion] = useState(null);
  const [originalTypoWord, setOriginalTypoWord] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // History State
  const [bookings, setBookings] = useState([]);
  const [availableJobs, setAvailableJobs] = useState([]);
  const [myProviderJobs, setMyProviderJobs] = useState([]);
  const [allRegisteredProviders, setAllRegisteredProviders] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('upcoming');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [showTracingModal, setShowTracingModal] = useState(false);
  const [agentTracingLogs, setAgentTracingLogs] = useState([]);

  // Theme
  const [isDarkMode, setIsDarkMode] = useState(true);
  const COLORS = isDarkMode ? THEMES.dark : THEMES.light;
  const styles = getStyles(COLORS);

  // Profile Active tabs
  const [profileActiveTab, setProfileActiveTab] = useState('account');
  const [userProfile, setUserProfile] = useState(null);
  const [isProviderMode, setIsProviderMode] = useState(false);

  // Dialog & sheets
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogConfig, setDialogConfig] = useState({ title: '', message: '', type: 'info', onConfirm: null });
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showEmailVerifiedBadge, setShowEmailVerifiedBadge] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [activeAddress, setActiveAddress] = useState(null);
  const [locationStep, setLocationStep] = useState('list');
  const [pinnedCoords, setPinnedCoords] = useState({ latitude: 33.6844, longitude: 73.0479 });
  const [mapRegion, setMapRegion] = useState({
    latitude: 33.6844,
    longitude: 73.0479,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  });
  const [entranceCoords, setEntranceCoords] = useState(null);
  const [addressForm, setAddressForm] = useState({
    street: '',
    floor: '',
    instructions: '',
    altPhone: '',
    label: 'HOME',
    customLabel: '',
  });
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);

  const [imageUri, setImageUri] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [notificationsList, setNotificationsList] = useState([]);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);
  const [isChatContextMode, setIsChatContextMode] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [activeChatBooking, setActiveChatBooking] = useState(null);
  const [routingModalVisible, setRoutingModalVisible] = useState(false);
  const [selectedRoutingJob, setSelectedRoutingJob] = useState(null);
  const [providerRouteCoords, setProviderRouteCoords] = useState([]);
  const [providerDistance, setProviderDistance] = useState('');
  const [providerDuration, setProviderDuration] = useState('');
  const [isProviderRouteLoading, setIsProviderRouteLoading] = useState(false);
  const [clientRouteCoords, setClientRouteCoords] = useState([]);
  const [clientDistance, setClientDistance] = useState('');
  const [clientDuration, setClientDuration] = useState('');
  const [isClientRouteLoading, setIsClientRouteLoading] = useState(false);
  const [manualChatMessages, setManualChatMessages] = useState([]);
  const [chatInputText, setChatInputText] = useState('');
  const [isPriceOfferModalVisible, setPriceOfferModalVisible] = useState(false);
  const [isTimeOfferModalVisible, setTimeOfferModalVisible] = useState(false);
  const [negotiationPriceInput, setNegotiationPriceInput] = useState('');
  const [negotiationTimeInput, setNegotiationTimeInput] = useState('');
  const [counteringMessageId, setCounteringMessageId] = useState(null);
  const [negotiationTimeAmPm, setNegotiationTimeAmPm] = useState(null);
  const [isCustomerActiveBookingsExpanded, setCustomerActiveBookingsExpanded] = useState(true);
  const [isProviderBroadcastsExpanded, setProviderBroadcastsExpanded] = useState(true);
  const [isUpcomingJobsExpanded, setUpcomingJobsExpanded] = useState(true);
  const [isPastJobsExpanded, setPastJobsExpanded] = useState(true);
  const [isProviderAssignedExpanded, setProviderAssignedExpanded] = useState(true);
  const [historySortOrder, setHistorySortOrder] = useState('newest');

  const checkConnection = async () => {
    setIsCheckingConnection(true);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      setIsConnected(navigator.onLine);
      setIsCheckingConnection(false);
      return;
    }
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000);
      await fetch('https://1.1.1.1', { method: 'HEAD', signal: controller.signal });
      clearTimeout(id);
      setIsConnected(true);
    } catch (err) {
      setIsConnected(false);
    } finally {
      setIsCheckingConnection(false);
    }
  };

  useEffect(() => {
    checkConnection();
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => setIsConnected(true);
      const handleOffline = () => setIsConnected(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const sendNotification = useCallback(async (recipientId, title, body, bookingId = null) => {
    try {
      if (!recipientId) return;

      await addDoc(collection(db, 'users', recipientId, 'notifications'), {
        title,
        body,
        bookingId,
        read: false,
        createdAt: Date.now(),
      });

      const userSnap = await getDoc(doc(db, 'users', recipientId));
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.pushToken) {
          fetch(getBackendUrl('/api/send-push'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pushToken: userData.pushToken,
              title,
              body,
              data: { bookingId },
            }),
          }).catch((err) => console.warn("[PUSH API] Failed to forward push payload:", err));
        }
      }
    } catch (err) {
      console.warn("[NOTIFICATION] Error creating notification log:", err);
    }
  }, []);

  const notifyAction = useCallback((title, message) => {
    setDialogConfig({ title, message, type: 'info', onConfirm: null });
    setDialogVisible(true);
  }, []);

  const fetchBookings = useCallback(() => {
    if (!user) return;
    setHistoryLoading(true);

    const normalize = (str) => (str ? str.toLowerCase().trim().replace(/[\s-]/g, '') : '');

    const q = query(collection(db, 'bookings'), where('userId', '==', user.uid));
    const translateError = (err) => {
      if (err.message.includes("permissions") || err.code === 'permission-denied') {
        return "Access denied. Your account may not have the required permissions. Please try logging out and back in.";
      }
      return err.message;
    };

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const fetchedBookings = [];
        querySnapshot.forEach((docSnap) => {
          fetchedBookings.push({ id: docSnap.id, ...docSnap.data() });
        });
        fetchedBookings.sort((a, b) => b.createdAt - a.createdAt);
        setBookings(fetchedBookings);

        setFinalBooking((prevFinal) => {
          if (!prevFinal) return null;
          const latest = fetchedBookings.find((b) => b.id === prevFinal.id);
          return latest ? { ...prevFinal, ...latest } : prevFinal;
        });

        setHistoryLoading(false);
      },
      (err) => {
        console.warn("Real-time listener failed:", err.message);
        setError(translateError(err));
        setHistoryLoading(false);
      }
    );

    let unsubscribeProvider = null;
    let unsub1 = null;
    let unsub2 = null;
    let unsub3 = null;

    if (isProviderMode) {
      let myJobs1 = [];
      let myJobs2 = [];
      let myJobs3 = [];

      const updateMyJobs = () => {
        const combined = [...myJobs1, ...myJobs2, ...myJobs3];
        const uniqueMap = {};
        combined.forEach((item) => {
          uniqueMap[item.id] = item;
        });
        const uniqueList = Object.values(uniqueMap);
        uniqueList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setMyProviderJobs(uniqueList);
      };

      const mq1 = query(collection(db, 'bookings'), where('providerId', '==', user.uid), limit(50));
      unsub1 = onSnapshot(
        mq1,
        (qs) => {
          const mj = [];
          qs.forEach((d) => mj.push({ id: d.id, ...d.data() }));
          myJobs1 = mj;
          updateMyJobs();
        },
        (err) => {
          console.warn("Provider jobs listener 1 failed:", err.message);
        }
      );

      const mq2 = query(collection(db, 'bookings'), where('targetProviderId', '==', user.uid), limit(50));
      unsub2 = onSnapshot(
        mq2,
        (qs) => {
          const mj = [];
          qs.forEach((d) => mj.push({ id: d.id, ...d.data() }));
          myJobs2 = mj;
          updateMyJobs();
        },
        (err) => {
          console.warn("Provider jobs listener 2 failed:", err.message);
        }
      );

      if (userProfile?.providerID) {
        const mq3 = query(collection(db, 'bookings'), where('providerID', '==', userProfile.providerID), limit(50));
        unsub3 = onSnapshot(
          mq3,
          (qs) => {
            const mj = [];
            qs.forEach((d) => mj.push({ id: d.id, ...d.data() }));
            myJobs3 = mj;
            updateMyJobs();
          },
          (err) => {
            console.warn("Provider jobs listener 3 failed:", err.message);
          }
        );
      }

      if (userProfile && userProfile.city) {
        const pq = query(collection(db, 'bookings'), where('city_norm', '==', normalize(userProfile.city)), limit(100));
        unsubscribeProvider = onSnapshot(
          pq,
          (qs) => {
            const pb = [];
            qs.forEach((d) => {
              const data = d.data();
              const statusUpper = (data.status || '').toUpperCase();
              if (!['PENDING', 'NEGOTIATING', 'NEGOTIATION'].includes(statusUpper)) return;

              const isMyJob =
                data.providerId === user.uid ||
                data.targetProviderId === user.uid ||
                (userProfile?.providerID &&
                  typeof (data.providerID || data.providerId) === 'string' &&
                  (data.providerID || data.providerId).toUpperCase() === userProfile.providerID.toUpperCase());

              if (statusUpper === 'NEGOTIATING' || statusUpper === 'NEGOTIATION') {
                if (!isMyJob) return;
              } else {
                if (data.providerId && data.providerId !== user.uid) return;
                if (data.targetProviderId) {
                  if (data.targetProviderId !== user.uid) return;
                } else {
                  if (data.isBroadcast === false && !isMyJob) return;
                }
              }

              const pArea = normalize(userProfile.area);
              const bArea = data.area_norm || '';

              if (!pArea || bArea === '' || bArea === pArea || bArea.includes(pArea) || pArea.includes(bArea)) {
                pb.push({ id: d.id, ...data });
              }
            });
            setAvailableJobs(pb);
          },
          (err) => {
            console.warn("Provider broadcast listener failed:", err.message);
          }
        );
      }
    }

    return () => {
      unsubscribe();
      if (unsubscribeProvider) unsubscribeProvider();
      if (unsub1) unsub1();
      if (unsub2) unsub2();
      if (unsub3) unsub3();
    };
  }, [user, isProviderMode, userProfile?.city, userProfile?.area, userProfile?.providerID]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        const refreshedUser = auth.currentUser;
        const isGoogleUser = refreshedUser.providerData?.some((p) => p.providerId === 'google.com');
        const isVerifiedActual = refreshedUser.emailVerified || isGoogleUser;
        if (isGoogleUser) {
          setIsEmailVerified(true);
        } else {
          setIsEmailVerified(refreshedUser.emailVerified);
        }
        setUser({ ...refreshedUser });

        const userDocRef = doc(db, 'users', refreshedUser.uid);
        await updateDoc(userDocRef, { isVerified: isVerifiedActual });
      }

      setError(null);
      setSuccess(null);

      fetchBookings();

      const q = query(collection(db, 'users'), where('role', '==', 'provider'));
      const qs = await getDocs(q);
      const providers = [];
      qs.forEach((docSnap) => providers.push({ id: docSnap.id, ...docSnap.data() }));
      setAllRegisteredProviders(providers);

      addToast("App refreshed successfully!", 'success');
    } catch (err) {
      console.warn("Pull to refresh failed:", err);
      addToast("Failed to refresh: " + err.message, 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleReverseGeocode = useCallback(async (coords) => {
    try {
      const response = await fetch(getBackendUrl('/api/geocode'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationCoords: { lat: coords.latitude, lng: coords.longitude } }),
      });
      const data = await response.json();
      if (response.ok && data.address) {
        return data.address;
      }
    } catch (e) {
      console.warn("Reverse geocode failed:", e);
    }
    return `Pinned Location (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`;
  }, []);

  const searchGeocodeAddress = async () => {
    if (!searchText.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(getBackendUrl('/api/forward-geocode'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: searchText.trim() }),
      });
      const data = await response.json();
      if (response.ok && data.lat && data.lng) {
        const coords = { latitude: data.lat, longitude: data.lng };
        setPinnedCoords(coords);
        setMapRegion({
          ...coords,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        });
        addToast("Location loaded on Map!", 'success');
      } else {
        addToast(data.error || "Location not found. Try a different search.", 'error');
      }
    } catch (err) {
      console.warn("Geocoding failed:", err);
      addToast("Failed to search location. Network error.", 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const useCurrentGPSLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        addToast("Location permission was denied", 'error');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      setPinnedCoords(coords);
      setMapRegion({
        ...coords,
        latitudeDelta: 0.002,
        longitudeDelta: 0.002,
      });

      const formatted = await handleReverseGeocode(coords);
      setSearchText(formatted);
      addToast("GPS Location Acquired", 'success');

      if (locationStep === 'list') {
        setLocationStep('map');
      }
    } catch (e) {
      console.warn("Failed to get current GPS location:", e);
      addToast("Failed to acquire GPS location", 'error');
    }
  };

  const saveAddress = async () => {
    if (!user) {
      addToast("Please sign in to save addresses", 'error');
      return;
    }

    const activeLabel =
      addressForm.label === 'OTHER' ? addressForm.customLabel.trim() || 'OTHER' : addressForm.label;

    try {
      const finalAddressString = await handleReverseGeocode(pinnedCoords);

      const addressData = {
        label: activeLabel,
        address: finalAddressString,
        street: addressForm.street.trim(),
        floor: addressForm.floor.trim(),
        instructions: addressForm.instructions.trim(),
        altPhone: addressForm.altPhone.trim(),
        latitude: pinnedCoords.latitude,
        longitude: pinnedCoords.longitude,
        entranceLatitude: entranceCoords ? entranceCoords.latitude : pinnedCoords.latitude,
        entranceLongitude: entranceCoords ? entranceCoords.longitude : pinnedCoords.longitude,
        updatedAt: Date.now(),
      };

      const addrRef = collection(db, 'users', user.uid, 'addresses');

      if (editingAddressId) {
        await updateDoc(doc(db, 'users', user.uid, 'addresses', editingAddressId), addressData);
        addToast("Address updated successfully!", 'success');
      } else {
        addressData.createdAt = Date.now();
        const newDoc = await addDoc(addrRef, addressData);
        setActiveAddress({ id: newDoc.id, ...addressData });
        addToast("Address saved successfully!", 'success');
      }

      setShowLocationSheet(false);
    } catch (e) {
      console.error("Failed to save address:", e);
      addToast("Failed to save address", 'error');
    }
  };

  const deleteAddress = async (addressId) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'addresses', addressId);
      const isCurrentlyActive = activeAddress && activeAddress.id === addressId;

      await deleteDoc(docRef);
      addToast("Address deleted successfully", 'success');

      if (isCurrentlyActive) {
        setActiveAddress(null);
      }
    } catch (e) {
      console.error("Failed to delete address:", e);
      addToast("Failed to delete address", 'error');
    }
  };

  const editAddressStart = (item) => {
    setEditingAddressId(item.id);
    setPinnedCoords({ latitude: item.latitude, longitude: item.longitude });
    setMapRegion({
      latitude: item.latitude,
      longitude: item.longitude,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    });
    setEntranceCoords({ latitude: item.entranceLatitude, longitude: item.entranceLongitude });

    const standardLabels = ['HOME', 'OFFICE', 'PARTNER'];
    const isStandard = standardLabels.includes(item.label);

    setAddressForm({
      street: item.street || '',
      floor: item.floor || '',
      instructions: item.instructions || '',
      altPhone: item.altPhone || '',
      label: isStandard ? item.label : 'OTHER',
      customLabel: isStandard ? '' : item.label,
    });
    setSearchText(item.address);
    setLocationStep('map');
  };

  const registerForPushNotificationsAsync = async (uid) => {
    if (Platform.OS === 'web') return null;

    if (userProfile && userProfile.pushNotificationsEnabled === false) {
      try {
        const userDocRef = doc(db, 'users', uid);
        await updateDoc(userDocRef, { pushToken: null });
      } catch (err) {
        console.warn("Failed to clear push token:", err);
      }
      return null;
    }

    const isExpoGo = Constants?.executionEnvironment === 'storeClient';
    if (isExpoGo) return null;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return null;

      const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
      if (!projectId) return null;

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const pushToken = tokenData.data;

      const userDocRef = doc(db, 'users', uid);
      await updateDoc(userDocRef, { pushToken });
      return pushToken;
    } catch (error) {
      console.log("[PUSH] Push registration error:", error.message);
      return null;
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      const q = query(collection(db, 'users', user.uid, 'notifications'), where('read', '==', false));
      const snapshot = await getDocs(q);
      const batchPromises = snapshot.docs.map((docSnap) => updateDoc(docSnap.ref, { read: true }));
      await Promise.all(batchPromises);
      addToast("All notifications marked as read", 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const clearAllNotifications = async () => {
    try {
      const q = query(collection(db, 'users', user.uid, 'notifications'));
      const snapshot = await getDocs(q);
      const batchPromises = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
      await Promise.all(batchPromises);
      addToast("Notification log cleared", 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.read) {
        await updateDoc(doc(db, 'users', user.uid, 'notifications', notif.id), { read: true });
      }
      setShowNotificationsDrawer(false);

      if (notif.bookingId) {
        const bookingSnap = await getDoc(doc(db, 'bookings', notif.bookingId));
        if (bookingSnap.exists()) {
          const bookingData = { id: bookingSnap.id, ...bookingSnap.data() };
          setActiveChatBooking(bookingData);
          setIsChatContextMode(true);
          addToast(`Opening Chat for: ${bookingData.serviceTitle || 'Booking'}`, 'success');
        } else {
          addToast("Booking details could not be found.", 'error');
        }
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setSearchResult(null);
    setFinalBooking(null);
    setError(null);
    setCurrentTab('home');
  };

  const handleLocationToggle = async () => {
    if (useLocation) {
      setUseLocation(false);
      setLocationCoords(null);
      setCurrentAddress(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission to access location was denied');
        setUseLocation(false);
        setLoading(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocationCoords({ lat: location.coords.latitude, lng: location.coords.longitude });

      const geocodeResponse = await fetch(getBackendUrl('/api/geocode'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationCoords: { lat: location.coords.latitude, lng: location.coords.longitude } }),
      });
      const geocodeData = await geocodeResponse.json();

      if (geocodeData.address) {
        setCurrentAddress(geocodeData.address);
      } else {
        setCurrentAddress('Coordinates acquired');
      }
      setUseLocation(true);
    } catch (err) {
      setError('Could not fetch location: ' + err.message);
      setUseLocation(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptJob = async (jobId) => {
    try {
      setLoading(true);
      const jobRef = doc(db, 'bookings', jobId);
      await updateDoc(jobRef, {
        status: 'CONFIRMED',
        providerId: user.uid,
        providerName: userProfile?.shopName || userProfile?.name || user.displayName || 'Professional Provider',
        providerPhone: userProfile?.phoneNumber || 'N/A',
        providerID: userProfile?.providerID || `PRO-${user.uid.substring(0, 4).toUpperCase()}`,
        providerAddress: userProfile?.shopAddress || userProfile?.address || 'N/A',
      });

      const jobSnap = await getDoc(jobRef);
      if (jobSnap.exists()) {
        const jobData = jobSnap.data();
        sendNotification(
          jobData.userId,
          "Booking Confirmed",
          `${user.displayName || 'A professional provider'} has accepted your booking broadcast!`,
          jobId
        );
      }

      addToast("Job Accepted Successfully!", 'success');
    } catch (err) {
      setError("Failed to accept job: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOfferPrice = () => {
    setNegotiationPriceInput('');
    setCounteringMessageId(null);
    setPriceOfferModalVisible(true);
  };

  const handleOfferTime = () => {
    setNegotiationTimeInput('');
    setCounteringMessageId(null);
    setTimeOfferModalVisible(true);
  };

  const submitInlinePriceOffer = async () => {
    const newPrice = Number(negotiationPriceInput);
    if (isNaN(newPrice) || newPrice <= 0) {
      addToast("Invalid price offer amount", 'error');
      return;
    }

    try {
      const bookingRef = doc(db, 'bookings', activeChatBooking.id);

      if (counteringMessageId) {
        const prevMsgRef = doc(db, 'bookings', activeChatBooking.id, 'messages', counteringMessageId);
        await updateDoc(prevMsgRef, { status: 'countered' });
      }

      const messageRef = collection(db, 'bookings', activeChatBooking.id, 'messages');
      await addDoc(messageRef, {
        senderId: user.uid,
        senderName: isProviderMode ? 'Provider' : 'Customer',
        text: `Proposed Rs. ${newPrice.toLocaleString()} price offer`,
        type: 'price_offer',
        offeredPrice: newPrice,
        offeredBy: isProviderMode ? 'provider' : 'customer',
        status: 'pending',
        createdAt: Date.now(),
      });

      await updateDoc(bookingRef, {
        offeredPrice: newPrice,
        offeredPriceBy: isProviderMode ? 'provider' : 'customer',
      });

      const recipientId = isProviderMode ? activeChatBooking.userId : activeChatBooking.providerId;
      const senderLabel = isProviderMode ? 'Provider' : 'Customer';
      sendNotification(
        recipientId,
        `Price Offer from ${senderLabel}`,
        `Proposed price: Rs. ${newPrice.toLocaleString()}`,
        activeChatBooking.id
      );

      setPriceOfferModalVisible(false);
      setNegotiationPriceInput('');
      setCounteringMessageId(null);
      addToast("Price offer sent inside chat!", 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const submitInlineTimeOffer = async () => {
    if (!negotiationTimeInput.trim()) {
      addToast("Please enter proposed time slot", 'error');
      return;
    }

    if (!negotiationTimeAmPm) {
      addToast("Please select AM or PM", 'error');
      return;
    }

    let cleanedTime = negotiationTimeInput.trim();
    cleanedTime = cleanedTime.replace(/\s*(am|pm)\s*$/i, '');
    const finalTime = `${cleanedTime} ${negotiationTimeAmPm}`;

    try {
      const bookingRef = doc(db, 'bookings', activeChatBooking.id);

      if (counteringMessageId) {
        const prevMsgRef = doc(db, 'bookings', activeChatBooking.id, 'messages', counteringMessageId);
        await updateDoc(prevMsgRef, { status: 'countered' });
      }

      const messageRef = collection(db, 'bookings', activeChatBooking.id, 'messages');
      await addDoc(messageRef, {
        senderId: user.uid,
        senderName: isProviderMode ? 'Provider' : 'Customer',
        text: `Proposed new time slot: ${finalTime}`,
        type: 'time_offer',
        offeredTime: finalTime,
        offeredBy: isProviderMode ? 'provider' : 'customer',
        status: 'pending',
        createdAt: Date.now(),
      });

      await updateDoc(bookingRef, {
        offeredTime: finalTime,
        offeredTimeBy: isProviderMode ? 'provider' : 'customer',
      });

      const recipientId = isProviderMode ? activeChatBooking.userId : activeChatBooking.providerId;
      const senderLabel = isProviderMode ? 'Provider' : 'Customer';
      sendNotification(
        recipientId,
        `Time Slot Proposal from ${senderLabel}`,
        `Proposed time slot: ${finalTime}`,
        activeChatBooking.id
      );

      setTimeOfferModalVisible(false);
      setNegotiationTimeInput('');
      setNegotiationTimeAmPm(null);
      setCounteringMessageId(null);
      addToast("Time offer proposed inside chat!", 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleAcceptInlinePriceOffer = async (msgId, targetPrice) => {
    try {
      const bookingRef = doc(db, 'bookings', activeChatBooking.id);

      const msgRef = doc(db, 'bookings', activeChatBooking.id, 'messages', msgId);
      await updateDoc(msgRef, { status: 'accepted' });

      await updateDoc(bookingRef, {
        price: targetPrice,
        offeredPrice: null,
        offeredPriceBy: null,
      });

      const messageRef = collection(db, 'bookings', activeChatBooking.id, 'messages');
      await addDoc(messageRef, {
        senderId: 'system',
        senderName: 'Yaqeen AI',
        text: `${isProviderMode ? 'Provider' : 'Customer'} accepted price offer of Rs. ${targetPrice.toLocaleString()}! Price settled.`,
        createdAt: Date.now(),
      });

      const recipientId = isProviderMode ? activeChatBooking.userId : activeChatBooking.providerId;
      sendNotification(
        recipientId,
        "Price Offer Accepted",
        `${isProviderMode ? 'Provider' : 'Customer'} accepted price offer of Rs. ${targetPrice.toLocaleString()}!`,
        activeChatBooking.id
      );

      addToast("Price offer accepted & updated!", 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDeclineInlinePriceOffer = async (msgId) => {
    try {
      const bookingRef = doc(db, 'bookings', activeChatBooking.id);

      const msgRef = doc(db, 'bookings', activeChatBooking.id, 'messages', msgId);
      await updateDoc(msgRef, { status: 'declined' });

      await updateDoc(bookingRef, {
        offeredPrice: null,
        offeredPriceBy: null,
      });

      const messageRef = collection(db, 'bookings', activeChatBooking.id, 'messages');
      await addDoc(messageRef, {
        senderId: 'system',
        senderName: 'Yaqeen AI',
        text: `Price offer was declined.`,
        createdAt: Date.now(),
      });

      const recipientId = isProviderMode ? activeChatBooking.userId : activeChatBooking.providerId;
      sendNotification(
        recipientId,
        "Price Offer Declined",
        `${isProviderMode ? 'Provider' : 'Customer'} declined the proposed price offer.`,
        activeChatBooking.id
      );

      addToast("Price offer declined", 'info');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleAcceptInlineTimeOffer = async (msgId, targetTime) => {
    try {
      const bookingRef = doc(db, 'bookings', activeChatBooking.id);

      const msgRef = doc(db, 'bookings', activeChatBooking.id, 'messages', msgId);
      await updateDoc(msgRef, { status: 'accepted' });

      await updateDoc(bookingRef, {
        time: targetTime,
        offeredTime: null,
        offeredTimeBy: null,
      });

      const messageRef = collection(db, 'bookings', activeChatBooking.id, 'messages');
      await addDoc(messageRef, {
        senderId: 'system',
        senderName: 'Yaqeen AI',
        text: `Time slot finalized to: ${targetTime}!`,
        createdAt: Date.now(),
      });

      const recipientId = isProviderMode ? activeChatBooking.userId : activeChatBooking.providerId;
      sendNotification(
        recipientId,
        "Time Offer Accepted",
        `Time slot finalized to: ${targetTime}!`,
        activeChatBooking.id
      );

      addToast("Time offer accepted!", 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDeclineInlineTimeOffer = async (msgId) => {
    try {
      const bookingRef = doc(db, 'bookings', activeChatBooking.id);

      const msgRef = doc(db, 'bookings', activeChatBooking.id, 'messages', msgId);
      await updateDoc(msgRef, { status: 'declined' });

      await updateDoc(bookingRef, {
        offeredTime: null,
        offeredTimeBy: null,
      });

      const messageRef = collection(db, 'bookings', activeChatBooking.id, 'messages');
      await addDoc(messageRef, {
        senderId: 'system',
        senderName: 'Yaqeen AI',
        text: `Time offer was declined.`,
        createdAt: Date.now(),
      });

      const recipientId = isProviderMode ? activeChatBooking.userId : activeChatBooking.providerId;
      sendNotification(
        recipientId,
        "Time Offer Declined",
        `${isProviderMode ? 'Provider' : 'Customer'} declined the proposed time offer.`,
        activeChatBooking.id
      );

      addToast("Time offer declined", 'info');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleCancelJobFromOffer = async () => {
    try {
      const bookingRef = doc(db, 'bookings', activeChatBooking.id);
      await updateDoc(bookingRef, {
        status: 'CANCELLED_BY_USER',
        offeredTime: null,
        offeredTimeBy: null,
        offeredPrice: null,
        offeredPriceBy: null,
      });

      const messageRef = collection(db, 'bookings', activeChatBooking.id, 'messages');
      await addDoc(messageRef, {
        senderId: 'system',
        senderName: 'Yaqeen AI',
        text: `Client cancelled the service request.`,
        createdAt: Date.now(),
      });
      addToast("Job cancelled successfully", 'info');
      setActiveChatBooking(null);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleSendMessage = async () => {
    if (!chatInputText.trim() || !activeChatBooking) return;

    const status = activeChatBooking.status?.toUpperCase();
    if (
      status === 'COMPLETED' ||
      status === 'CANCELLED' ||
      status === 'CANCELLED_BY_USER' ||
      status === 'REJECTED'
    ) {
      addToast("Chat closed - service completed or cancelled", "error");
      return;
    }

    const txt = chatInputText;
    setChatInputText('');
    try {
      const messageRef = collection(db, 'bookings', activeChatBooking.id, 'messages');
      await addDoc(messageRef, {
        senderId: user.uid,
        senderName:
          userProfile?.shopName ||
          userProfile?.name ||
          user.displayName ||
          (user.email ? user.email.split('@')[0] : 'Client'),
        text: txt.trim(),
        createdAt: Date.now(),
      });
    } catch (err) {
      addToast("Failed to send message: " + err.message, "error");
    }
  };

  const handleNegotiateManually = async () => {
    setLoading(true);
    setError(null);
    try {
      const normalize = (str) => (str ? str.toLowerCase().trim().replace(/[\s-]/g, '') : '');
      const bookingData = {
        userId: user.uid,
        customerName: user.displayName || (user.email ? user.email.split('@')[0] : 'Client'),
        service: searchResult.intent.service,
        notes: searchResult.intent.notes || '',
        location: searchResult.intent.location || 'Unknown Location',
        city: searchResult.intent.city || '',
        area: searchResult.intent.area || '',
        city_norm: normalize(searchResult.intent.city),
        area_norm: normalize(searchResult.intent.area),
        time:
          searchResult.provider.proposedTime ||
          searchResult.intent.time ||
          searchResult.intent.clockTime,
        providerName: searchResult.provider.name,
        providerAddress: searchResult.provider.address,
        providerPlaceId: searchResult.provider.placeId,
        status: 'NEGOTIATING',
        isBroadcast: !searchResult.provider.placeId,
        targetProviderId: searchResult.provider.uid || null,
        providerID:
          searchResult.provider.providerID ||
          searchResult.provider.providerId ||
          (searchResult.provider.uid ? `PRO-${searchResult.provider.uid.substring(0, 4).toUpperCase()}` : null),
        price: Number(searchResult.estimatedPrice) || 0,
        serviceMode: serviceMode || searchResult.intent?.serviceMode || 'HOME',
        visitingCharges: Number(searchResult.provider.visitingCharges) || 0,
        customerCoords: locationCoords || pinnedCoords || null,
        providerCoords: {
          lat: Number(searchResult.provider.lat || searchResult.provider.latitude) || 33.6493,
          lng: Number(searchResult.provider.lng || searchResult.provider.longitude) || 72.9806,
        },
        createdAt: Date.now(),
      };

      const uniqueId = 'YAQ-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      const docRef = doc(db, 'bookings', uniqueId);
      await setDoc(docRef, bookingData);

      const messageRef = collection(db, 'bookings', docRef.id, 'messages');
      await addDoc(messageRef, {
        senderId: 'system',
        senderName: 'Yaqeen AI',
        text: `Manual Negotiation Started between ${bookingData.customerName} and ${bookingData.providerName}. Let's discuss pricing and terms!`,
        createdAt: Date.now(),
      });

      setSearchResult(null);
      setCurrentTab('history');
      addToast("Manual negotiation room opened! Check History tab.", 'success');

      const negotiateLog = {
        id: `trace-negotiate-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        icon: 'message-circle',
        title: 'Manual Negotiation Initialized',
        status: 'CONFIRMED',
        color: '#A855F7',
        description: `Opened manual negotiation room ${uniqueId} for "${searchResult.intent.service}".`,
        payload: {
          bookingId: uniqueId,
          service: searchResult.intent.service,
          provider: searchResult.provider.name,
          notes: searchResult.intent.notes || '',
        },
      };
      setAgentTracingLogs((prev) => [negotiateLog, ...prev]);
    } catch (err) {
      setError(err.message);
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        addToast("Camera permission is required to capture diagnostic photos.", 'error');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.5,
        base64: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
        setImageBase64(result.assets[0].base64);
        addToast("Photo captured for diagnosis", 'success');
      }
    } catch (e) {
      console.warn("Camera failed:", e);
      addToast("Failed to open camera.", 'error');
    }
  };

  const submitSearch = async () => {
    if (!inputText.trim()) {
      addToast("Please state what you need", 'error');
      return;
    }
    await submitSearchWithText(inputText);
  };

  const submitSearchWithText = async (searchStr) => {
    setLoading(true);
    setError(null);
    setSearchResult(null);
    setFinalBooking(null);
    setTypoSuggestion(null);
    setOriginalTypoWord(null);
    fadeAnim.setValue(0);

    const searchStartTime = Date.now();

    try {
      const response = await fetch(getBackendUrl('/api/search'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: searchStr,
          locationCoords: useLocation ? locationCoords : null,
          context: searchContext,
          imageBase64: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : null,
          providerMinPrice: userProfile?.minPrice || '1000',
          providerMaxPrice: userProfile?.maxPrice || '5000',
          registeredProviders: allRegisteredProviders,
          bookings: bookings,
          serviceMode: serviceMode,
        }),
      });

      const text = await response.text();
      let data;
      try {
        if (!text || !text.trim()) {
          throw new Error("Empty response");
        }
        data = JSON.parse(text);
      } catch (e) {
        console.error("JSON parse error. Response text:", text);
        throw new Error("Server returned an invalid response. Please check if the backend is running.");
      }

      if (!data || typeof data !== 'object') {
        console.error("Invalid response structure:", data);
        throw new Error("Server returned an invalid response structure.");
      }

      if (data.success) {
        setSearchContext(null);
        if (!data.searchResult.intent.service) {
          setDialogConfig({
            title: 'Service Missing',
            message: "Please specify what service you need (e.g., AC technician, Plumber).",
            type: 'info',
          });
          setDialogVisible(true);
          setLoading(false);
          return;
        }
        if (data.searchResult.provider) {
          const aiProv = data.searchResult.provider;
          const normalizeMatch = (s) => (s ? s.toLowerCase().replace(/[^a-z0-9]/g, '') : '');

          const matched = allRegisteredProviders.find((p) => {
            if (p.shopLink && aiProv.link && normalizeMatch(p.shopLink) === normalizeMatch(aiProv.link)) return true;
            if (
              p.shopName &&
              (normalizeMatch(p.shopName).includes(normalizeMatch(aiProv.name)) ||
                normalizeMatch(aiProv.name).includes(normalizeMatch(p.shopName)))
            )
              return true;
            if (
              p.shopAddress &&
              (normalizeMatch(p.shopAddress).includes(normalizeMatch(aiProv.address)) ||
                normalizeMatch(aiProv.address).includes(normalizeMatch(p.shopAddress)))
            )
              return true;
            return false;
          });

          if (matched) {
            data.searchResult.provider = {
              ...aiProv,
              uid: matched.uid,
              name: matched.shopName || matched.name,
              address: matched.shopAddress || matched.address,
              city: matched.city,
              area: matched.area,
              phone: matched.phoneNumber,
              visitingCharges: Number(matched.visitingCharges) || 0,
              isVerified: true,
            };
          } else {
            setDialogConfig({
              title: 'No Registered Provider Found',
              message: `The AI found "${aiProv.name}", but they aren't registered in our app yet. We only work with verified, registered providers.`,
              type: 'info',
            });
            setDialogVisible(true);
            setLoading(false);
            return;
          }
        }

        data.searchResult.intent.notes = searchText || inputText || '';

        const latencyMs = Date.now() - searchStartTime;

        const parsedLog = {
          id: `trace-parsed-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          icon: 'cpu',
          title: 'Intent Parsed via AI Engine',
          status: 'PARSED',
          color: '#A855F7',
          description: `Extracted intent for service "${data.searchResult.intent.service}" scheduled for ${data.searchResult.intent.time}.`,
          payload: { intent: data.searchResult.intent, latencyMs },
        };
        const geoLog = {
          id: `trace-geo-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          icon: 'map-pin',
          title: 'Geo-Location Bounds Locked',
          status: 'GEO-RESOLVED',
          color: '#10B981',
          description: `Locked location query to coordinates inside active boundary.`,
          payload: {
            coords: locationCoords || pinnedCoords,
            address: data.searchResult.intent.location,
            area: data.searchResult.intent.area,
            city: data.searchResult.intent.city,
            latencyMs,
          },
        };
        const matchedLog = {
          id: `trace-match-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          icon: 'activity',
          title: 'Optimal Provider Ranked',
          status: 'MATCHED',
          color: '#F59E0B',
          description: `Selected provider "${data.searchResult.provider?.name || 'Broadcast'}" based on distance and rating factors.`,
          payload: {
            selectedProvider: data.searchResult.provider,
            distanceText: data.searchResult.provider?.distanceText,
            reasoning: data.searchResult.reasoning,
            latencyMs,
          },
        };
        setAgentTracingLogs((prev) => [matchedLog, geoLog, parsedLog, ...prev]);

        setSearchResult(data.searchResult);
        setNegotiationStep(false);
      } else {
        if (data.error === 'TYPO_DETECTED') {
          setTypoSuggestion(data.typoSuggestion);
          setOriginalTypoWord(data.originalTypoWord);
        } else if (data.error === 'PROVIDER_UNAVAILABLE') {
          setSearchContext(data.searchResult?.intent || null);
          setDialogConfig({
            title: 'Provider Unavailable',
            message: `${data.providerName} is not available at the requested time. Please choose another time.`,
            type: 'time_error',
            onConfirm: () => {
              setDialogVisible(false);
              setShowDatePicker(true);
            },
          });
          setDialogVisible(true);
        } else if (data.error === 'NO_REGISTERED_PROVIDERS') {
          setDialogConfig({
            title: 'No Registered Providers Found',
            message: "We couldn't find any registered professionals for this service in your area. Please try a different service or area.",
            type: 'info',
          });
          setDialogVisible(true);
        } else if (data.error === 'LOCATION_TOO_BROAD') {
          setDialogConfig({
            title: 'More Specificity Needed',
            message: "To find the best service providers, please specify an Area, Sector, or nearest Landmark (e.g., 'Bahria Phase 7' instead of just 'Rawalpindi').",
            type: 'info',
          });
          setDialogVisible(true);
        } else if (data.error === 'NO_LOCATION') {
          setDialogConfig({
            title: 'Location Required',
            message: "Please include a city, area, or nearest landmark in your request so we can find providers nearby.",
            type: 'info',
            onConfirm: () => {
              setDialogVisible(false);
              setShowLocationSheet(true);
            },
          });
          setDialogVisible(true);
        } else if (data.error === 'PAST_TIME_ERROR') {
          setDialogConfig({
            title: 'Invalid Date/Time',
            message: "You have requested a time that is in the past! Please choose a future date and time.",
            type: 'info',
          });
          setDialogVisible(true);
        } else if (data.error === 'NO_TIME' || data.error === 'TIME_ERROR' || data.error === 'AM_PM_MISSING') {
          setSearchContext(data.searchResult?.intent || null);
          setDialogConfig({
            title: data.error === 'AM_PM_MISSING' ? 'Clarify AM/PM' : 'Time Required',
            message: data.error === 'AM_PM_MISSING' ? "Please specify if you mean AM or PM." : "When do you need this service?",
            type: 'time_error',
            onConfirm: () => {
              setDialogVisible(false);
              setShowDatePicker(true);
            },
          });
          setDialogVisible(true);
        } else {
          if (data.searchResult && data.searchResult.intent) {
            setSearchContext(data.searchResult.intent);
          }
          const errorMsg = data.error || 'An error occurred during searching.';
          console.error("Backend returned error:", errorMsg, "Full response:", data);
          setError(errorMsg);
        }
      }
    } catch (err) {
      console.error("Search error caught:", err.message, "Stack:", err.stack);
      console.warn("Backend search failed, initiating local resilient client fallback...");

      const queryLower = (searchText || inputText || "").toLowerCase().trim();

      try {
        let detectedCategory = null;
        const categoryKeywords = allRegisteredProviders.length > 0 ? {} : {}; // Handled by Translations import

        const stopWords = ["repair", "service", "need", "in", "near", "for", "the", "a", "an", "of", "and", "to", "at", "on", "with", "by", "from", "want", "require", "urgently", "urgent"];
        const getSignificantWords = (t) =>
          t.split(/\s+/)
            .map((w) => w.replace(/[^a-z0-9]/g, ''))
            .filter((w) => w.length > 1 && !stopWords.includes(w));

        const localProviders = allRegisteredProviders.filter((p) => {
          if (p.role !== 'provider') return false;

          const shopNameLower = (p.shopName || p.name || "").toLowerCase();
          const branchLower = (p.branch || "").toLowerCase();
          const addressLower = (p.shopAddress || p.address || "").toLowerCase();
          const cityLower = (p.city || "").toLowerCase();
          const areaLower = (p.area || "").toLowerCase();

          if (
            shopNameLower.includes(queryLower) ||
            branchLower.includes(queryLower) ||
            addressLower.includes(queryLower) ||
            cityLower.includes(queryLower) ||
            areaLower.includes(queryLower)
          ) {
            return true;
          }

          const queryWords = getSignificantWords(queryLower);
          if (queryWords.length > 0) {
            const shopWords = getSignificantWords(shopNameLower);
            const branchWords = getSignificantWords(branchLower);

            const hasShopOverlap = queryWords.some((qw) => shopWords.some((sw) => sw.includes(qw) || qw.includes(sw)));
            const hasBranchOverlap = queryWords.some((qw) => branchWords.some((bw) => bw.includes(qw) || qw.includes(bw)));

            let hasServiceOverlap = false;
            if (p.services && typeof p.services === 'object') {
              hasServiceOverlap = Object.keys(p.services).some((sKey) => {
                const sKeyWords = getSignificantWords(sKey.toLowerCase());
                return queryWords.some((qw) => sKeyWords.some((skw) => skw.includes(qw) || qw.includes(skw)));
              });
            }

            if (hasShopOverlap || hasBranchOverlap || hasServiceOverlap) {
              return true;
            }
          }

          return false;
        });

        if (localProviders.length > 0) {
          const userLat = locationCoords?.lat || pinnedCoords?.latitude || 33.6493;
          const userLng = locationCoords?.lng || pinnedCoords?.longitude || 72.9806;

          const getDistance = (lat1, lon1, lat2, lon2) => {
            if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
            const R = 6371;
            const dLat = ((lat2 - lat1) * Math.PI) / 180;
            const dLon = ((lon2 - lon1) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
          };

          const mapped = localProviders.map((p) => {
            let pLat = Number(p.latitude) || Number(p.locationCoords?.lat) || userLat;
            let pLng = Number(p.longitude) || Number(p.locationCoords?.lng) || userLng;
            const dist = getDistance(userLat, userLng, pLat, pLng);

            let estPrice = 1500;
            if (detectedCategory && p.services && typeof p.services === 'object') {
              const key = Object.keys(p.services).find((k) => k.toLowerCase().includes(detectedCategory.toLowerCase()));
              if (key) estPrice = Number(p.services[key].price) || Number(p.services[key].minPrice) || 1500;
            }

            return {
              ...p,
              name: p.shopName || p.name || "Verified Professional",
              address: p.shopAddress || p.address || "Islamabad, Pakistan",
              rating: Number(p.rating) || 4.8,
              userRatingsTotal: Number(p.userRatingsTotal) || 82,
              openNow: true,
              placeId: `reg_${p.uid || Math.random()}`,
              lat: pLat,
              lng: pLng,
              distanceValue: dist,
              distanceText: `${dist.toFixed(1)} km`,
              isRegistered: true,
              minPrice: Number(p.minPrice) || 1000,
              maxPrice: Number(p.maxPrice) || 5000,
              estimatedPrice: estPrice,
              shopName: p.shopName || "",
              branch: p.branch || "",
            };
          });

          mapped.sort((a, b) => a.distanceValue - b.distanceValue);
          const primary = mapped[0];

          let parsedTime;
          try {
            parsedTime = parseRelativeTimeToDate(queryLower);
            if (!parsedTime || typeof parsedTime !== 'object' || !parsedTime.time) {
              parsedTime = { time: 'Within 2 hours', clockTime: '2 hours' };
            }
          } catch (timeErr) {
            console.warn("Time parsing in fallback failed:", timeErr.message);
            parsedTime = { time: 'Within 2 hours', clockTime: '2 hours' };
          }

          addToast("Offline Resilient Fallback Active ⚡", 'info');

          const latencyMs = Date.now() - searchStartTime;

          const parsedLog = {
            id: `trace-parsed-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            icon: 'cpu',
            title: 'Intent Parsed (Offline Fallback)',
            status: 'PARSED',
            color: '#A855F7',
            description: `Extracted intent for category "${detectedCategory || "Custom Search"}" offline.`,
            payload: { query: queryLower, detectedCategory: detectedCategory || "Custom Search", latencyMs },
          };
          const geoLog = {
            id: `trace-geo-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            icon: 'map-pin',
            title: 'Offline Location Mapping',
            status: 'GEO-RESOLVED',
            color: '#10B981',
            description: `Using coordinates: Lat ${userLat}, Lng ${userLng}`,
            payload: { lat: userLat, lng: userLng, address: activeAddress?.address || currentAddress, latencyMs },
          };
          const matchedLog = {
            id: `trace-match-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            icon: 'activity',
            title: 'Offline Ranked Match',
            status: 'MATCHED',
            color: '#F59E0B',
            description: `Matched with nearest provider "${primary.name}" at distance ${primary.distanceText}.`,
            payload: { primaryProvider: primary, distance: primary.distanceValue, latencyMs },
          };
          setAgentTracingLogs((prev) => [matchedLog, geoLog, parsedLog, ...prev]);

          setSearchResult({
            intent: {
              service: detectedCategory || "Custom Search",
              notes: searchText || inputText || '',
              location: activeAddress?.address || currentAddress || "Your Pinned Location",
              city: primary.city || userProfile?.city || "Islamabad",
              area: primary.area || userProfile?.area || "G-13",
              time: parsedTime.time,
              clockTime: parsedTime.clockTime,
            },
            provider: primary,
            reasoning: `[Offline Fallback Active] Verified provider "${primary.name}" has been matched for your request. Located just ${primary.distanceText} away in ${primary.area || primary.city}, they have a rating of ${primary.rating} stars and flat Rs. ${primary.visitingCharges || 0} visiting charges.`,
            estimatedPrice: primary.estimatedPrice,
            negotiationRequired: false,
            allProviders: mapped,
            alternativeReasoning: {},
          });

          setNegotiationStep(false);
          setLoading(false);

          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        } else {
          setDialogConfig({
            title: 'Offline Mode: No Providers',
            message: `The server is offline, and we couldn't find any registered professionals locally for "${detectedCategory || "Custom Search"}" in your area.`,
            type: 'info',
          });
          setDialogVisible(true);
          setError(`Backend offline: ${err.message}`);
        }
      } catch (fallbackErr) {
        console.error("Fallback mode error:", fallbackErr.message, "Stack:", fallbackErr.stack);
        setDialogConfig({
          title: 'Offline Error',
          message: `Offline fallback failed: ${fallbackErr.message}. Please try again when connected.`,
          type: 'error',
        });
        setDialogVisible(true);
        setError(`Fallback error: ${fallbackErr.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const confirmBooking = async () => {
    setLoading(true);
    setError(null);
    fadeAnim.setValue(0);

    try {
      const response = await fetch(getBackendUrl('/api/book'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: searchResult.intent, provider: searchResult.provider }),
      });

      const data = await response.json();

      if (data.success) {
        const normalize = (str) => (str ? str.toLowerCase().trim().replace(/[\s-]/g, '') : '');
        const uniqueId = 'YAQ-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        await setDoc(doc(db, 'bookings', uniqueId), {
          userId: user.uid,
          customerName: user.displayName || (user.email ? user.email.split('@')[0] : 'Client'),
          service: searchResult.intent.service,
          notes: searchResult.intent.notes || '',
          location: searchResult.intent.location || 'Unknown Location',
          city: searchResult.intent.city || '',
          area: searchResult.intent.area || '',
          city_norm: normalize(searchResult.intent.city),
          area_norm: normalize(searchResult.intent.area),
          time:
            searchResult.provider.proposedTime ||
            searchResult.intent.time ||
            searchResult.intent.clockTime,
          providerName: searchResult.provider.name,
          providerAddress: searchResult.provider.address,
          providerPlaceId: searchResult.provider.placeId,
          status: 'Pending',
          isBroadcast: !searchResult.provider.placeId,
          targetProviderId: searchResult.provider.uid || null,
          providerID:
            searchResult.provider.providerID ||
            searchResult.provider.providerId ||
            (searchResult.provider.uid ? `PRO-${searchResult.provider.uid.substring(0, 4).toUpperCase()}` : null),
          price: (Number(searchResult.estimatedPrice) || 1500) + (Number(searchResult.provider.visitingCharges) || 0),
          visitingCharges: Number(searchResult.provider.visitingCharges) || 0,
          customerCoords: locationCoords || pinnedCoords || null,
          providerCoords: {
            lat: Number(searchResult.provider.lat || searchResult.provider.latitude) || 33.6493,
            lng: Number(searchResult.provider.lng || searchResult.provider.longitude) || 72.9806,
          },
          createdAt: Date.now(),
        });

        setSearchResult(null);
        setFinalBooking({
          id: data.success ? 'temporary-id' : null,
          service: searchResult.intent.service,
          providerName: searchResult.provider.name,
          time:
            searchResult.provider.proposedTime ||
            searchResult.intent.time ||
            searchResult.intent.clockTime,
          price: (Number(searchResult.estimatedPrice) || 1500) + (Number(searchResult.provider.visitingCharges) || 0),
        });

        addToast("Booking secure! AI Agent is monitoring...", 'success');

        const confirmedLog = {
          id: `trace-confirm-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          icon: 'check-circle',
          title: 'Booking Dispatched & Monitoring Active',
          status: 'CONFIRMED',
          color: '#EF4444',
          description: `Dispatched booking ${uniqueId} for "${searchResult.intent.service}" to "${searchResult.provider.name}".`,
          payload: {
            bookingId: uniqueId,
            service: searchResult.intent.service,
            provider: searchResult.provider.name,
            price: (Number(searchResult.estimatedPrice) || 1500) + (Number(searchResult.provider.visitingCharges) || 0),
            notes: searchResult.intent.notes || '',
          },
        };
        setAgentTracingLogs((prev) => [confirmedLog, ...prev]);
      } else {
        setError(data.error || 'An error occurred during booking.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShowReceipt = (booking) => {
    const normalized = {
      id: booking.id || `YQ-${Math.floor(Math.random() * 1000000)}`,
      providerName: booking.providerName || booking.provider?.name,
      providerID:
        booking.providerID ||
        booking.provider?.providerID ||
        (booking.providerId ? `PRO-${booking.providerId.substring(0, 4).toUpperCase()}` : 'N/A'),
      providerAddress: booking.providerAddress || booking.provider?.address,
      time: booking.time || booking.intent?.time,
      service: booking.service || booking.intent?.service,
      price: Number(booking.price) || 1500,
      visitingCharges: Number(booking.visitingCharges) || 0,
    };
    setReceiptData(normalized);
    setShowReceipt(true);
  };

  const confirmAction = (title, message, onConfirm) => {
    setDialogConfig({ title, message, type: 'confirm', onConfirm });
    setDialogVisible(true);
  };

  const handleCancelBooking = (bookingId) => {
    setHistoryLoading(true);
    const bookingRef = doc(db, 'bookings', bookingId);

    getDoc(bookingRef)
      .then((bookingSnap) => {
        setHistoryLoading(false);
        if (!bookingSnap.exists()) {
          addToast("Booking not found", 'error');
          return;
        }

        const bData = bookingSnap.data();
        const isUser = user && user.uid === bData.userId;

        if (isUser) {
          if (bData.status?.toUpperCase() === 'DISPATCHED') {
            notifyAction(
              "Cancellation Failed",
              "This service has already been dispatched. You cannot cancel a job that is en route."
            );
            return;
          }

          const bookingTime = parseBookingTime(bData.time, bData.createdAt);
          const msRemaining = bookingTime.getTime() - Date.now();
          const hoursRemaining = msRemaining / (1000 * 60 * 60);

          if (hoursRemaining > 0 && hoursRemaining <= 8) {
            notifyAction(
              "Cancellation Blocked",
              `Your booking is scheduled in ${hoursRemaining.toFixed(1)} hours. Cancellations are not allowed within 8 hours of the service time.`
            );
            return;
          }
        }

        setDialogConfig({
          title: "Cancel Booking",
          message: "Are you sure you want to cancel this appointment?",
          type: 'confirm',
          confirmText: 'Cancel Booking',
          cancelText: 'Go Back',
          onConfirm: async () => {
            setDialogVisible(false);
            setHistoryLoading(true);
            try {
              await updateDoc(bookingRef, { status: 'Cancelled' });
              const targetRecipient = user.uid === bData.userId ? bData.providerId : bData.userId;
              sendNotification(
                targetRecipient,
                "Booking Cancelled",
                `Booking cancelled by ${user.displayName || 'the other party'}.`,
                bookingId
              );
              addToast("Booking Cancelled", 'info');
            } catch (err) {
              notifyAction("Error", err.message);
            } finally {
              setHistoryLoading(false);
            }
          },
        });
        setDialogVisible(true);
      })
      .catch((err) => {
        setHistoryLoading(false);
        addToast(err.message, 'error');
      });
  };

  return (
    <AppContext.Provider
      value={{
        fontsLoaded,
        user,
        setUser,
        isLoginMode,
        setIsLoginMode,
        fadeAnim,
        isLoggingInRef,
        pendingEmailRef,
        tempPasswordRef,
        chatScrollView,
        logoScale,
        logoOpacity,
        slideAnim,
        slideOpacity,
        splashOpacity,
        showSplash,
        setShowSplash,
        name,
        setName,
        email,
        setEmail,
        password,
        setPassword,
        currentTab,
        setCurrentTab,
        inputText,
        setInputText,
        serviceMode,
        setServiceMode,
        useLocation,
        setUseLocation,
        locationCoords,
        setLocationCoords,
        currentAddress,
        setCurrentAddress,
        loading,
        setLoading,
        searchResult,
        setSearchResult,
        finalBooking,
        setFinalBooking,
        searchContext,
        setSearchContext,
        typoSuggestion,
        setTypoSuggestion,
        originalTypoWord,
        setOriginalTypoWord,
        error,
        setError,
        success,
        setSuccess,
        bookings,
        setBookings,
        availableJobs,
        setAvailableJobs,
        myProviderJobs,
        setMyProviderJobs,
        allRegisteredProviders,
        setAllRegisteredProviders,
        historyFilter,
        setHistoryFilter,
        historyLoading,
        setHistoryLoading,
        pendingEmail,
        setPendingEmail,
        isConnected,
        setIsConnected,
        isCheckingConnection,
        setIsCheckingConnection,
        showTracingModal,
        setShowTracingModal,
        agentTracingLogs,
        setAgentTracingLogs,
        isDarkMode,
        setIsDarkMode,
        COLORS,
        styles,
        profileActiveTab,
        setProfileActiveTab,
        userProfile,
        setUserProfile,
        isProviderMode,
        setIsProviderMode,
        dialogVisible,
        setDialogVisible,
        dialogConfig,
        setDialogConfig,
        showNotifications,
        setShowNotifications,
        showDatePicker,
        setShowDatePicker,
        showReceipt,
        setShowReceipt,
        receiptData,
        setReceiptData,
        isVerifying,
        setIsVerifying,
        showEmailVerifiedBadge,
        setShowEmailVerifiedBadge,
        isEmailVerified,
        setIsEmailVerified,
        showOnboarding,
        setShowOnboarding,
        refreshing,
        setRefreshing,
        showLocationSheet,
        setShowLocationSheet,
        sheetAnim,
        savedAddresses,
        setSavedAddresses,
        activeAddress,
        setActiveAddress,
        locationStep,
        setLocationStep,
        pinnedCoords,
        setPinnedCoords,
        mapRegion,
        setMapRegion,
        entranceCoords,
        setEntranceCoords,
        addressForm,
        setAddressForm,
        searchText,
        setSearchText,
        isSearching,
        setIsSearching,
        editingAddressId,
        setEditingAddressId,
        imageUri,
        setImageUri,
        imageBase64,
        setImageBase64,
        notificationsList,
        setNotificationsList,
        showNotificationsDrawer,
        setShowNotificationsDrawer,
        isChatContextMode,
        setIsChatContextMode,
        chatMessages,
        setChatMessages,
        activeChatBooking,
        setActiveChatBooking,
        routingModalVisible,
        setRoutingModalVisible,
        selectedRoutingJob,
        setSelectedRoutingJob,
        providerRouteCoords,
        setProviderRouteCoords,
        providerDistance,
        setProviderDistance,
        providerDuration,
        setProviderDuration,
        isProviderRouteLoading,
        setIsProviderRouteLoading,
        clientRouteCoords,
        setClientRouteCoords,
        clientDistance,
        setClientDistance,
        clientDuration,
        setClientDuration,
        isClientRouteLoading,
        setIsClientRouteLoading,
        manualChatMessages,
        setManualChatMessages,
        chatInputText,
        setChatInputText,
        isPriceOfferModalVisible,
        setPriceOfferModalVisible,
        isTimeOfferModalVisible,
        setTimeOfferModalVisible,
        negotiationPriceInput,
        setNegotiationPriceInput,
        negotiationTimeInput,
        setNegotiationTimeInput,
        counteringMessageId,
        setCounteringMessageId,
        negotiationTimeAmPm,
        setNegotiationTimeAmPm,
        isCustomerActiveBookingsExpanded,
        setCustomerActiveBookingsExpanded,
        isProviderBroadcastsExpanded,
        setProviderBroadcastsExpanded,
        isUpcomingJobsExpanded,
        setUpcomingJobsExpanded,
        isPastJobsExpanded,
        setPastJobsExpanded,
        isProviderAssignedExpanded,
        setProviderAssignedExpanded,
        historySortOrder,
        setHistorySortOrder,
        checkConnection,
        onRefresh,
        searchGeocodeAddress,
        handleReverseGeocode,
        useCurrentGPSLocation,
        saveAddress,
        deleteAddress,
        editAddressStart,
        registerForPushNotificationsAsync,
        markAllNotificationsAsRead,
        clearAllNotifications,
        handleNotificationClick,
        sendNotification,
        handleLogout,
        handleLocationToggle,
        handleAcceptJob,
        handleOfferPrice,
        handleOfferTime,
        submitInlinePriceOffer,
        submitInlineTimeOffer,
        handleAcceptInlinePriceOffer,
        handleDeclineInlinePriceOffer,
        handleAcceptInlineTimeOffer,
        handleDeclineInlineTimeOffer,
        handleCancelJobFromOffer,
        handleSendMessage,
        handleNegotiateManually,
        pickImage,
        submitSearch,
        submitSearchWithText,
        confirmBooking,
        handleShowReceipt,
        confirmAction,
        notifyAction,
        handleCancelBooking,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
