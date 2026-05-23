import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';

export default function ConfirmationModel({ visible, config, setVisible, COLORS, styles }) {
  return (
    <Modal transparent={true} visible={visible} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{config.title}</Text>
          <Text style={styles.modalMessage}>{config.message}</Text>
          <View style={[styles.modalButtons, { flexDirection: 'row', gap: 12 }]}>
            {config.type === 'confirm' && (
              <TouchableOpacity 
                style={[styles.secondaryButton, { flex: 1, marginTop: 0, padding: 12, borderColor: COLORS.border }]} 
                onPress={() => setVisible(false)}
              >
                <Text style={styles.secondaryButtonText}>{config.cancelText || 'Go Back'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[styles.button, { flex: 1, marginTop: 0, padding: 12, backgroundColor: config.type === 'confirm' ? COLORS.danger : COLORS.primary }]} 
              onPress={() => {
                if (config.onConfirm) {
                  config.onConfirm();
                } else {
                  setVisible(false);
                }
              }}
            >
              <Text style={styles.buttonText}>{config.type === 'confirm' ? (config.confirmText || 'Cancel') : 'OK'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
