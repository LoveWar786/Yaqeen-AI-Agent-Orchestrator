import React from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MapView, Marker, Polyline } from '../components/MapViewHelper';

export default function JobRoutingModal({
  visible,
  onClose,
  selectedRoutingJob,
  isDarkMode,
  isProviderMode,
  COLORS,
  styles,
  providerDistance,
  providerDuration,
  locationCoords,
  userProfile,
  providerRouteCoords,
  darkMapStyle
}) {
  if (!selectedRoutingJob) return null;

  const providerLat = locationCoords?.lat || locationCoords?.latitude || selectedRoutingJob?.providerCoords?.lat || selectedRoutingJob?.providerCoords?.latitude || userProfile?.latitude || userProfile?.locationCoords?.lat || 33.6493;
  const providerLng = locationCoords?.lng || locationCoords?.longitude || selectedRoutingJob?.providerCoords?.lng || selectedRoutingJob?.providerCoords?.longitude || userProfile?.longitude || userProfile?.locationCoords?.lng || 72.9806;
  
  let jobLat = selectedRoutingJob?.customerCoords?.lat || selectedRoutingJob?.customerCoords?.latitude;
  let jobLng = selectedRoutingJob?.customerCoords?.lng || selectedRoutingJob?.customerCoords?.longitude;
  
  if (!jobLat || !jobLng) {
    if (selectedRoutingJob.locationCoords) {
      jobLat = selectedRoutingJob.locationCoords.lat;
      jobLng = selectedRoutingJob.locationCoords.lng;
    } else {
      if (selectedRoutingJob.city?.toLowerCase().includes("hyderabad")) {
        jobLat = 25.3960;
        jobLng = 68.3578;
      } else {
        jobLat = 33.6493;
        jobLng = 72.9806;
      }
    }
  }
  const pLat = Number(providerLat);
  const pLng = Number(providerLng);
  const jLat = Number(jobLat);
  const jLng = Number(jobLng);
  
  const region = {
    latitude: (pLat + jLat) / 2,
    longitude: (pLng + jLng) / 2,
    latitudeDelta: Math.max(Math.abs(pLat - jLat) * 1.6, 0.015),
    longitudeDelta: Math.max(Math.abs(pLng - jLng) * 1.6, 0.015),
  };

  const polyCoords = providerRouteCoords.length > 0 ? providerRouteCoords : [
    { latitude: pLat, longitude: pLng },
    { latitude: jLat, longitude: jLng }
  ];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { width: '100%', height: '80%', maxHeight: 600, padding: 0, overflow: 'hidden', borderRadius: 24 }]}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: isDarkMode ? '#1A1A1A' : '#F8FAFC' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.textPrimary }}>Job Route Direction</Text>
              <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>
                {selectedRoutingJob?.service} - Customer: {selectedRoutingJob?.customerName || 'Client'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
              <Feather name="x" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Directions Info banner with OSRM stats */}
          <View style={{ padding: 14, backgroundColor: isDarkMode ? '#1E1B4B' : '#EEF2FF', borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
            <Text style={{ fontSize: 13, color: COLORS.textPrimary, fontWeight: '800' }}>
              🗺️ Shortest Driving Route (OSRM Router Engine)
            </Text>
            <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>
              📍 Destination: {selectedRoutingJob?.location || 'Client Location'}
            </Text>
            
            {(providerDistance || providerDuration) ? (
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 10, backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.textSecondary }}>EST. DRIVING DISTANCE</Text>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: COLORS.primary }}>{providerDistance || '---'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.textSecondary }}>EST. TRAVEL TIME</Text>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: '#10B981' }}>{providerDuration || '---'}</Text>
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>Calculating driving directions...</Text>
              </View>
            )}
          </View>

          {/* Embedded Route Map */}
          <MapView 
            style={{ flex: 1, width: '100%' }}
            region={region}
            customMapStyle={isDarkMode ? darkMapStyle : []}
          >
            <Marker 
              coordinate={{ latitude: pLat, longitude: pLng }}
              title={isProviderMode ? "Your Current Location" : `${selectedRoutingJob?.providerName || 'Provider'} (Shop)`}
              description="Route starting point"
              pinColor={COLORS.primary}
            />
            <Marker 
              coordinate={{ latitude: jLat, longitude: jLng }}
              title="Client Service Location"
              description={selectedRoutingJob?.location || "Destination"}
              pinColor="#10B981"
            />
            <Polyline 
              coordinates={polyCoords}
              strokeWidth={5}
              strokeColor={COLORS.primary}
            />
          </MapView>

          {/* Bottom Actions */}
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border, flexDirection: 'row', gap: 12, backgroundColor: isDarkMode ? '#111' : '#fff' }}>
            <TouchableOpacity 
              style={[styles.button, { flex: 1, marginTop: 0, paddingVertical: 12 }]} 
              onPress={onClose}
            >
              <Text style={styles.buttonText}>Close Route Map</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
