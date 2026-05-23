import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View, StyleSheet } from 'react-native';

export default function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
  COLORS = {
    primary: '#6B21A8',
    textPrimary: '#FFFFFF',
    textSecondary: '#94A3B8',
    border: '#2E2E2E',
    danger: '#EF4444',
  },
}) {
  const getButtonStyles = () => {
    switch (variant) {
      case 'secondary':
        return [styles.button, styles.secondary, { backgroundColor: '#222' }, style];
      case 'danger':
        return [styles.button, styles.danger, { backgroundColor: COLORS.danger }, style];
      case 'outline':
        return [
          styles.button,
          styles.outline,
          { backgroundColor: 'transparent', borderColor: COLORS.border, borderWidth: 1 },
          style,
        ];
      case 'primary':
      default:
        return [styles.button, styles.primary, { backgroundColor: COLORS.primary }, style];
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'outline':
        return [styles.buttonText, { color: COLORS.primary }, textStyle];
      case 'secondary':
        return [styles.buttonText, { color: '#E2E8F0' }, textStyle];
      case 'primary':
      case 'danger':
      default:
        return [styles.buttonText, { color: '#FFFFFF' }, textStyle];
    }
  };

  return (
    <TouchableOpacity
      style={[getButtonStyles(), (disabled || loading) && styles.disabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'outline' ? COLORS.primary : '#FFFFFF'} />
      ) : (
        <View style={styles.contentContainer}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          {title && <Text style={getTextStyle()}>{title}</Text>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    flexDirection: 'row',
  },
  primary: {
    shadowColor: '#6B21A8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  secondary: {},
  danger: {},
  outline: {},
  disabled: {
    opacity: 0.5,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
