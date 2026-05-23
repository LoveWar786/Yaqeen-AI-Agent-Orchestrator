import React, { useRef } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, PanResponder, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { collection, query, where, getDocs, updateDoc, deleteDoc, getDoc, doc, addDoc } from 'firebase/firestore';

function SwipeableNotificationItem({
  notif,
  onDismiss,
  onClick,
  COLORS,
  formatDate,
  isDarkMode,
}) {
  const pan = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dx > 10 && Math.abs(gestureState.dy) < 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          pan.setValue({ x: gestureState.dx, y: 0 });
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 120) {
          Animated.parallel([
            Animated.timing(pan, {
              toValue: { x: 500, y: 0 },
              duration: 250,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 250,
              useNativeDriver: true,
            })
          ]).start(() => {
            onDismiss(notif.id);
          });
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        transform: pan.getTranslateTransform(),
        opacity: opacity,
      }}
    >
      <TouchableOpacity
        style={{
          backgroundColor: notif.read ? 'rgba(0,0,0,0.02)' : COLORS.primary + '08',
          borderRadius: 12,
          padding: 12,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: notif.read ? COLORS.border : COLORS.primary + '40',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
        }}
        onPress={() => onClick(notif)}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: notif.read ? 'transparent' : COLORS.primary,
            marginTop: 6,
          }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.textPrimary }}>{notif.title}</Text>
          <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>{notif.body}</Text>
          <Text style={{ fontSize: 9, color: COLORS.textSecondary, marginTop: 6, fontWeight: '700' }}>
            {formatDate(notif.createdAt)}
          </Text>
        </View>
        <Feather name="chevron-right" size={14} color={COLORS.textSecondary} style={{ alignSelf: 'center' }} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function NotificationsDrawer({
  visible,
  onClose,
  notificationsList,
  user,
  db,
  isDarkMode,
  COLORS,
  styles,
  addToast,
  setActiveChatBooking,
  setIsChatContextMode,
}) {
  // ── Handlers ──────────────────────────────────────────────────────────────

  const markAllAsRead = async () => {
    try {
      const q = query(
        collection(db, 'users', user.uid, 'notifications'),
        where('read', '==', false)
      );
      const snapshot = await getDocs(q);
      await Promise.all(snapshot.docs.map((d) => updateDoc(d.ref, { read: true })));
      addToast('All notifications marked as read', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const clearAll = async () => {
    try {
      const q = query(collection(db, 'users', user.uid, 'notifications'));
      const snapshot = await getDocs(q);
      await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
      addToast('Notification log cleared', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDismiss = async (notifId) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'notifications', notifId));
      addToast('Notification dismissed', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.read) {
        await updateDoc(doc(db, 'users', user.uid, 'notifications', notif.id), { read: true });
      }
      onClose();

      if (notif.bookingId) {
        const bookingSnap = await getDoc(doc(db, 'bookings', notif.bookingId));
        if (bookingSnap.exists()) {
          const bookingData = { id: bookingSnap.id, ...bookingSnap.data() };
          setActiveChatBooking(bookingData);
          setIsChatContextMode(true);
          addToast(`Opening Chat for: ${bookingData.serviceTitle || 'Booking'}`, 'success');
        } else {
          addToast('Booking details could not be found.', 'error');
        }
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const formatDate = (createdAt) => {
    if (!createdAt) return 'Just now';
    try {
      const dateObj =
        typeof createdAt.toDate === 'function' ? createdAt.toDate() : new Date(createdAt);
      return isNaN(dateObj.getTime()) ? 'Just now' : dateObj.toLocaleString();
    } catch {
      return 'Just now';
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalCard,
            { width: '95%', maxWidth: 450, height: '70%', maxHeight: 600, borderRadius: 24, padding: 20 },
          ]}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="bell" size={22} color={COLORS.primary} />
              <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.textPrimary }}>Notifications</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Feather name="x" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Quick actions */}
          {notificationsList && notificationsList.length > 0 && (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 14,
                borderBottomWidth: 1,
                borderBottomColor: COLORS.border,
                paddingBottom: 10,
              }}
            >
              <TouchableOpacity
                onPress={markAllAsRead}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Feather name="check-square" size={14} color={COLORS.primary} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.primary }}>Mark all as read</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={clearAll} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="trash-2" size={14} color={COLORS.danger} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.danger }}>Clear all</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* List */}
          <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={{ 
              flexGrow: 1, 
              justifyContent: (!notificationsList || notificationsList.length === 0) ? 'center' : 'flex-start' 
            }} 
            showsVerticalScrollIndicator={false}
          >
            {!notificationsList || notificationsList.length === 0 ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: 20 }}>
                <Feather name="bell-off" size={48} color={COLORS.border} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.textSecondary, marginTop: 12 }}>
                  All caught up!
                </Text>
                <Text style={{ fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginTop: 4 }}>
                  No notifications found in your account.
                </Text>
              </View>
            ) : (
              notificationsList.map((notif) => (
                <SwipeableNotificationItem
                  key={notif.id}
                  notif={notif}
                  onDismiss={handleDismiss}
                  onClick={handleNotificationClick}
                  COLORS={COLORS}
                  formatDate={formatDate}
                  isDarkMode={isDarkMode}
                />
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
