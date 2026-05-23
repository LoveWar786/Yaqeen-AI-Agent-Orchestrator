import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import YaqeenLogo from './YaqeenLogo';
import RoleRestrictedSwitch from './RoleRestrictedSwitch';

/**
 * TopHeader — app-wide navigation bar.
 *
 * Props:
 *  currentTab, user, isDarkMode, COLORS, styles, db,
 *  isProviderMode, setIsProviderMode,
 *  notificationsList, onBellPress, onThemeToggle, onLogout, addToast
 */
export default function TopHeader({
  currentTab,
  user,
  userProfile,
  isDarkMode,
  COLORS,
  styles,
  db,
  isProviderMode,
  setIsProviderMode,
  notificationsList,
  onBellPress,
  onThemeToggle,
  onLogout,
  addToast,
}) {
  const unreadCount = (notificationsList || []).filter((n) => !n.read).length;

  const tabLabel = currentTab === 'home'
    ? 'Yaqeen'
    : currentTab === 'history'
    ? 'History'
    : currentTab === 'services'
    ? 'Services'
    : 'Account';

  return (
    <View style={[styles.header, { backgroundColor: COLORS.nav, borderBottomColor: COLORS.border }]}>
      {/* Left: Logo + Title */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <YaqeenLogo size={36} isDarkMode={isDarkMode} />
        <View style={{ marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: COLORS.textPrimary }]}>{tabLabel}</Text>
          <Text style={[styles.headerSubtitle, { color: COLORS.textSecondary }]}>
            Hi, {userProfile?.name || user?.displayName || 'User'}
          </Text>
        </View>
      </View>

      {/* Right: controls */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {/* Provider / Customer mode toggle (only for providers) */}
        {user && (
          <RoleRestrictedSwitch
            user={user}
            db={db}
            isProviderMode={isProviderMode}
            setIsProviderMode={setIsProviderMode}
            addToast={addToast}
            COLORS={COLORS}
            isDarkMode={isDarkMode}
          />
        )}

        {/* Bell icon with unread badge */}
        {user && (
          <TouchableOpacity
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              borderWidth: 1,
              borderColor: COLORS.border,
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
            }}
            onPress={onBellPress}
          >
            <Feather name="bell" size={16} color={COLORS.textPrimary} />
            {unreadCount > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  backgroundColor: COLORS.danger,
                  borderRadius: 8,
                  minWidth: 16,
                  height: 16,
                  paddingHorizontal: 4,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Theme toggle */}
        <TouchableOpacity
          style={[
            styles.logoutBtn,
            {
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              borderColor: COLORS.border,
            },
          ]}
          onPress={onThemeToggle}
        >
          <Feather name={isDarkMode ? 'sun' : 'moon'} size={16} color={COLORS.textPrimary} />
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity
          style={[
            styles.logoutBtn,
            {
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              borderColor: COLORS.border,
            },
          ]}
          onPress={onLogout}
        >
          <Text style={[styles.logoutText, { color: COLORS.textPrimary }]}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
