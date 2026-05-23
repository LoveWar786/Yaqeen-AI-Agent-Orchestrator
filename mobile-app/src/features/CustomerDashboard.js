import React, { useState } from 'react';
import { Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Image, Animated, Platform } from 'react-native';
import { Feather, AntDesign, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioRecorder, RecordingPresets, AudioModule } from 'expo-audio';
import { t } from '../utils/translations';

export default function CustomerDashboard({
  user,
  userProfile,
  isEmailVerified,
  bookings,
  isCustomerActiveBookingsExpanded,
  setCustomerActiveBookingsExpanded,
  searchResult,
  setSearchResult,
  finalBooking,
  setFinalBooking,
  inputText,
  setInputText,
  pickImage,
  imageUri,
  setImageUri,
  setImageBase64,
  serviceMode,
  setServiceMode,
  getBackendUrl,
  typoSuggestion,
  setTypoSuggestion,
  originalTypoWord,
  setOriginalTypoWord,
  activeAddress,
  currentAddress,
  locationCoords,
  pinnedCoords,
  submitSearch,
  loading,
  fadeAnim,
  isDarkMode,
  COLORS,
  styles,
  getShadow,
  addToast,
  confirmBooking,
  handleNegotiateManually,
  negotiationStep,
  setNegotiationStep,
  allRegisteredProviders,
  clientDistance,
  clientDuration,
  clientRouteCoords,
  setActiveChatBooking,
  setCurrentTab,
  handleShowReceipt,
  darkMapStyle,
  MapView,
  Marker,
  Polyline,
  showTracingLogs
}) {
  const lang = userProfile?.language || 'ENGLISH';
  const [isRecording, setIsRecording] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const startRecording = async () => {
    try {
      if (Platform.OS === 'web') {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          addToast("Speech API not supported in this browser", 'error');
          return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.onstart = () => setIsRecording(true);
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setInputText(transcript);
          setIsRecording(false);
          addToast("Voice transcribed successfully", 'success');
        };
        recognition.onerror = (event) => { 
          setIsRecording(false); 
          if (event.error === 'network') {
            addToast("Voice capture failed: Network error. Web speech transcription requires a stable internet connection or may be blocked by firewalls.", 'error');
          } else {
            addToast(`Voice capture failed: ${event.error}`, 'error');
          }
        };
        recognition.onend = () => setIsRecording(false);
        recognition.start();
        return;
      }

      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        addToast("Microphone permission denied", "error");
        return;
      }
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
      addToast("Recording started...", 'info');
    } catch (err) {
      console.error('Failed to start recording', err);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (Platform.OS === 'web') return; 
    try {
      setIsRecording(false);
      try {
        await audioRecorder.stop();
      } catch (e) {
        console.warn("audioRecorder.stop() bypassed or rejected:", e.message);
      }
      const uri = audioRecorder.uri;
      if (!uri) return;
      
      addToast("Processing audio...", 'info');

      const formData = new FormData();
      formData.append('audio', { uri, name: 'audio.m4a', type: 'audio/m4a' });
      
      const response = await fetch(getBackendUrl('/api/transcribe'), {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });
      const data = await response.json();
      if (data.text) {
        setInputText(data.text);
        addToast("Audio transcribed successfully", 'success');
      } else {
        throw new Error(data.error || "Transcription failed");
      }
    } catch (error) {
      console.error("Stop recording error:", error);
      addToast("Error processing audio", 'error');
    }
  };

  return (
    <View style={{ paddingHorizontal: 20 }}>
      {/* Premium Agent Tracing Banner */}
      <TouchableOpacity 
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: isDarkMode ? '#0D1F18' : '#ECFDF5',
          borderWidth: 1,
          borderColor: isDarkMode ? '#113324' : '#A7F3D0',
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 14,
          marginTop: 10,
          marginBottom: 16,
          ...getShadow('#10B981', 0, 4, 0.15, 8, 3)
        }}
        onPress={showTracingLogs}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Feather name="cpu" size={16} color="#10B981" />
          </View>
          <View>
            <Text style={{ fontSize: 13, fontWeight: '900', color: isDarkMode ? '#FFF' : '#0F172A', letterSpacing: 0.3 }}>
              YAQEEN AI AGENT TRACING
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '600', color: isDarkMode ? '#A7F3D0' : '#047857', marginTop: 1 }}>
              Inspect live intent parsing & provider ranking
            </Text>
          </View>
        </View>
        <Feather name="arrow-right" size={16} color="#10B981" />
      </TouchableOpacity>
      {!searchResult && !finalBooking && (
        <View style={{ marginBottom: 20, marginTop: 10 }}>
          {(() => {
            const activeCustomerJobs = bookings.filter(b => 
              b.userId === user.uid && 
              ['NEGOTIATING', 'CONFIRMED', 'DISPATCHED'].includes(b.status?.toUpperCase())
            );
            if (activeCustomerJobs.length === 0) return null;
            
            return (
              <View style={{ marginBottom: 20 }}>
                <TouchableOpacity 
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}
                  onPress={() => setCustomerActiveBookingsExpanded(!isCustomerActiveBookingsExpanded)}
                >
                  <Text style={[styles.sectionTitle, { fontSize: 16, marginBottom: 0 }]}>
                    {t('activeBookings', lang)} ({activeCustomerJobs.length})
                  </Text>
                  <Feather 
                    name={isCustomerActiveBookingsExpanded ? "chevron-up" : "chevron-down"} 
                    size={18} 
                    color={COLORS.textPrimary} 
                  />
                </TouchableOpacity>
                
                {isCustomerActiveBookingsExpanded && (
                  <View style={{ gap: 12 }}>
                    {activeCustomerJobs.map((booking) => {
                      const status = booking.status?.toUpperCase();
                      const isConfirmed = status === 'CONFIRMED';
                      const isDispatched = status === 'DISPATCHED';
                      
                      let badgeBg = COLORS.warning + '20';
                      let badgeColor = COLORS.warning;
                      if (isConfirmed) {
                        badgeBg = COLORS.success + '20';
                        badgeColor = COLORS.success;
                      } else if (isDispatched) {
                        badgeBg = COLORS.primary + '20';
                        badgeColor = COLORS.primary;
                      }
                      
                      return (
                        <View 
                          key={booking.id} 
                          style={{ 
                            backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF', 
                            borderRadius: 16, 
                            padding: 14, 
                            borderWidth: 1, 
                            borderColor: isDarkMode ? '#2E2E2E' : '#E2E8F0',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.05,
                            shadowRadius: 8,
                            elevation: 2
                          }}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.textPrimary }}>
                              {booking.providerName || "Verified Professional"}
                            </Text>
                            <View style={{ backgroundColor: badgeBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                              <Text style={{ fontSize: 10, fontWeight: '800', color: badgeColor }}>
                                {booking.status}
                              </Text>
                            </View>
                          </View>
                          
                          <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>
                            <Text style={{ fontWeight: '600', color: COLORS.textPrimary }}>{t('service', lang)}:</Text> {booking.service}
                          </Text>
                          
                          <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>
                            <Text style={{ fontWeight: '600', color: COLORS.textPrimary }}>{t('timeGiven', lang)}:</Text> {booking.time || "Immediate"}
                          </Text>
                          
                          <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 12 }}>
                            <Text style={{ fontWeight: '600', color: COLORS.textPrimary }}>{t('price', lang)}:</Text> {booking.price ? `Rs. ${Number(booking.price).toLocaleString()}` : "Pending negotiation"}
                          </Text>
                          
                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity 
                              style={{ 
                                flex: 1, 
                                flexDirection: 'row', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                backgroundColor: COLORS.primary, 
                                paddingVertical: 8, 
                                borderRadius: 8 
                              }}
                              onPress={() => setActiveChatBooking(booking)}
                            >
                              <Feather name="message-square" size={14} color="#FFF" style={{ marginRight: 6 }} />
                              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>{t('chat', lang)}</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                              style={{ 
                                flex: 1, 
                                flexDirection: 'row', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                backgroundColor: isDarkMode ? '#222' : '#F1F5F9', 
                                paddingVertical: 8, 
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: COLORS.border
                              }}
                              onPress={() => handleShowReceipt(booking)}
                            >
                              <Feather name="file-text" size={14} color={COLORS.textPrimary} style={{ marginRight: 6 }} />
                              <Text style={{ color: COLORS.textPrimary, fontSize: 12, fontWeight: '700' }}>{t('receipt', lang)}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })()}

          <Text style={[styles.sectionTitle, { marginBottom: 12, fontSize: 16 }]}>{t('popularServices', lang)}</Text>
          
          {/* 2 Column List */}
          <View style={{ gap: 10 }}>
            {[
              [
                { id: 'ac', name: 'AC Technician', translationKey: 'acTech', family: 'Feather', icon: 'wind', color: '#3B82F6' },
                { id: 'plumber', name: 'Plumber', translationKey: 'plumber', family: 'Feather', icon: 'droplet', color: '#10B981' }
              ],
              [
                { id: 'electrician', name: 'Electrician', translationKey: 'electrician', family: 'Feather', icon: 'zap', color: '#F59E0B' },
                { id: 'carpenter', name: 'Carpenter', translationKey: 'carpenter', family: 'MaterialCommunityIcons', icon: 'axe', color: '#EF4444' }
              ],
              [
                { id: 'painter', name: 'Painter', translationKey: 'painter', family: 'MaterialCommunityIcons', icon: 'brush', color: '#8B5CF6' },
                { id: 'tv', name: 'TV Repair', translationKey: 'tvRepair', family: 'Feather', icon: 'tv', color: '#EC4899' }
              ],
              [
                { id: 'beautician', name: 'Beautician', translationKey: 'beautician', family: 'Feather', icon: 'heart', color: '#EC4899' },
                { id: 'barber', name: 'Barber', translationKey: 'barber', family: 'Feather', icon: 'scissors', color: '#06B6D4' }
              ]
            ].map((row, rIdx) => (
              <View key={rIdx} style={{ flexDirection: 'row', gap: 12 }}>
                {row.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={{
                      flex: 1,
                      backgroundColor: COLORS.card,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 14,
                      alignItems: 'center',
                      flexDirection: 'row',
                      gap: 8,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      ...getShadow('#000', 0, 2, 0.05, 4, 2),
                    }}
                    onPress={() => {
                      setInputText(cat.name);
                    }}
                  >
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: cat.color + '15', justifyContent: 'center', alignItems: 'center' }}>
                      {cat.family === 'MaterialCommunityIcons' ? (
                        <MaterialCommunityIcons name={cat.icon} size={14} color={cat.color} />
                      ) : (
                        <Feather name={cat.icon} size={14} color={cat.color} />
                      )}
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textPrimary, flex: 1, flexWrap: 'wrap' }} numberOfLines={2}>
                      {t(cat.translationKey, lang)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </View>
      )}

      {!searchResult && !finalBooking && (
        <View style={styles.card}>
          <Text style={styles.label}>{t('whatNeed', lang)}</Text>
          {isEmailVerified === false && (
            <View style={{
              backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
              borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.25)' : '#FEE2E2',
              borderWidth: 1,
              padding: 12,
              borderRadius: 10,
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8
            }}>
              <Feather name="alert-triangle" size={16} color={COLORS.danger} />
              <Text style={{ fontSize: 12, color: isDarkMode ? '#FCA5A5' : '#991B1B', fontWeight: '800', flex: 1 }}>
                {t('verifyDashboard', lang)}
              </Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <TouchableOpacity 
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: serviceMode === 'HOME' ? COLORS.primary : COLORS.border,
                backgroundColor: serviceMode === 'HOME' ? COLORS.primary + '15' : 'transparent',
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8
              }}
              onPress={() => setServiceMode('HOME')}
            >
              <Feather name="home" size={16} color={serviceMode === 'HOME' ? COLORS.primary : COLORS.textSecondary} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: serviceMode === 'HOME' ? COLORS.primary : COLORS.textSecondary }}>HOME SERVICE</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: serviceMode === 'SHOP' ? COLORS.primary : COLORS.border,
                backgroundColor: serviceMode === 'SHOP' ? COLORS.primary + '15' : 'transparent',
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8
              }}
              onPress={() => setServiceMode('SHOP')}
            >
              <Feather name="briefcase" size={16} color={serviceMode === 'SHOP' ? COLORS.primary : COLORS.textSecondary} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: serviceMode === 'SHOP' ? COLORS.primary : COLORS.textSecondary }}>SHOP SERVICE</Text>
            </TouchableOpacity>
          </View>

          <View style={{ position: 'relative' }}>
            <TextInput
              style={[
                styles.input, 
                { 
                  minHeight: 120, 
                  textAlignVertical: 'top', 
                  paddingRight: lang === 'URDU' ? 12 : 48, 
                  paddingLeft: lang === 'URDU' ? 48 : 12, 
                  opacity: isEmailVerified === false ? 0.6 : 1,
                  textAlign: lang === 'URDU' ? 'right' : 'left'
                }
              ]}
              value={inputText}
              onChangeText={setInputText}
              placeholder={isEmailVerified === false ? t('placeholderSearchLocked', lang) : t('placeholderSearch', lang)}
              placeholderTextColor={COLORS.textSecondary + '88'}
              multiline
              editable={isEmailVerified !== false}
            />
            {isEmailVerified !== false && (
              <View style={{ 
                position: 'absolute', 
                right: lang === 'URDU' ? undefined : 10, 
                left: lang === 'URDU' ? 10 : undefined, 
                top: 10, 
                gap: 12 
              }}>
                <TouchableOpacity onPress={pickImage} style={{ padding: 8, backgroundColor: isDarkMode ? '#2A2A2A' : '#F1F5F9', borderRadius: 8 }}>
                  <Feather name="camera" size={18} color={imageUri ? COLORS.primary : COLORS.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  onLongPress={startRecording} 
                  onPressOut={stopRecording} 
                  onPress={() => Platform.OS === 'web' ? startRecording() : addToast("Hold mic to record", 'info')}
                  style={{ padding: 8, backgroundColor: isRecording ? COLORS.primary + '20' : (isDarkMode ? '#2A2A2A' : '#F1F5F9'), borderRadius: 8, borderWidth: isRecording ? 1 : 0, borderColor: COLORS.primary }}
                >
                  <Feather name="mic" size={18} color={isRecording ? COLORS.primary : COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {typoSuggestion && typoSuggestion.length > 0 && (
            <TouchableOpacity 
              onPress={() => {
                if (inputText && originalTypoWord) {
                  const regex = new RegExp(originalTypoWord, 'gi');
                  setInputText(inputText.replace(regex, typoSuggestion));
                } else {
                  setInputText(typoSuggestion);
                }
                setTypoSuggestion(null);
                setOriginalTypoWord(null);
              }}
              style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                backgroundColor: COLORS.warning + '15', 
                padding: 12, 
                borderRadius: 10, 
                marginTop: 10,
                marginBottom: 16, 
                borderWidth: 1, 
                borderColor: COLORS.warning + '40' 
              }}
            >
              <Feather name="help-circle" size={16} color={COLORS.warning} style={{ marginRight: 8 }} />
              <Text style={{ color: COLORS.textPrimary, fontSize: 13, flex: 1 }}>
                Did you mean: <Text style={{ color: COLORS.warning, fontWeight: '700', textDecorationLine: 'underline' }}>{typoSuggestion}</Text>?
              </Text>
              <Feather name="arrow-right" size={14} color={COLORS.warning} />
            </TouchableOpacity>
          )}

          {imageUri && (
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 16, 
              marginBottom: 16, 
              backgroundColor: isDarkMode ? '#1C1C1E' : '#F1F5F9',
              padding: 10,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: COLORS.border
            }}>
              <View style={{ borderRadius: 10, overflow: 'hidden', height: 64, width: 64 }}>
                <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textPrimary }}>Diagnostic Photo</Text>
                <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>Selected for upload</Text>
              </View>
              <TouchableOpacity 
                onPress={() => {
                  setImageUri(null); 
                  setImageBase64(null);
                  addToast("Picture selection reset.", "info");
                }} 
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  gap: 6, 
                  backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2', 
                  paddingHorizontal: 12, 
                  paddingVertical: 8, 
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : '#FCA5A5'
                }}
              >
                <Feather name="trash-2" size={14} color="#EF4444" />
                <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '800' }}>Reset Picture</Text>
              </TouchableOpacity>
            </View>
          )}

          {(activeAddress || currentAddress) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, backgroundColor: COLORS.primary + '10', padding: 10, borderRadius: 8 }}>
              <Feather name="map-pin" size={14} color={COLORS.primary} style={{ marginRight: 8 }} />
              <Text style={{ color: COLORS.textPrimary, fontSize: 12, flex: 1 }} numberOfLines={1}>
                Reach: {activeAddress ? activeAddress.address : currentAddress}
              </Text>
            </View>
          )}

          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={submitSearch} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Find Provider</Text>}
          </TouchableOpacity>
        </View>
      )}

      {searchResult && (
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={[styles.sectionTitle, { color: COLORS.textPrimary, marginBottom: 8 }]}>AI Recommendation</Text>
          <Text style={[styles.subtitle, { textAlign: 'left', marginBottom: 20 }]}>Based on your request, this is the most reliable match near you.</Text>

          <View style={[styles.card, { borderColor: COLORS.primary, borderWidth: 1.5, overflow: 'hidden', padding: 0 }]}>
            {/* Map Visualization */}
            <View style={{ height: 180, width: '100%', backgroundColor: COLORS.border }}>
              <MapView
                style={{ flex: 1 }}
                initialRegion={{
                  latitude: searchResult.provider.lat || 33.6844,
                  longitude: searchResult.provider.lng || 73.0479,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                customMapStyle={isDarkMode ? darkMapStyle : []}
              >
                <Marker
                  coordinate={{ 
                    latitude: searchResult.provider.lat || 33.6844, 
                    longitude: searchResult.provider.lng || 73.0479 
                  }}
                  title={searchResult.provider.name}
                  description={searchResult.provider.address}
                />
                {locationCoords && (
                  <Marker
                    coordinate={{ latitude: locationCoords.lat, longitude: locationCoords.lng }}
                    pinColor={COLORS.primary}
                    title="Your Location"
                  />
                )}
              </MapView>
            </View>

            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 8 }}>
                <Text 
                  style={[styles.title, { fontSize: 20, marginBottom: 0, textAlign: 'left', color: COLORS.textPrimary, flex: 1, flexWrap: 'wrap' }]}
                  numberOfLines={2}
                >
                  {searchResult.provider.name}
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {searchResult.provider.isVerified && (
                    <View style={{ backgroundColor: COLORS.success + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                      <Text style={{ color: COLORS.success, fontSize: 10, fontWeight: '800' }}>VERIFIED</Text>
                    </View>
                  )}
                  <View style={{ backgroundColor: COLORS.primary + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ color: COLORS.primary, fontSize: 10, fontWeight: '800' }}>BEST MATCH</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.infoRow}>
                <Feather name="map-pin" size={14} color={COLORS.textSecondary} style={{ marginTop: 2 }} />
                <Text style={[styles.infoValue, { color: COLORS.textPrimary, textAlign: 'left', marginLeft: 8, flex: 1 }]}>{searchResult.provider.address}</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                <AntDesign name="star" size={14} color="#FBBF24" />
                <Text style={{ color: COLORS.textPrimary, fontWeight: '700', marginLeft: 4 }}>{searchResult.provider.rating || '4.0'}</Text>
                <Text style={{ color: COLORS.textSecondary, marginLeft: 4 }}>({searchResult.provider.userRatingsTotal || '0'} reviews)</Text>
                {searchResult.provider.distanceText && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.textSecondary, marginHorizontal: 8 }} />
                    <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{searchResult.provider.distanceText}</Text>
                  </View>
                )}
              </View>

              {/* Price Breakdown Details & Agent Negotiation Log */}
              <View style={{ marginTop: 16, backgroundColor: isDarkMode ? '#111' : '#F1F5F9', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.border }}>
                <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' }}>Estimated Pricing Details</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>Estimated Service Price:</Text>
                  <Text style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' }}>Rs. {searchResult.estimatedPrice}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>Flat Visiting Fee:</Text>
                  <Text style={{ color: COLORS.warning, fontSize: 13, fontWeight: '700' }}>Rs. {searchResult.provider.visitingCharges || 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>Platform Fee (10%):</Text>
                  <Text style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' }}>Rs. {Math.round((Number(searchResult.estimatedPrice) || 0) * 0.1)}</Text>
                </View>
                <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 6 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' }}>Total Estimated Amount:</Text>
                  <Text style={{ color: COLORS.success, fontSize: 14, fontWeight: '800' }}>Rs. {(Number(searchResult.estimatedPrice) || 0) + (Number(searchResult.provider.visitingCharges) || 0) + Math.round((Number(searchResult.estimatedPrice) || 0) * 0.1)}</Text>
                </View>
              </View>

              <View style={[styles.reasoningBox, { backgroundColor: isDarkMode ? '#1A1A1A' : '#F8FAFC', borderRadius: 12, padding: 16, marginTop: 16, borderLeftWidth: 3, borderLeftColor: COLORS.primary }]}>
                <Text style={[styles.reasoningTitle, { color: COLORS.primary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }]}>Why this choice?</Text>
                <Text style={[styles.reasoningText, { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 }]}>{searchResult.reasoning}</Text>
                {searchResult.intent.diagnosticNotes && (
                  <Text style={{ color: COLORS.warning, fontSize: 12, marginTop: 8, fontStyle: 'italic' }}>
                    Diagnostic Analysis: {searchResult.intent.diagnosticNotes}
                  </Text>
                )}
              </View>

              {negotiationStep ? (
                <View style={{ marginTop: 20, padding: 16, backgroundColor: COLORS.warning + '15', borderRadius: 12, borderWidth: 1, borderColor: COLORS.warning }}>
                  <Text style={{ color: COLORS.warning, fontWeight: '700', fontSize: 14 }}>Counter-Offer Received</Text>
                  <Text style={{ color: COLORS.textPrimary, marginTop: 4 }}>
                    The provider is busy at your requested time, but can arrive at <Text style={{ fontWeight: '700' }}>{searchResult.proposedTime}</Text>.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                    <TouchableOpacity 
                      style={[styles.button, { flex: 1, height: 40, backgroundColor: COLORS.warning }]} 
                      onPress={() => { setNegotiationStep(false); }}
                    >
                      <Text style={styles.buttonText}>Accept {searchResult.proposedTime}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.secondaryButton, { flex: 1, height: 40, borderColor: COLORS.danger }]} 
                      onPress={() => { setSearchResult(null); setNegotiationStep(false); }}
                    >
                      <Text style={[styles.secondaryButtonText, { color: COLORS.danger }]}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{ gap: 10, marginTop: 20 }}>
                  <TouchableOpacity style={[styles.button, { marginTop: 0 }]} onPress={confirmBooking} disabled={loading}>
                    <Text style={styles.buttonText}>Confirm Booking (Rs. {((Number(searchResult.estimatedPrice) || 0) + (Number(searchResult.provider.visitingCharges) || 0) + Math.round((Number(searchResult.estimatedPrice) || 0) * 0.1)) || '...' })</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.secondaryButton, { marginTop: 0, borderColor: COLORS.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]} 
                    onPress={handleNegotiateManually}
                    disabled={loading}
                  >
                    <Feather name="message-square" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.secondaryButtonText, { color: COLORS.primary }]}>Negotiate Manually</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {searchResult.allProviders && searchResult.allProviders.length > 1 && (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.sectionTitle, { color: COLORS.textPrimary, marginBottom: 12 }]}>Other Options</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
                {searchResult.allProviders
                  .filter(p => p.placeId !== searchResult.provider.placeId)
                  .filter(p => {
                    const normalizeMatch = (s) => s ? s.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
                    return allRegisteredProviders.some(reg => {
                      if (reg.shopLink && p.link && normalizeMatch(reg.shopLink) === normalizeMatch(p.link)) return true;
                      if (reg.shopName && (normalizeMatch(reg.shopName).includes(normalizeMatch(p.name)) || normalizeMatch(p.name).includes(normalizeMatch(reg.shopName)))) return true;
                      if (reg.shopAddress && (normalizeMatch(reg.shopAddress).includes(normalizeMatch(p.address)) || normalizeMatch(p.address).includes(normalizeMatch(reg.shopAddress)))) return true;
                      return reg.uid === p.uid || p.placeId === `reg_${reg.uid}`;
                    });
                  })
                  .map((p, idx) => (
                    <TouchableOpacity 
                      key={p.placeId || idx}
                      style={[styles.card, { width: 280, marginRight: 16, marginBottom: 0, padding: 16 }]}
                      onPress={() => {
                        const whyThis = `This provider is highly qualified to handle your request. Located in ${p.area || p.city || 'your region'} (${p.distanceText || 'nearby'}), they feature a superb rating of ${p.rating || '4.8'} based on verified reviews with a transparent visiting fee of Rs. ${p.visitingCharges || 0}, making them an excellent choice.`;
                        setSearchResult({
                          ...searchResult,
                          provider: p,
                          estimatedPrice: p.estimatedPrice || searchResult.estimatedPrice,
                          reasoning: whyThis
                        });
                      }}
                    >
                      <Text style={[styles.title, { fontSize: 16, textAlign: 'left', color: COLORS.textPrimary, marginBottom: 6, width: '100%' }]} numberOfLines={2}>{p.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <AntDesign name="star" size={12} color="#FBBF24" />
                        <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 12, marginLeft: 4 }}>{p.rating || '4.0'}</Text>
                        <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginLeft: 4 }}>({p.userRatingsTotal || '0'})</Text>
                      </View>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 12 }} numberOfLines={1}>{p.address}</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                        <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 12 }}>{p.distanceText || 'Nearby'}</Text>
                        <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 11, textTransform: 'uppercase' }}>Select</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                }
              </ScrollView>
            </View>
          )}

          <TouchableOpacity style={[styles.secondaryButton, { marginTop: 12, borderStyle: 'dashed' }]} onPress={() => setSearchResult(null)}>
            <Text style={[styles.secondaryButtonText, { color: COLORS.textSecondary }]}>Change Search Request</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {finalBooking && (() => {
        const isDispatched = finalBooking.status?.toUpperCase() === 'DISPATCHED';
        
        if (isDispatched) {
          const userLat = finalBooking.customerCoords?.lat || finalBooking.customerCoords?.latitude || locationCoords?.lat || pinnedCoords?.latitude || 33.6493;
          const userLng = finalBooking.customerCoords?.lng || finalBooking.customerCoords?.longitude || locationCoords?.lng || pinnedCoords?.longitude || 72.9806;
          const pLat = Number(finalBooking.providerCoords?.lat || finalBooking.providerCoords?.latitude || 33.6493);
          const pLng = Number(finalBooking.providerCoords?.lng || finalBooking.providerCoords?.longitude || 72.9806);
          
          const region = {
            latitude: (pLat + Number(userLat)) / 2,
            longitude: (pLng + Number(userLng)) / 2,
            latitudeDelta: Math.max(Math.abs(pLat - Number(userLat)) * 1.6, 0.015),
            longitudeDelta: Math.max(Math.abs(pLng - Number(userLng)) * 1.6, 0.015),
          };

          const polyCoords = clientRouteCoords.length > 0 ? clientRouteCoords : [
            { latitude: pLat, longitude: pLng },
            { latitude: Number(userLat), longitude: Number(userLng) }
          ];

          return (
            <Animated.View style={{ opacity: fadeAnim }}>
              <View style={[styles.card, { borderColor: COLORS.primary, borderWidth: 1.5, position: 'relative', padding: 0, overflow: 'hidden' }]}>
                {/* Close Button */}
                <TouchableOpacity 
                  onPress={() => {
                    setFinalBooking(null);
                    setSearchResult(null);
                    setCurrentTab('home');
                  }}
                  style={{ position: 'absolute', top: 16, right: 16, padding: 6, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 18 }}
                >
                  <Feather name="x" size={16} color="#FFF" />
                </TouchableOpacity>

                {/* Map View */}
                <View style={{ width: '100%', height: 220, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                  <MapView 
                    style={{ flex: 1 }}
                    region={region}
                    customMapStyle={isDarkMode ? darkMapStyle : []}
                  >
                    <Marker 
                      coordinate={{ latitude: pLat, longitude: pLng }}
                      title={`${finalBooking.providerName || 'Provider'}`}
                      description="En Route / Dispatched"
                      pinColor={COLORS.primary}
                    />
                    <Marker 
                      coordinate={{ latitude: Number(userLat), longitude: Number(userLng) }}
                      title="Your Location"
                      description="Destination"
                      pinColor="#10B981"
                    />
                    <Polyline 
                      coordinates={polyCoords}
                      strokeWidth={5}
                      strokeColor={COLORS.primary}
                    />
                  </MapView>
                </View>

                <View style={{ padding: 18 }}>
                  {/* Status Header */}
                  <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ backgroundColor: COLORS.primary + '15', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 8, borderWidth: 1, borderColor: COLORS.primary + '30' }}>
                      <Text style={{ fontSize: 10, fontWeight: '900', color: COLORS.primary, letterSpacing: 1.2 }}>PROVIDER DISPATCHED</Text>
                    </View>
                    <Text style={[styles.title, { fontSize: 18, color: COLORS.textPrimary, marginBottom: 4 }]}>
                      Your service provider is on its way
                    </Text>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 12, textAlign: 'center' }}>
                      Live GPS route tracking enabled.
                    </Text>
                  </View>

                  {/* OSRM Route HUD stats */}
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16, backgroundColor: isDarkMode ? '#141414' : '#F8FAFC', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border }}>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Feather name="navigation" size={16} color={COLORS.primary} style={{ marginBottom: 4 }} />
                      <Text style={{ fontSize: 9, fontWeight: '700', color: COLORS.textSecondary }}>DISTANCE AWAY</Text>
                      <Text style={{ fontSize: 14, fontWeight: '900', color: COLORS.textPrimary }}>{clientDistance || 'Calculating...'}</Text>
                    </View>
                    <View style={{ width: 1, backgroundColor: COLORS.border }} />
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Feather name="clock" size={16} color="#10B981" style={{ marginBottom: 4 }} />
                      <Text style={{ fontSize: 9, fontWeight: '700', color: COLORS.textSecondary }}>EST. TIME TO ARRIVE</Text>
                      <Text style={{ fontSize: 14, fontWeight: '900', color: COLORS.textPrimary }}>{clientDuration || 'Calculating...'}</Text>
                    </View>
                  </View>

                  {/* Booking Details */}
                  <View style={{ backgroundColor: isDarkMode ? '#111' : '#F8FAFC', padding: 14, borderRadius: 14, marginBottom: 16 }}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Service Requested</Text>
                      <Text style={styles.infoValue}>{finalBooking.service}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Professional</Text>
                      <Text style={styles.infoValue}>{finalBooking.providerName}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Agreed Price</Text>
                      <Text style={[styles.infoValue, { color: COLORS.success }]}>Rs. {Number(finalBooking.price || 1500).toLocaleString()}</Text>
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity 
                      style={{ 
                        flex: 1.2, 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        backgroundColor: COLORS.primary, 
                        paddingVertical: 12, 
                        borderRadius: 12 
                      }}
                      onPress={() => setActiveChatBooking(finalBooking)}
                    >
                      <Feather name="message-square" size={16} color="#FFF" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800' }}>Chat With Provider</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={{ 
                        flex: 0.8, 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        backgroundColor: isDarkMode ? '#222' : '#E2E8F0', 
                        paddingVertical: 12, 
                        borderRadius: 12 
                      }}
                      onPress={() => {
                        setFinalBooking(null);
                        setSearchResult(null);
                        setCurrentTab('history');
                      }}
                    >
                      <Text style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' }}>History</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Animated.View>
          );
        }

        return (
          <Animated.View style={{ opacity: fadeAnim }}>
            <View style={[styles.card, { borderColor: COLORS.success, borderWidth: 1.5, position: 'relative' }]}>
              {/* Close button X to go back to Home Screen without cancelling */}
              <TouchableOpacity 
                onPress={() => {
                  setFinalBooking(null);
                  setSearchResult(null);
                  setCurrentTab('home');
                }}
                style={{ position: 'absolute', top: 16, right: 16, padding: 6, zIndex: 10 }}
              >
                <Feather name="x" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>

              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.success + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                  <Feather name="check" size={32} color={COLORS.success} />
                </View>
                <Text style={[styles.title, { color: COLORS.textPrimary, marginBottom: 4 }]}>Booking Confirmed!</Text>
                <Text style={{ color: COLORS.textSecondary }}>Your agent has secured the slot.</Text>
              </View>

              <View style={{ backgroundColor: isDarkMode ? '#111' : '#F8FAFC', padding: 16, borderRadius: 16, marginBottom: 20 }}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Service</Text>
                  <Text style={styles.infoValue}>{finalBooking.service}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Provider</Text>
                  <Text style={styles.infoValue}>{finalBooking.providerName}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Time</Text>
                  <Text style={styles.infoValue}>{finalBooking.time}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Price</Text>
                  <Text style={[styles.infoValue, { color: COLORS.success }]}>Rs. {Number(finalBooking.price || 1500).toLocaleString()}</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.secondaryButton, { marginTop: 10 }]} 
                onPress={() => {
                  setFinalBooking(null);
                  setSearchResult(null);
                  setCurrentTab('history');
                }}
              >
                <Text style={styles.secondaryButtonText}>View History</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        );
      })()}
    </View>
  );
}
