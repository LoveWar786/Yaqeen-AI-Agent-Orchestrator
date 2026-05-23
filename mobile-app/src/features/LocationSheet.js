import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Animated, Platform, ActivityIndicator, StyleSheet
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import ConfirmationModel from './ConfirmationModel';

/**
 * LocationSheet — full-featured bottom sheet for managing saved addresses.
 *
 * Props: visible, onClose, user, db, activeAddress, setActiveAddress,
 *        isDarkMode, COLORS, styles, addToast, getBackendUrl, MapView, Marker, darkMapStyle
 */
export default function LocationSheet({
  visible, onClose, user, db,
  activeAddress, setActiveAddress,
  isDarkMode, COLORS, styles, addToast, getBackendUrl,
  MapView, Marker, darkMapStyle,
}) {
  // ── Internal state ─────────────────────────────────────────────────────────
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [locationStep, setLocationStep] = useState('list');
  const [pinnedCoords, setPinnedCoords] = useState({ latitude: 33.6844, longitude: 73.0479 });
  const [mapRegion, setMapRegion] = useState({ latitude: 33.6844, longitude: 73.0479, latitudeDelta: 0.015, longitudeDelta: 0.015 });
  const [entranceCoords, setEntranceCoords] = useState(null);
  const [addressForm, setAddressForm] = useState({ street: '', floor: '', instructions: '', altPhone: '', label: 'HOME', customLabel: '' });
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ title: '', message: '', type: 'confirm', onConfirm: null });
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const geocodeTimeoutRef = useRef(null);
  const mapRef = useRef(null);

  const animateMapTo = (coords, latitudeDelta = 0.005, longitudeDelta = 0.005) => {
    const region = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta,
      longitudeDelta
    };
    setMapRegion(region);
    if (mapRef.current && typeof mapRef.current.animateToRegion === 'function') {
      mapRef.current.animateToRegion(region, 400);
    }
  };

  // ── Firestore address listener ─────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setSavedAddresses([]); return; }
    const addrRef = collection(db, 'users', user.uid, 'addresses');
    const unsub = onSnapshot(addrRef, (qs) => {
      const list = [];
      qs.forEach(d => list.push({ id: d.id, ...d.data() }));
      setSavedAddresses(list);
    }, (err) => console.warn('Addresses listener failed:', err.message));
    return () => unsub();
  }, [user]);

  // ── Animation ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setLocationStep('list');
      setEditingAddressId(null);
      setSearchText('');
      setEntranceCoords(null);
      setAddressForm({ street: '', floor: '', instructions: '', altPhone: '', label: 'HOME', customLabel: '' });
      Animated.spring(sheetAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: Platform.OS !== 'web' }).start();
    } else {
      Animated.timing(sheetAnim, { toValue: 0, duration: 250, useNativeDriver: Platform.OS !== 'web' }).start();
    }
  }, [visible]);

  const closeSheet = () => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 250, useNativeDriver: Platform.OS !== 'web' }).start(() => onClose());
  };

  // ── Geo helpers ────────────────────────────────────────────────────────────
  const reverseGeocode = async (coords) => {
    try {
      const res = await fetch(getBackendUrl('/api/geocode'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationCoords: { lat: coords.latitude, lng: coords.longitude } }),
      });
      const data = await res.json();
      if (res.ok && data.address) return data.address;
    } catch (e) { console.warn('Reverse geocode failed:', e); }
    return `Pinned (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`;
  };

  const searchGeocodeAddress = async () => {
    if (!searchText.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(getBackendUrl('/api/forward-geocode'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: searchText.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.lat && data.lng) {
        const coords = { latitude: data.lat, longitude: data.lng };
        setPinnedCoords(coords);
        animateMapTo(coords, 0.008, 0.008);
        addToast('Location loaded on Map!', 'success');
      } else {
        addToast(data.error || 'Location not found.', 'error');
      }
    } catch (err) { addToast('Failed to search location.', 'error'); }
    finally { setIsSearching(false); }
  };

  const useCurrentGPSLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { addToast('Location permission denied', 'error'); return; }
      // Use balanced accuracy for fast 1-2 second cell/wifi location lock
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      setPinnedCoords(coords);
      animateMapTo(coords, 0.005, 0.005);
      const formatted = await reverseGeocode(coords);
      setSearchText(formatted);
      addToast('GPS Location Acquired', 'success');
      if (locationStep === 'list') setLocationStep('map');
    } catch (e) { addToast('Failed to acquire GPS location', 'error'); }
  };

  // ── Firestore CRUD ─────────────────────────────────────────────────────────
  const saveAddress = async () => {
    if (!user) { addToast('Please sign in to save addresses', 'error'); return; }
    const activeLabel = addressForm.label === 'OTHER' ? (addressForm.customLabel.trim() || 'OTHER') : addressForm.label;
    try {
      const finalAddress = searchText.trim() || await reverseGeocode(pinnedCoords);
      const addressData = {
        label: activeLabel,
        address: finalAddress,
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

      // Check if label already exists on other physically DIFFERENT addresses (case-insensitive)
      const duplicates = (activeLabel && activeLabel !== 'OTHER') ? savedAddresses.filter(
        (addr) => {
          if (!addr.label || addr.label.toUpperCase() !== activeLabel.toUpperCase() || addr.id === editingAddressId) {
            return false;
          }
          // Check physical similarity (same address or coordinates are virtually identical)
          const isSameAddress = 
            (addr.address?.trim().toLowerCase() === finalAddress?.trim().toLowerCase()) ||
            (Math.abs(addr.latitude - pinnedCoords.latitude) < 0.0001 && Math.abs(addr.longitude - pinnedCoords.longitude) < 0.0001);
          return !isSameAddress;
        }
      ) : [];

      if (duplicates.length > 0) {
        for (const dup of duplicates) {
          const dupRef = doc(db, 'users', user.uid, 'addresses', dup.id);
          await updateDoc(dupRef, { label: '', updatedAt: Date.now() });
        }
      }

      const addrRef = collection(db, 'users', user.uid, 'addresses');
      if (editingAddressId) {
        await updateDoc(doc(db, 'users', user.uid, 'addresses', editingAddressId), addressData);
        addToast('Address updated!', 'success');
      } else {
        addressData.createdAt = Date.now();
        const newDoc = await addDoc(addrRef, addressData);
        setEditingAddressId(newDoc.id); // Prevents duplicate check race condition during transition
        setActiveAddress({ id: newDoc.id, ...addressData });
        addToast('Address saved!', 'success');
      }
      closeSheet();
    } catch (e) { addToast('Failed to save address', 'error'); }
  };

  const deleteAddress = async (addressId) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'addresses', addressId));
      addToast('Address deleted', 'success');
      if (activeAddress && activeAddress.id === addressId) setActiveAddress(null);
    } catch (e) { addToast('Failed to delete address', 'error'); }
  };

  const editAddressStart = (item) => {
    setEditingAddressId(item.id);
    const itemCoords = { latitude: item.latitude, longitude: item.longitude };
    setPinnedCoords(itemCoords);
    animateMapTo(itemCoords, 0.008, 0.008);
    setEntranceCoords({ latitude: item.entranceLatitude, longitude: item.entranceLongitude });
    const standardLabels = ['HOME', 'OFFICE', 'PARTNER'];
    const isStandard = standardLabels.includes(item.label);
    setAddressForm({
      street: item.street || '', floor: item.floor || '', instructions: item.instructions || '',
      altPhone: item.altPhone || '', label: isStandard ? item.label : 'OTHER', customLabel: isStandard ? '' : item.label,
    });
    setSearchText(item.address);
    setLocationStep('map');
  };

  const getIconName = (label) => {
    const l = String(label).toUpperCase();
    if (l === 'HOME') return 'home';
    if (l === 'OFFICE') return 'briefcase';
    if (l === 'PARTNER') return 'users';
    return 'map-pin';
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!visible) return null;

  return (
    <View style={styles.bottomSheetContainer}>
      <TouchableOpacity style={{ ...StyleSheet.absoluteFillObject }} activeOpacity={1} onPress={closeSheet} />
      <Animated.View
        style={[
          styles.bottomSheet,
          { transform: [{ translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) }] },
        ]}
      >
        {/* ── Step 1: List ─────────────────────────────────────────── */}
        {locationStep === 'list' && (
          <View style={{ flex: 1 }}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Address</Text>
              <TouchableOpacity onPress={closeSheet}><Feather name="x" size={20} color={COLORS.textPrimary} /></TouchableOpacity>
            </View>

            <View style={styles.countryBadge}>
              <View style={styles.countryInfo}>
                <Feather name="globe" size={16} color={COLORS.primary} />
                <Text style={styles.countryText}>🇵🇰 Pakistan</Text>
              </View>
              <TouchableOpacity disabled><Text style={[styles.countryChangeBtn, { opacity: 0.5 }]}>CHANGE</Text></TouchableOpacity>
            </View>

            <View style={styles.sheetActionRow}>
              <TouchableOpacity style={styles.sheetActionButton} onPress={useCurrentGPSLocation}>
                <Feather name="navigation" size={16} color={COLORS.primary} />
                <Text style={styles.sheetActionButtonText}>Use current location</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetActionButton} onPress={() => setLocationStep('map')}>
                <Feather name="plus" size={16} color={COLORS.primary} />
                <Text style={styles.sheetActionButtonText}>Add new address</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.sheetSubtitle, { fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Saved Addresses</Text>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
              {savedAddresses.length > 0 ? (
                savedAddresses.map((item) => (
                  <TouchableOpacity key={item.id} style={styles.addressItem} onPress={() => { setActiveAddress(item); closeSheet(); }}>
                    <View style={styles.addressItemLeft}>
                      <View style={styles.addressIconWrapper}>
                        <Feather name={getIconName(item.label)} size={16} color={COLORS.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.addressItemLabel}>{item.label || 'Saved Address'}</Text>
                        <Text style={styles.addressItemText} numberOfLines={2}>
                          {item.address}{item.street ? `, ${item.street}` : ''}{item.floor ? `, Flr ${item.floor}` : ''}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.addressActions}>
                      <TouchableOpacity onPress={() => editAddressStart(item)} style={{ padding: 6 }}>
                        <Feather name="edit-2" size={14} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setConfirmConfig({
                            title: 'Delete Address',
                            message: `Are you sure you want to delete the address labeled "${item.label}"?`,
                            type: 'confirm',
                            confirmText: 'Delete',
                            cancelText: 'Cancel',
                            onConfirm: async () => {
                              setConfirmVisible(false);
                              await deleteAddress(item.id);
                            }
                          });
                          setConfirmVisible(true);
                        }}
                        style={{ padding: 6 }}
                      >
                        <Feather name="trash-2" size={14} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <Feather name="map" size={32} color={COLORS.textSecondary} style={{ marginBottom: 12 }} />
                  <Text style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' }}>No saved addresses. Add one above!</Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {/* ── Steps 2 & 3: Map Pin & Entrance (Shared MapView to eliminate unmount/remount lags) ── */}
        {(locationStep === 'map' || locationStep === 'entrance') && (
          <View style={{ flex: 1 }}>
            <View style={styles.sheetHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => setLocationStep(locationStep === 'entrance' ? 'map' : 'list')}>
                  <Feather name="arrow-left" size={20} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.sheetTitle}>
                  {locationStep === 'entrance' ? 'Mark Entrance Pin' : (editingAddressId ? 'Edit Address' : 'Pin Address')}
                </Text>
              </View>
              <TouchableOpacity onPress={closeSheet}><Feather name="x" size={20} color={COLORS.textPrimary} /></TouchableOpacity>
            </View>

            {locationStep === 'map' ? (
              <View style={styles.mapSearchWrapper}>
                <Feather name="search" size={16} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.mapSearchInput}
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Enter your address"
                  placeholderTextColor={COLORS.textSecondary + '88'}
                  onSubmitEditing={searchGeocodeAddress}
                />
                {isSearching ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <TouchableOpacity onPress={searchGeocodeAddress} style={{ padding: 6 }}>
                    <Feather name="arrow-right" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <Text style={[styles.sheetSubtitle, { marginBottom: 12 }]}>Place the marker at your building entrance for the provider.</Text>
            )}

            <View style={styles.mapContainer}>
              <MapView
                ref={mapRef}
                style={{ flex: 1 }}
                initialRegion={mapRegion}
                onRegionChangeComplete={(r) => {
                  const coords = { latitude: r.latitude, longitude: r.longitude };
                  setMapRegion(r);
                  if (locationStep === 'map') {
                    setPinnedCoords(coords);
                    if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
                    geocodeTimeoutRef.current = setTimeout(async () => {
                      const addr = await reverseGeocode(coords);
                      setSearchText(addr);
                    }, 600);
                  } else {
                    setEntranceCoords(coords);
                  }
                }}
                customMapStyle={isDarkMode ? darkMapStyle : []}
              />
              <View style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -16, marginTop: -32, justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
                {locationStep === 'entrance' ? (
                  <View style={{ alignItems: 'center' }}>
                    <Feather name="arrow-down-circle" size={32} color={COLORS.success} />
                    <View style={{ backgroundColor: COLORS.success, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 }}>
                      <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800' }}>ENTRANCE</Text>
                    </View>
                  </View>
                ) : (
                  <Feather name="map-pin" size={32} color={COLORS.primary} />
                )}
              </View>
              {locationStep === 'map' ? (
                <TouchableOpacity style={styles.mapFloatingBtn} onPress={useCurrentGPSLocation}>
                  <Feather name="crosshair" size={18} color={COLORS.primary} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.mapFloatingBtn} onPress={() => { setEntranceCoords(pinnedCoords); animateMapTo(pinnedCoords, 0.001, 0.001); }}>
                  <Feather name="refresh-cw" size={16} color={COLORS.primary} />
                </TouchableOpacity>
              )}
            </View>

            {locationStep === 'map' ? (
              <>
                <Text style={styles.addressNote}>Your service provider will arrive at the pinned location.</Text>
                <TouchableOpacity
                  style={[styles.button, { marginTop: 'auto' }]}
                  onPress={() => {
                    animateMapTo(pinnedCoords, 0.001, 0.001);
                    setEntranceCoords(pinnedCoords);
                    setLocationStep('entrance');
                  }}
                >
                  <Text style={styles.buttonText}>Add Address Details</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={[styles.button, { marginTop: 'auto' }]} onPress={() => setLocationStep('details')}>
                <Text style={styles.buttonText}>Confirm Entrance</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Step 4: Details Form ──────────────────────────────────── */}
        {locationStep === 'details' && (
          <View style={{ flex: 1 }}>
            <View style={styles.sheetHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => { animateMapTo(pinnedCoords, 0.001, 0.001); setLocationStep('entrance'); }}>
                  <Feather name="arrow-left" size={20} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.sheetTitle}>Address Details</Text>
              </View>
              <TouchableOpacity onPress={closeSheet}><Feather name="x" size={20} color={COLORS.textPrimary} /></TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={[styles.inputLabel, { marginTop: 0 }]}>Street / House / Building Name (Optional)</Text>
              <View style={styles.formInputWrapper}>
                <TextInput style={styles.formTextInput} value={addressForm.street} onChangeText={(val) => setAddressForm(p => ({ ...p, street: val }))} placeholder="e.g., Street 4, House 25" placeholderTextColor={COLORS.textSecondary + '66'} />
              </View>

              <Text style={styles.inputLabel}>Floor / Apartment Number (Optional)</Text>
              <View style={styles.formInputWrapper}>
                <TextInput style={styles.formTextInput} value={addressForm.floor} onChangeText={(val) => setAddressForm(p => ({ ...p, floor: val }))} placeholder="e.g., 2nd Floor, Appt 3B" placeholderTextColor={COLORS.textSecondary + '66'} />
              </View>

              <Text style={styles.inputLabel}>Instructions (Optional)</Text>
              <View style={[styles.formInputWrapper, { height: 80, paddingVertical: 10 }]}>
                <TextInput style={[styles.formTextInput, { height: '100%', textAlignVertical: 'top' }]} value={addressForm.instructions} onChangeText={(val) => setAddressForm(p => ({ ...p, instructions: val }))} placeholder="e.g., Ring bell twice" placeholderTextColor={COLORS.textSecondary + '66'} multiline />
              </View>

              <Text style={[styles.inputLabel, { marginBottom: 10 }]}>Save Address As</Text>
              <View style={styles.labelRow}>
                {[{ key: 'HOME', icon: 'home', text: 'HOME' }, { key: 'OFFICE', icon: 'briefcase', text: 'OFFICE' }, { key: 'PARTNER', icon: 'users', text: 'PARTNER' }, { key: 'OTHER', icon: 'map-pin', text: 'OTHER' }].map((badge) => (
                  <TouchableOpacity
                    key={badge.key}
                    style={[styles.labelBadge, addressForm.label === badge.key && styles.labelBadgeActive]}
                    onPress={() => setAddressForm(p => ({ ...p, label: p.label === badge.key ? '' : badge.key }))}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Feather name={badge.icon} size={12} color={addressForm.label === badge.key ? COLORS.primary : COLORS.textSecondary} />
                      <Text style={[styles.labelBadgeText, addressForm.label === badge.key && styles.labelBadgeTextActive]}>{badge.text}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {(() => {
                const activeLabel = addressForm.label === 'OTHER' ? (addressForm.customLabel.trim() || 'OTHER') : addressForm.label;
                const duplicateAddr = (activeLabel && activeLabel !== 'OTHER') ? savedAddresses.find(
                  (addr) => {
                    if (!addr.label || addr.label.toUpperCase() !== activeLabel.toUpperCase() || addr.id === editingAddressId) {
                      return false;
                    }
                    const isSameAddress = 
                      (addr.address?.trim().toLowerCase() === searchText?.trim().toLowerCase()) ||
                      (Math.abs(addr.latitude - pinnedCoords.latitude) < 0.0001 && Math.abs(addr.longitude - pinnedCoords.longitude) < 0.0001);
                    return !isSameAddress;
                  }
                ) : null;
                if (duplicateAddr) {
                  return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? '#2D1B10' : '#FEF3C7', padding: 12, borderRadius: 10, marginTop: 12, borderWidth: 1, borderColor: isDarkMode ? '#5B3512' : '#F59E0B' }}>
                      <Feather name="alert-triangle" size={16} color={COLORS.warning || '#D97706'} style={{ marginRight: 8 }} />
                      <Text style={{ flex: 1, fontSize: 11, color: isDarkMode ? '#FCD34D' : '#B45309', fontWeight: '600', lineHeight: 15 }}>
                        This label is already used on another address ("{duplicateAddr.address}"). We'll remove it from that address and assign it to this one.
                      </Text>
                    </View>
                  );
                }
                return null;
              })()}

              {addressForm.label === 'OTHER' && (
                <View style={styles.formInputWrapper}>
                  <TextInput style={styles.formTextInput} value={addressForm.customLabel} onChangeText={(val) => setAddressForm(p => ({ ...p, customLabel: val }))} placeholder="e.g. Grandma's House" placeholderTextColor={COLORS.textSecondary + '66'} />
                </View>
              )}

              <TouchableOpacity style={[styles.button, { marginTop: 12 }]} onPress={saveAddress}>
                <Text style={styles.buttonText}>{editingAddressId ? 'Update Address' : 'Save Address'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </Animated.View>

      {/* Confirmation Modal */}
      <ConfirmationModel
        visible={confirmVisible}
        config={confirmConfig}
        setVisible={setConfirmVisible}
        COLORS={COLORS}
        styles={styles}
      />
    </View>
  );
}
