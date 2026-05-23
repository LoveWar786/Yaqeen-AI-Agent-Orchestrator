module.exports = {
  expo: {
    name: "Yaqeen | AI Agent Orchestrator",
    slug: "mobile-app",
    version: "2.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0D0D0D"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.yaqeen.app",
      infoPlist: {
        NSMicrophoneUsageDescription: "Yaqeen requires microphone access to transcribe your voice searches for professional services."
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#A855F7"
      },
      package: "com.yaqeen.app",
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "AIzaSyBcCiLdBqI4pqX9ji_8Yr-pFFo9mqPrgmk"
        }
      },
      permissions: [
        "RECORD_AUDIO",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "RECEIVE_BOOT_COMPLETED",
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION"
      ],
      edgeToEdgeEnabled: true
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-notifications",
      "expo-audio",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow Yaqeen to access your location to match you with nearby service providers."
        }
      ],
      "expo-font",
      "expo-asset"
    ],
    extra: {
      eas: {
        projectId: "fc31ffba-eb45-407e-a138-85eb6d7201e0"
      }
    }
  }
};
