import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Returns the base URL for the backend API server.
 * Default is the production Vercel URL, with dynamic override support.
 */
export const getBackendUrl = (path = '') => {
  // 1. Check for dynamic custom backend override (AsyncStorage loaded at startup)
  if (global.customBackendUrl) {
    const baseUrl = global.customBackendUrl.endsWith('/') 
      ? global.customBackendUrl.slice(0, -1) 
      : global.customBackendUrl;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
  }

  // 2. Default to production Vercel URL in standalone builds / release builds
  if (!__DEV__) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `https://yaqeen-backend-vercel.vercel.app${cleanPath}`;
  }

  // 3. Dev Mode: Use local IP/host if inside Expo Go, or default to production Vercel
  let host = '127.0.0.1';
  if (Constants?.expoConfig?.hostUri) {
    host = Constants.expoConfig.hostUri.split(':')[0];
  } else if (Platform.OS === 'android') {
    host = '10.0.2.2';
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  if (host && host !== '127.0.0.1' && host !== 'localhost') {
    return `http://${host}:4000${cleanPath}`;
  }

  return `https://yaqeen-backend-vercel.vercel.app${cleanPath}`;
};
