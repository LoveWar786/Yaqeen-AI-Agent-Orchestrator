import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { collection, addDoc, query, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { parseRelativeTimeToDate } from '../services/timeUtils';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse an "HH:MM AM/PM" string into minutes-since-midnight (for comparison).
 */
const parseTimeToMinutes = (timeStr) => {
  try {
    if (!timeStr) return null;
    const match = String(timeStr).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const mins = parseInt(match[2], 10);
    const ampm = (match[3] || '').toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + mins;
  } catch {
    return null;
  }
};

/**
 * Parse a free-text time input ("kal subah 8 bjy", "tomorrow 11am", "6:30 PM") into
 * { dateObj, clockTime, time } using parseRelativeTimeToDate.
 */
const parseTimeInput = (rawText, amPmHint) => {
  if (!rawText || !rawText.trim()) return null;
  const trimText = rawText.trim();
  const lower = trimText.toLowerCase();
  
  // List of period or indicator keywords
  const indicators = ['am', 'pm', 'bjy', 'baje', 'baji', 'bje', 'subah', 'shaam', 'dopahar', 'raat', 'tonight', 'morning', 'evening', 'afternoon', 'night', 'صبح', 'دوپہر', 'شام', 'رات', 'بجے', 'بجی'];
  const hasIndicator = indicators.some(ind => lower.includes(ind));
  
  let combined = trimText;
  if (!hasIndicator && amPmHint) {
    combined = `${trimText} ${amPmHint}`;
  }
  
  try {
    return parseRelativeTimeToDate(combined);
  } catch {
    return null;
  }
};

export default function ChatModal({
  activeChatBooking,
  onClose,
  user,
  userProfile,
  db,
  isProviderMode,
  isDarkMode,
  COLORS,
  styles,
  addToast,
  sendNotification,
  allRegisteredProviders = [],
}) {
  const [chatInputText, setChatInputText] = useState('');
  const [manualChatMessages, setManualChatMessages] = useState([]);
  const [isPriceOfferModalVisible, setPriceOfferModalVisible] = useState(false);
  const [isTimeOfferModalVisible, setTimeOfferModalVisible] = useState(false);
  const [negotiationPriceInput, setNegotiationPriceInput] = useState('');
  const [negotiationTimeInput, setNegotiationTimeInput] = useState('');
  const [counteringMessageId, setCounteringMessageId] = useState(null);
  const [negotiationTimeAmPm, setNegotiationTimeAmPm] = useState(null);
  const chatScrollView = useRef(null);

  // ─── Real-time messages sync ────────────────────────────────────────────────
  useEffect(() => {
    if (!activeChatBooking) { setManualChatMessages([]); return; }
    const q = query(collection(db, 'bookings', activeChatBooking.id, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (qs) => {
      const msgs = [];
      qs.forEach(d => msgs.push({ id: d.id, ...d.data() }));
      setManualChatMessages(msgs);
    });
    return () => unsub();
  }, [activeChatBooking?.id]);

  // ─── Provider availability lookup ───────────────────────────────────────────
  const providerAvailability = useMemo(() => {
    if (!activeChatBooking?.providerId) return null;
    const prov = allRegisteredProviders.find(p => p.uid === activeChatBooking.providerId || p.id === activeChatBooking.providerId);
    return prov?.availability || null;
  }, [activeChatBooking?.providerId, allRegisteredProviders]);

  // ─── Real-time parsed time preview ─────────────────────────────────────────
  const parsedTimePreview = useMemo(() => {
    if (!negotiationTimeInput.trim()) return null;
    const result = parseTimeInput(negotiationTimeInput, negotiationTimeAmPm);
    if (!result) return null;
    return result.time; // e.g. "Wednesday, May 21, 2025 at 8:00 AM"
  }, [negotiationTimeInput, negotiationTimeAmPm]);

  const isClosed = ['COMPLETED', 'CANCELLED', 'CANCELLED_BY_USER', 'REJECTED'].includes(
    activeChatBooking?.status?.toUpperCase()
  );

  // ─── Message send ───────────────────────────────────────────────────────────
  const handleSendMessage = async () => {
    if (!chatInputText.trim() || !activeChatBooking) return;
    if (isClosed) { addToast('Chat closed — service completed or cancelled', 'error'); return; }
    const txt = chatInputText;
    setChatInputText('');
    try {
      await addDoc(collection(db, 'bookings', activeChatBooking.id, 'messages'), {
        senderId: user.uid,
        senderName: userProfile?.name || user.displayName || (user.email?.split('@')[0] || 'Client'),
        text: txt.trim(),
        createdAt: Date.now(),
      });
    } catch (err) {
      addToast('Failed to send: ' + err.message, 'error');
    }
  };

  // ─── Availability validation helper ────────────────────────────────────────
  /**
   * Returns null if the offered time is within availability, or an error string if outside.
   */
  const checkAvailability = (parsedResult) => {
    if (!providerAvailability) return null; // no availability set — allow anything
    const { startTime, endTime } = providerAvailability;
    if (!startTime || !endTime) return null;

    const startMins = parseTimeToMinutes(startTime);
    const endMins = parseTimeToMinutes(endTime);
    if (startMins === null || endMins === null) return null;

    // Get the proposed clock time in minutes
    const clockTimeStr = parsedResult?.clockTime;
    const proposedMins = parseTimeToMinutes(clockTimeStr);
    if (proposedMins === null) return null;

    if (proposedMins < startMins || proposedMins > endMins) {
      return { startTime, endTime };
    }
    return null;
  };

  // ─── Price offer submit ─────────────────────────────────────────────────────
  const submitInlinePriceOffer = async () => {
    const newPrice = Number(negotiationPriceInput);
    if (isNaN(newPrice) || newPrice <= 0) { addToast('Invalid price', 'error'); return; }
    try {
      if (counteringMessageId) {
        await updateDoc(doc(db, 'bookings', activeChatBooking.id, 'messages', counteringMessageId), { status: 'countered' });
      }
      await addDoc(collection(db, 'bookings', activeChatBooking.id, 'messages'), {
        senderId: user.uid, senderName: isProviderMode ? 'Provider' : 'Customer',
        text: `Proposed Rs. ${newPrice.toLocaleString()} price offer`,
        type: 'price_offer', offeredPrice: newPrice,
        offeredBy: isProviderMode ? 'provider' : 'customer', status: 'pending', createdAt: Date.now(),
      });
      await updateDoc(doc(db, 'bookings', activeChatBooking.id), {
        offeredPrice: newPrice, offeredPriceBy: isProviderMode ? 'provider' : 'customer',
      });
      const recipientId = isProviderMode ? activeChatBooking.userId : activeChatBooking.providerId;
      sendNotification(recipientId, `Price Offer`, `Proposed price: Rs. ${newPrice.toLocaleString()}`, activeChatBooking.id);
      setPriceOfferModalVisible(false); setNegotiationPriceInput(''); setCounteringMessageId(null);
      addToast('Price offer sent!', 'success');
    } catch (err) { addToast(err.message, 'error'); }
  };

  // ─── Time offer submit (with availability check) ────────────────────────────
  const submitInlineTimeOffer = async () => {
    if (!negotiationTimeInput.trim()) { addToast('Please enter time and select AM/PM', 'error'); return; }

    const parsed = parseTimeInput(negotiationTimeInput, negotiationTimeAmPm);
    const finalTime = parsed ? parsed.time : `${negotiationTimeInput.trim()} ${negotiationTimeAmPm || ''}`.trim();

    // Check availability
    const availError = checkAvailability(parsed);
    if (availError) {
      // Post a system message in chat instead of blocking with a toast
      try {
        await addDoc(collection(db, 'bookings', activeChatBooking.id, 'messages'), {
          senderId: 'system',
          senderName: 'Yaqeen AI',
          text: `⚠️ The provider's availability time is from ${availError.startTime} to ${availError.endTime} - kindly offer another time.`,
          type: 'availability_error',
          createdAt: Date.now(),
        });
      } catch (e) {
        console.warn('Failed to post availability error message:', e);
      }
      setTimeOfferModalVisible(false);
      setNegotiationTimeInput('');
      setNegotiationTimeAmPm(null);
      setCounteringMessageId(null);
      return;
    }

    try {
      if (counteringMessageId) {
        await updateDoc(doc(db, 'bookings', activeChatBooking.id, 'messages', counteringMessageId), { status: 'countered' });
      }
      await addDoc(collection(db, 'bookings', activeChatBooking.id, 'messages'), {
        senderId: user.uid, senderName: isProviderMode ? 'Provider' : 'Customer',
        text: `Proposed new time slot: ${finalTime}`,
        type: 'time_offer', offeredTime: finalTime,
        offeredBy: isProviderMode ? 'provider' : 'customer', status: 'pending', createdAt: Date.now(),
      });
      await updateDoc(doc(db, 'bookings', activeChatBooking.id), {
        offeredTime: finalTime, offeredTimeBy: isProviderMode ? 'provider' : 'customer',
      });
      const recipientId = isProviderMode ? activeChatBooking.userId : activeChatBooking.providerId;
      sendNotification(recipientId, `Time Proposal`, `Proposed: ${finalTime}`, activeChatBooking.id);
      setTimeOfferModalVisible(false); setNegotiationTimeInput(''); setNegotiationTimeAmPm(null); setCounteringMessageId(null);
      addToast('Time offer sent!', 'success');
    } catch (err) { addToast(err.message, 'error'); }
  };

  // ─── Accept/Decline handlers ────────────────────────────────────────────────
  const handleAcceptPrice = async (msgId, price) => {
    try {
      await updateDoc(doc(db, 'bookings', activeChatBooking.id, 'messages', msgId), { status: 'accepted' });
      await updateDoc(doc(db, 'bookings', activeChatBooking.id), { price, offeredPrice: null, offeredPriceBy: null });
      await addDoc(collection(db, 'bookings', activeChatBooking.id, 'messages'), {
        senderId: 'system', senderName: 'Yaqeen AI',
        text: `${isProviderMode ? 'Provider' : 'Customer'} accepted price of Rs. ${price.toLocaleString()}!`, createdAt: Date.now(),
      });
      sendNotification(isProviderMode ? activeChatBooking.userId : activeChatBooking.providerId, 'Price Accepted', `Rs. ${price.toLocaleString()} settled!`, activeChatBooking.id);
      addToast('Price accepted!', 'success');
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleDeclinePrice = async (msgId) => {
    try {
      await updateDoc(doc(db, 'bookings', activeChatBooking.id, 'messages', msgId), { status: 'declined' });
      await updateDoc(doc(db, 'bookings', activeChatBooking.id), { offeredPrice: null, offeredPriceBy: null });
      await addDoc(collection(db, 'bookings', activeChatBooking.id, 'messages'), {
        senderId: 'system', senderName: 'Yaqeen AI', text: 'Price offer was declined.', createdAt: Date.now(),
      });
      sendNotification(isProviderMode ? activeChatBooking.userId : activeChatBooking.providerId, 'Price Declined', 'The price offer was declined.', activeChatBooking.id);
      addToast('Price declined', 'info');
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleAcceptTime = async (msgId, time) => {
    try {
      await updateDoc(doc(db, 'bookings', activeChatBooking.id, 'messages', msgId), { status: 'accepted' });
      await updateDoc(doc(db, 'bookings', activeChatBooking.id), { time, offeredTime: null, offeredTimeBy: null });
      await addDoc(collection(db, 'bookings', activeChatBooking.id, 'messages'), {
        senderId: 'system', senderName: 'Yaqeen AI', text: `Time slot finalized: ${time}!`, createdAt: Date.now(),
      });
      sendNotification(isProviderMode ? activeChatBooking.userId : activeChatBooking.providerId, 'Time Accepted', `Time: ${time}`, activeChatBooking.id);
      addToast('Time accepted!', 'success');
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleDeclineTime = async (msgId) => {
    try {
      await updateDoc(doc(db, 'bookings', activeChatBooking.id, 'messages', msgId), { status: 'declined' });
      await updateDoc(doc(db, 'bookings', activeChatBooking.id), { offeredTime: null, offeredTimeBy: null });
      await addDoc(collection(db, 'bookings', activeChatBooking.id, 'messages'), {
        senderId: 'system', senderName: 'Yaqeen AI', text: 'Time offer was declined.', createdAt: Date.now(),
      });
      sendNotification(isProviderMode ? activeChatBooking.userId : activeChatBooking.providerId, 'Time Declined', 'Time offer declined.', activeChatBooking.id);
      addToast('Time declined', 'info');
    } catch (err) { addToast(err.message, 'error'); }
  };

  // ─── Message renderer ───────────────────────────────────────────────────────
  const renderMessage = (msg) => {
    const isMe = msg.senderId === user.uid;
    const isSys = msg.senderId === 'system';

    // ── Availability error system message (purple-accented) ──
    if (isSys && msg.type === 'availability_error') {
      return (
        <View key={msg.id} style={{ alignSelf: 'center', backgroundColor: 'rgba(168,85,247,0.12)', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, maxWidth: '92%', borderWidth: 1.5, borderColor: 'rgba(168,85,247,0.35)', marginVertical: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Feather name="clock" size={13} color="#A855F7" />
            <Text style={{ fontSize: 11, fontWeight: '900', color: '#A855F7', letterSpacing: 0.3 }}>AVAILABILITY ERROR</Text>
          </View>
          {/* Parse out the time range and color it purple */}
          {(() => {
            const match = msg.text.match(/from (.+?) to (.+?)\s+-/);
            if (match) {
              return (
                <Text style={{ fontSize: 12, color: isDarkMode ? '#D8B4FE' : '#6B21A8', fontWeight: '600', lineHeight: 18, textAlign: 'center' }}>
                  ⚠️ The provider's availability time is from{' '}
                  <Text style={{ color: '#A855F7', fontWeight: '800' }}>{match[1]}</Text>
                  {' '}to{' '}
                  <Text style={{ color: '#A855F7', fontWeight: '800' }}>{match[2]}</Text>
                  {' '}– kindly offer another time.
                </Text>
              );
            }
            return <Text style={{ fontSize: 12, color: isDarkMode ? '#D8B4FE' : '#6B21A8', fontWeight: '600' }}>{msg.text}</Text>;
          })()}
        </View>
      );
    }

    if (isSys) {
      return (
        <View key={msg.id} style={{ alignSelf: 'center', backgroundColor: COLORS.warning + '12', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, maxWidth: '85%' }}>
          <Text style={{ fontSize: 11, color: COLORS.warning, fontWeight: '700', textAlign: 'center' }}>{msg.text}</Text>
        </View>
      );
    }

    const offerStatus = msg.status || 'pending';
    const isPending = offerStatus === 'pending';
    const isAccepted = offerStatus === 'accepted';
    const isDeclined = offerStatus === 'declined';

    if (msg.type === 'price_offer' || msg.type === 'time_offer') {
      const isPriceOffer = msg.type === 'price_offer';
      const accentColor = isPriceOffer ? COLORS.warning : COLORS.primary;
      const borderColor = isAccepted ? COLORS.success : isDeclined ? COLORS.danger : offerStatus === 'countered' ? COLORS.border : accentColor;

      return (
        <View key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', width: '85%', backgroundColor: isDarkMode ? '#1E1E1E' : '#FFF', borderRadius: 16, borderWidth: 1.5, borderColor, padding: 12, marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Feather name={isPriceOffer ? 'tag' : 'clock'} size={14} color={isAccepted ? COLORS.success : accentColor} />
            <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.textPrimary }}>{isPriceOffer ? 'Price Offer' : 'Time Offer'}</Text>
          </View>
          <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: isPriceOffer ? 2 : 8 }}>
            {msg.senderName} proposed:{' '}
            <Text style={{ fontWeight: '800', color: COLORS.textPrimary }}>
              {isPriceOffer ? `Rs. ${Number(msg.offeredPrice).toLocaleString()}` : msg.offeredTime}
            </Text>
          </Text>
          {isPriceOffer && (
            <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, fontStyle: 'italic' }}>
              + Rs. {Math.round(Number(msg.offeredPrice) * 0.1).toLocaleString()} (10% Platform Fee){'\n'}
              <Text style={{ fontWeight: '700', color: COLORS.success }}>Total: Rs. {Math.round(Number(msg.offeredPrice) * 1.1).toLocaleString()}</Text>
            </Text>
          )}

          {isPending && (
            isMe ? (
              <View style={{ backgroundColor: isDarkMode ? '#222' : '#F1F5F9', padding: 6, borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: '700' }}>Pending Response...</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={{ flex: 1.2, backgroundColor: COLORS.success, paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}
                  onPress={() => isPriceOffer ? handleAcceptPrice(msg.id, msg.offeredPrice) : handleAcceptTime(msg.id, msg.offeredTime)}
                >
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1.2, backgroundColor: COLORS.warning, paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}
                  onPress={() => {
                    if (isPriceOffer) { setNegotiationPriceInput(''); setCounteringMessageId(msg.id); setPriceOfferModalVisible(true); }
                    else { setNegotiationTimeInput(''); setCounteringMessageId(msg.id); setTimeOfferModalVisible(true); }
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>Counter</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: COLORS.danger, paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}
                  onPress={() => isPriceOffer ? handleDeclinePrice(msg.id) : handleDeclineTime(msg.id)}
                >
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>Decline</Text>
                </TouchableOpacity>
              </View>
            )
          )}

          {!isPending && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: isAccepted ? COLORS.success + '15' : COLORS.danger + '15', padding: 8, borderRadius: 8 }}>
              <Feather name={isAccepted ? 'check-circle' : 'x-circle'} size={12} color={isAccepted ? COLORS.success : COLORS.danger} />
              <Text style={{ fontSize: 11, fontWeight: '800', color: isAccepted ? COLORS.success : COLORS.danger }}>
                {isAccepted ? 'Offer Accepted' : offerStatus === 'countered' ? 'Offer Countered' : 'Offer Declined'}
              </Text>
            </View>
          )}
          <Text style={{ fontSize: 9, color: COLORS.textSecondary, marginTop: 6, alignSelf: 'flex-end' }}>
            {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </Text>
        </View>
      );
    }

    return (
      <View key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
        <View style={{ backgroundColor: isMe ? COLORS.primary : (isDarkMode ? '#222' : '#F1F5F9'), paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, borderBottomRightRadius: isMe ? 4 : 16, borderBottomLeftRadius: isMe ? 16 : 4 }}>
          <Text style={{ fontSize: 13, color: isMe ? '#fff' : COLORS.textPrimary }}>{msg.text}</Text>
        </View>
        <Text style={{ fontSize: 9, color: COLORS.textSecondary, alignSelf: isMe ? 'flex-end' : 'flex-start', marginTop: 2 }}>
          {msg.senderName} • {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </Text>
      </View>
    );
  };

  return (
    <>
      {/* Main Chat Modal */}
      <Modal visible={!!activeChatBooking} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { width: '100%', height: '90%', maxHeight: 700, padding: 0, overflow: 'hidden', borderRadius: 24 }]}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: isDarkMode ? '#1A1A1A' : '#F8FAFC' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.textPrimary }}>{activeChatBooking?.service}</Text>
                <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>
                  {isProviderMode ? `Client: ${activeChatBooking?.customerName}` : `Provider: ${activeChatBooking?.providerName}`}
                </Text>
                {providerAvailability?.startTime && providerAvailability?.endTime && (
                  <Text style={{ fontSize: 10, color: COLORS.primary, fontWeight: '700', marginTop: 2 }}>
                    🕒 Provider available: {providerAvailability.startTime} – {providerAvailability.endTime}
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <View style={{ backgroundColor: isClosed ? COLORS.border : COLORS.success + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: isClosed ? COLORS.textSecondary : COLORS.success }}>{activeChatBooking?.status}</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
                  <Feather name="x" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Messages */}
            <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ gap: 12, paddingBottom: 20 }}
              ref={chatScrollView} onContentSizeChange={() => chatScrollView.current?.scrollToEnd({ animated: true })}>
              {manualChatMessages.map(renderMessage)}
            </ScrollView>

            {/* Input */}
            <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: isDarkMode ? '#111' : '#FFF' }}>
              {activeChatBooking && ['PENDING', 'NEGOTIATING'].includes(activeChatBooking?.status?.toUpperCase()) && (
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                  {isProviderMode && (
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary + '15', paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary }}
                      onPress={() => { setNegotiationPriceInput(''); setCounteringMessageId(null); setPriceOfferModalVisible(true); }}
                    >
                      <Feather name="tag" size={14} color={COLORS.primary} style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.primary }}>Offer Price</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.success + '15', paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.success }}
                    onPress={() => { setNegotiationTimeInput(''); setCounteringMessageId(null); setTimeOfferModalVisible(true); }}
                  >
                    <Feather name="clock" size={14} color={COLORS.success} style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.success }}>Offer Time</Text>
                  </TouchableOpacity>
                </View>
              )}

              {isClosed ? (
                <View style={{ backgroundColor: COLORS.border, padding: 10, borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' }}>Chat closed — service completed.</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <TextInput
                    style={{ flex: 1, height: 44, backgroundColor: isDarkMode ? '#222' : '#F1F5F9', borderRadius: 22, paddingHorizontal: 16, color: COLORS.textPrimary }}
                    placeholder="Type a message..."
                    placeholderTextColor={COLORS.textSecondary}
                    value={chatInputText}
                    onChangeText={setChatInputText}
                  />
                  <TouchableOpacity style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' }} onPress={handleSendMessage}>
                    <Feather name="send" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Price Offer Modal */}
      <Modal visible={isPriceOfferModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { width: '90%', maxWidth: 400, borderRadius: 20, padding: 20 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Feather name="tag" size={20} color={COLORS.primary} />
              <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.textPrimary }}>{counteringMessageId ? 'Counter Price' : 'Make Price Offer'}</Text>
            </View>
            <TextInput
              style={{ height: 50, backgroundColor: isDarkMode ? '#222' : '#F1F5F9', borderRadius: 10, paddingHorizontal: 16, fontSize: 15, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20 }}
              placeholder="Enter price in PKR (e.g. 2000)"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numeric"
              value={negotiationPriceInput}
              onChangeText={setNegotiationPriceInput}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end' }}>
              <TouchableOpacity style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: isDarkMode ? '#333' : '#E2E8F0' }}
                onPress={() => { setPriceOfferModalVisible(false); setNegotiationPriceInput(''); setCounteringMessageId(null); }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textPrimary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, backgroundColor: COLORS.primary }} onPress={submitInlinePriceOffer}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Submit Offer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Time Offer Modal */}
      <Modal visible={isTimeOfferModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { width: '90%', maxWidth: 400, borderRadius: 20, padding: 20 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Feather name="clock" size={20} color={COLORS.success} />
              <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.textPrimary }}>{counteringMessageId ? 'Counter Time' : 'Propose Time Slot'}</Text>
            </View>

            {/* Provider availability hint */}
            {providerAvailability?.startTime && providerAvailability?.endTime && (
              <View style={{ backgroundColor: 'rgba(168,85,247,0.10)', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(168,85,247,0.25)', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="info" size={13} color="#A855F7" />
                <Text style={{ fontSize: 11, color: '#A855F7', fontWeight: '700', flex: 1 }}>
                  Provider available:{' '}
                  <Text style={{ fontWeight: '900' }}>{providerAvailability.startTime}</Text>
                  {' '}to{' '}
                  <Text style={{ fontWeight: '900' }}>{providerAvailability.endTime}</Text>
                </Text>
              </View>
            )}

            <TextInput
              style={{ height: 50, backgroundColor: isDarkMode ? '#222' : '#F1F5F9', borderRadius: 10, paddingHorizontal: 16, fontSize: 15, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 }}
              placeholder="e.g. kal subah 8 bjy / tomorrow 11am"
              placeholderTextColor={COLORS.textSecondary}
              value={negotiationTimeInput}
              onChangeText={setNegotiationTimeInput}
              autoFocus
            />

            {/* Real-time parsed preview */}
            {parsedTimePreview ? (
              <View style={{ backgroundColor: 'rgba(16,185,129,0.10)', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Feather name="check-circle" size={12} color={COLORS.success} />
                <Text style={{ fontSize: 11, color: COLORS.success, fontWeight: '700', flex: 1 }} numberOfLines={2}>
                  Parsed: {parsedTimePreview}
                </Text>
              </View>
            ) : negotiationTimeInput.trim() ? (
              <View style={{ backgroundColor: 'rgba(245,158,11,0.10)', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Feather name="alert-circle" size={12} color={COLORS.warning} />
                <Text style={{ fontSize: 11, color: COLORS.warning, fontWeight: '700' }}>
                  Could not parse time. Select AM/PM below.
                </Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              {['AM', 'PM'].map(period => (
                <TouchableOpacity key={period}
                  style={{ flex: 1, height: 40, borderRadius: 8, borderWidth: 1, borderColor: negotiationTimeAmPm === period ? COLORS.success : COLORS.border, backgroundColor: negotiationTimeAmPm === period ? COLORS.success + '20' : (isDarkMode ? '#222' : '#F1F5F9'), justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => setNegotiationTimeAmPm(period)}>
                  <Text style={{ fontWeight: '700', color: negotiationTimeAmPm === period ? COLORS.success : COLORS.textPrimary }}>{period}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end' }}>
              <TouchableOpacity style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: isDarkMode ? '#333' : '#E2E8F0' }}
                onPress={() => { setTimeOfferModalVisible(false); setNegotiationTimeInput(''); setNegotiationTimeAmPm(null); setCounteringMessageId(null); }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textPrimary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, backgroundColor: COLORS.success }} onPress={submitInlineTimeOffer}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Submit Offer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
