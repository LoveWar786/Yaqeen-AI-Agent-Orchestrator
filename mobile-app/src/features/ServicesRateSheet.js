import React, { useState } from 'react';
import { Text, View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { doc, updateDoc } from 'firebase/firestore';
import { generateProviderKeywords } from '../utils/translations';

export default function ServicesRateSheet({
  user,
  userProfile,
  setUserProfile,
  isDarkMode,
  COLORS,
  styles,
  db,
  addToast
}) {
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceMin, setNewServiceMin] = useState('');
  const [newServiceMax, setNewServiceMax] = useState('');
  const [editingServiceName, setEditingServiceName] = useState(null);
  const [servicesLoading, setServicesLoading] = useState(false);

  const handleAddService = async () => {
    if (!newServiceName || !newServiceMin || !newServiceMax) {
      addToast("Please fill all service fields", "error");
      return;
    }
    if (Number(newServiceMin) < 0 || Number(newServiceMax) < 0) {
      addToast("Service prices cannot be negative", "error");
      return;
    }
    setServicesLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const newService = {
        minPrice: Number(newServiceMin),
        maxPrice: Number(newServiceMax)
      };
      
      let updatedServices = {
        ...(userProfile?.services || {}),
        [newServiceName.trim()]: newService
      };
      
      // If we are editing and the name of the service changed, delete the old service key
      if (editingServiceName && editingServiceName.trim() !== newServiceName.trim()) {
        delete updatedServices[editingServiceName.trim()];
      }

      const newServicesList = generateProviderKeywords(userProfile?.primarySkill, userProfile?.roleTitle, updatedServices);
      await updateDoc(userRef, { services: updatedServices, servicesList: newServicesList });
      setUserProfile(prev => ({ ...prev, services: updatedServices, servicesList: newServicesList }));
      setNewServiceName('');
      setNewServiceMin('');
      setNewServiceMax('');
      setEditingServiceName(null);
      addToast(editingServiceName ? "Service updated successfully!" : "Service added successfully!", "success");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setServicesLoading(false);
    }
  };

  const handleDeleteService = async (serviceName) => {
    setServicesLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const updatedServices = { ...(userProfile?.services || {}) };
      delete updatedServices[serviceName];
      
      const newServicesList = generateProviderKeywords(userProfile?.primarySkill, userProfile?.roleTitle, updatedServices);
      await updateDoc(userRef, { services: updatedServices, servicesList: newServicesList });
      setUserProfile(prev => ({ ...prev, services: updatedServices, servicesList: newServicesList }));
      addToast("Service removed!", "success");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setServicesLoading(false);
    }
  };

  return (
    <View style={{ paddingHorizontal: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 }}>Custom Services Rates</Text>
      <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 20 }}>
        Add individual services you provide and their price ranges. The AI Negotiator will auto-negotiate with customers based on these bounds.
      </Text>

      {/* Add Service Form Card */}
      <View style={[styles.card, { padding: 18, marginBottom: 24, borderWidth: 1, borderColor: COLORS.border }]}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 14 }}>Add New Service</Text>
        
        <Text style={styles.inputLabel}>Service Name (e.g. AC Repair, Plumbing)</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Enter service name..." 
          placeholderTextColor={COLORS.textSecondary} 
          value={newServiceName} 
          onChangeText={setNewServiceName} 
        />

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Min Price (PKR)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Min PKR" 
              placeholderTextColor={COLORS.textSecondary} 
              keyboardType="numeric"
              value={newServiceMin}
              onChangeText={setNewServiceMin}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Max Price (PKR)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Max PKR" 
              placeholderTextColor={COLORS.textSecondary} 
              keyboardType="numeric"
              value={newServiceMax}
              onChangeText={setNewServiceMax}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.button, { marginTop: 14, height: 44 }]} 
          onPress={handleAddService}
          disabled={servicesLoading}
        >
          {servicesLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{editingServiceName ? "Update Service" : "Add Service"}</Text>}
        </TouchableOpacity>

        {editingServiceName && (
          <TouchableOpacity 
            style={[styles.button, { marginTop: 8, height: 44, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderWidth: 1, borderColor: COLORS.border }]} 
            onPress={() => {
              setNewServiceName('');
              setNewServiceMin('');
              setNewServiceMax('');
              setEditingServiceName(null);
            }}
          >
            <Text style={{ color: COLORS.textPrimary, fontWeight: '700' }}>Cancel Editing</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Services List */}
      <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12 }}>My Service Rate Sheet</Text>
      {(!userProfile?.services || Object.keys(userProfile.services).length === 0) ? (
        <View style={[styles.card, { alignItems: 'center', padding: 24 }]}>
          <Feather name="file-text" size={32} color={COLORS.textSecondary} style={{ marginBottom: 10, opacity: 0.5 }} />
          <Text style={{ color: COLORS.textSecondary, fontSize: 13, textAlign: 'center' }}>No services specified yet. AI will fall back to your general business prices.</Text>
        </View>
      ) : (
        <View style={{ gap: 10, paddingBottom: 40 }}>
          {Object.keys(userProfile.services).map((name) => {
            const s = userProfile.services[name];
            return (
              <View key={name} style={[styles.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderWidth: 1, borderColor: COLORS.border }]}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.textPrimary }}>{name}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>Range:</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.success }}>Rs. {s.minPrice} - Rs. {s.maxPrice}</Text>
                  </View>
                </View>
                
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity 
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary + '12', justifyContent: 'center', alignItems: 'center', marginRight: 8 }} 
                    onPress={() => {
                      setEditingServiceName(name);
                      setNewServiceName(name);
                      setNewServiceMin(String(s.minPrice));
                      setNewServiceMax(String(s.maxPrice));
                    }}
                  >
                    <Feather name="edit-2" size={16} color={COLORS.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.danger + '12', justifyContent: 'center', alignItems: 'center' }} 
                    onPress={() => handleDeleteService(name)}
                  >
                    <Feather name="trash-2" size={16} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
