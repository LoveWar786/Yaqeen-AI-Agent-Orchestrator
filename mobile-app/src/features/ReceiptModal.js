import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { generatePDFReceipt } from './PDFReceiptGeneration';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/**
 * ReceiptModal — displays a formatted booking receipt with PDF download.
 *
 * Props:
 *  visible, onClose, receiptData, COLORS, styles, addToast, isDarkMode
 */
export default function ReceiptModal({ visible, onClose, receiptData, COLORS, styles, addToast, isDarkMode }) {
  const downloadReceipt = async () => {
    await generatePDFReceipt(receiptData, Print, Sharing, addToast);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { maxWidth: 450, padding: 24, borderRadius: 20 }]}>
          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: COLORS.success + '12',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <Feather name="check-circle" size={28} color={COLORS.success} />
            </View>
            <Text style={[styles.modalTitle, { marginBottom: 4 }]}>Booking Receipt</Text>
            <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>ID: {receiptData?.id}</Text>
          </View>

          {/* Details */}
          <View style={{ gap: 10, marginVertical: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>Provider:</Text>
              <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 13 }}>
                {receiptData?.providerName}
              </Text>
            </View>

            {receiptData?.providerID && receiptData?.providerID !== 'N/A' && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>Provider ID:</Text>
                <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 13 }}>
                  {receiptData?.providerID}
                </Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>Service:</Text>
              <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 13 }}>
                {receiptData?.service}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>Time:</Text>
              <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 13 }}>
                {receiptData?.time}
              </Text>
            </View>

            <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 6, opacity: 0.5 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>Service Price:</Text>
              <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 13 }}>
                Rs. {receiptData?.price || 0}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>Visiting Charges:</Text>
              <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 13 }}>
                Rs. {receiptData?.visitingCharges || 0}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>Platform Fee (10%):</Text>
              <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 13 }}>
                Rs. {Math.round((receiptData?.price || 0) * 0.1)}
              </Text>
            </View>

            <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 6, opacity: 0.5 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: COLORS.textPrimary, fontWeight: '800', fontSize: 15 }}>Total Amount:</Text>
              <Text style={{ color: COLORS.primary, fontWeight: '900', fontSize: 18 }}>
                Rs. {(receiptData?.price || 0) + (receiptData?.visitingCharges || 0) + Math.round((receiptData?.price || 0) * 0.1)}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                { flex: 1, marginTop: 0, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
              ]}
              onPress={downloadReceipt}
            >
              <Feather name="download" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.secondaryButtonText}>PDF Invoice</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { flex: 1, marginTop: 0, paddingVertical: 12 }]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
