import React from 'react';
import { View, Text, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useToast } from '../services/ToastContext';
import { THEMES, getShadow } from '../theme/index';

export default function ToastContainer({ isDarkMode = true }) {
  const { toasts } = useToast();
  const COLORS = isDarkMode ? THEMES.dark : THEMES.light;

  if (toasts.length === 0) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: Platform.OS === 'web' ? 76 : Platform.OS === 'ios' ? 108 : 92,
        left: 20,
        right: 20,
        zIndex: 100000,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <View
          key={toast.id}
          style={{
            backgroundColor:
              toast.type === 'success'
                ? COLORS.success
                : toast.type === 'error'
                ? COLORS.danger
                : COLORS.card,
            padding: 12,
            borderRadius: 12,
            marginBottom: 8,
            flexDirection: 'row',
            alignItems: 'center',
            ...getShadow('#000', 0, 4, 0.1, 8, 5),
            borderWidth: 1,
            borderColor:
              toast.type === 'success'
                ? COLORS.success
                : toast.type === 'error'
                ? COLORS.danger
                : COLORS.border,
          }}
        >
          <Feather
            name={
              toast.type === 'success'
                ? 'check-circle'
                : toast.type === 'error'
                ? 'alert-circle'
                : 'info'
            }
            size={16}
            color={
              toast.type === 'success' || toast.type === 'error'
                ? '#fff'
                : COLORS.primary
            }
          />
          <Text
            style={{
              marginLeft: 10,
              color:
                toast.type === 'success' || toast.type === 'error'
                  ? '#fff'
                  : COLORS.textPrimary,
              fontWeight: '600',
              fontSize: 13,
            }}
          >
            {toast.message}
          </Text>
        </View>
      ))}
    </View>
  );
}
