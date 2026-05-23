import React, { useState, useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function RoleRestrictedSwitch({ user, db, isProviderMode, setIsProviderMode, addToast, COLORS, isDarkMode }) {
  const [role, setRole] = useState(null);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user) return;
      const userQuery = query(collection(db, 'users'), where('uid', '==', user.uid));
      const userSnapshot = await getDocs(userQuery);
      if (!userSnapshot.empty) {
        setRole(userSnapshot.docs[0].data().role);
      }
    };
    fetchRole();
  }, [user]);

  if (role !== 'provider') return null;

  return (
    <TouchableOpacity 
      style={[
        {
          backgroundColor: isProviderMode ? COLORS.primary + '20' : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'), 
          paddingHorizontal: 12, 
          paddingVertical: 10, 
          borderRadius: 12, 
          borderWidth: 1, 
          borderColor: isProviderMode ? COLORS.primary : COLORS.border,
        }
      ]} 
      onPress={() => {
        setIsProviderMode(!isProviderMode);
        addToast(isProviderMode ? "Switched to Customer Mode" : "Switched to Provider Portal", 'info');
      }}
    >
      <Feather name="tool" size={16} color={isProviderMode ? COLORS.primary : COLORS.textPrimary} />
    </TouchableOpacity>
  );
}
