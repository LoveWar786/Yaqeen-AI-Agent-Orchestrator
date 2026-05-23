import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, browserLocalPersistence, GoogleAuthProvider, browserPopupRedirectResolver } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with platform-specific persistence to prevent crashes
let auth;
try {
  auth = initializeAuth(app, {
    persistence: Platform.OS === 'web' 
      ? browserLocalPersistence 
      : getReactNativePersistence(ReactNativeAsyncStorage),
    popupRedirectResolver: Platform.OS === 'web' ? browserPopupRedirectResolver : undefined
  });
} catch (e) {
  console.warn("Firebase initializeAuth failed, falling back to getAuth:", e);
  const { getAuth } = require('firebase/auth');
  auth = getAuth(app);
}

// Initialize Firestore
const db = getFirestore(app);

export { auth, db, GoogleAuthProvider };
