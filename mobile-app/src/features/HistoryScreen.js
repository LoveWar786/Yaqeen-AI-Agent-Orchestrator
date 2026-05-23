import React, { useState } from 'react';
import { Text, View, TextInput, TouchableOpacity, ActivityIndicator, Platform, ScrollView, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function HistoryScreen({
  isDarkMode,
  COLORS,
  styles,
  isProviderMode,
  myProviderJobs,
  bookings,
  historySortOrder,
  setHistorySortOrder,
  historyDateRange,
  setHistoryDateRange,
  historyStartDate,
  setHistoryStartDate,
  historyEndDate,
  setHistoryEndDate,
  historyLoading,
  handleShowReceipt,
  setActiveChatBooking,
  handleCancelBooking,
  getShadow,
  parseBookingTime,
  getTimeRemainingString,
  createElement
}) {
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [isUpcomingJobsExpanded, setUpcomingJobsExpanded] = useState(true);
  const [isPastJobsExpanded, setPastJobsExpanded] = useState(true);

  const allJobs = isProviderMode ? myProviderJobs : bookings;
  
  // Filter by Date Range if selected
  const dateFiltered = allJobs.filter(b => {
    if (historyDateRange !== 'all') {
      const bDate = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date();
      const now = new Date();
      if (historyDateRange === 'today') {
        if (bDate.toDateString() !== now.toDateString()) return false;
      } else if (historyDateRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (bDate < weekAgo) return false;
      } else if (historyDateRange === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (bDate < monthAgo) return false;
      } else if (historyDateRange === 'custom') {
        if (historyStartDate && bDate < new Date(historyStartDate)) return false;
        if (historyEndDate) {
          const end = new Date(historyEndDate);
          end.setHours(23, 59, 59);
          if (bDate > end) return false;
        }
      }
    }
    return true;
  });

  // Split into Upcoming vs Past (Completed/Cancelled/Rejected)
  const upcomingJobs = dateFiltered.filter(b => {
    const status = b.status?.toUpperCase();
    return !(status === 'COMPLETED' || status === 'CANCELLED' || status === 'CANCELLED_BY_USER' || status === 'REJECTED');
  }).sort((a, b) => {
    const timeA = parseBookingTime(a.time, a.createdAt).getTime();
    const timeB = parseBookingTime(b.time, b.createdAt).getTime();
    return timeA - timeB;
  });

  const pastJobs = dateFiltered.filter(b => {
    const status = b.status?.toUpperCase();
    return (status === 'COMPLETED' || status === 'CANCELLED' || status === 'CANCELLED_BY_USER' || status === 'REJECTED');
  }).sort((a, b) => {
    const timeA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
    const timeB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
    return historySortOrder === 'newest' ? timeB - timeA : timeA - timeB;
  });

  const renderJobCard = (b) => {
    const bTime = parseBookingTime(b.time, b.createdAt);
    const timeRemainingStr = getTimeRemainingString(bTime);
    const isOverdue = bTime.getTime() - Date.now() < 0;

    return (
      <View key={b.id} style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.sectionTitle}>{b.service}</Text>
          <Text style={[styles.infoLabel, { 
            color: (['UPCOMING', 'PENDING', 'CONFIRMED', 'DISPATCHED', 'NEGOTIATING', 'NEGOTIATION', 'BOOKED'].includes(b.status?.toUpperCase())) ? COLORS.primary : (b.status?.toUpperCase() === 'COMPLETED') ? '#10B981' : COLORS.danger 
          }]}>{b.status}</Text>
        </View>
        <Text style={styles.infoLabel}>{isProviderMode ? `Customer: ${b.customerName || 'Client'}` : (b.providerName || 'Provider')}</Text>
        <Text style={[styles.infoValue, { textAlign: 'left', marginTop: 4 }]}>Time: {b.time}</Text>

        {!(b.status?.toUpperCase() === 'COMPLETED' || b.status?.toUpperCase() === 'CANCELLED' || b.status?.toUpperCase() === 'CANCELLED_BY_USER' || b.status?.toUpperCase() === 'REJECTED') && (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isOverdue ? COLORS.danger + '15' : COLORS.primary + '10', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: isOverdue ? COLORS.danger + '30' : COLORS.primary + '20' }}>
            <Feather name="clock" size={12} color={isOverdue ? COLORS.danger : COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: isOverdue ? COLORS.danger : COLORS.primary }}>
              {timeRemainingStr}
            </Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', marginTop: 16, gap: 12, flexWrap: 'wrap' }}>
          <TouchableOpacity 
            style={[styles.secondaryButton, { flex: 1, minWidth: 80, borderColor: COLORS.primary }]} 
            onPress={() => handleShowReceipt(b)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="file-text" size={14} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.secondaryButtonText, { color: COLORS.primary }]}>Receipt</Text>
            </View>
          </TouchableOpacity>

          {['NEGOTIATING', 'NEGOTIATION', 'BOOKED', 'CONFIRMED', 'DISPATCHED'].includes(b.status?.toUpperCase()) && (
            <TouchableOpacity 
              style={[styles.secondaryButton, { flex: 1, minWidth: 80, borderColor: COLORS.primary }]} 
              onPress={() => setActiveChatBooking(b)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="message-square" size={14} color={COLORS.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.secondaryButtonText, { color: COLORS.primary }]}>Chat</Text>
              </View>
            </TouchableOpacity>
          )}

          {(['UPCOMING', 'PENDING', 'CONFIRMED', 'DISPATCHED', 'NEGOTIATING', 'NEGOTIATION', 'BOOKED'].includes(b.status?.toUpperCase())) && (
            <TouchableOpacity style={[styles.secondaryButton, { flex: 1, minWidth: 80, borderColor: COLORS.danger }]} onPress={() => handleCancelBooking(b.id)}>
              <Text style={[styles.secondaryButtonText, { color: COLORS.danger }]}>{isProviderMode ? 'Cancel Job' : 'Cancel'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ paddingHorizontal: 20 }}>
      {/* Header Title */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.textPrimary }}>
          My History & Bookings
        </Text>
      </View>

      {/* Sorting & Date Filters */}
      <View style={{ flexDirection: 'row', marginBottom: 20, gap: 8, alignItems: 'center', zIndex: 10 }}>
        <View style={{ position: 'relative', zIndex: 100 }}>
          <TouchableOpacity 
            onPress={() => setShowSortDropdown(!showSortDropdown)}
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 6,
              paddingHorizontal: 12, 
              paddingVertical: 8, 
              backgroundColor: isDarkMode ? '#111' : '#F1F5F9', 
              borderRadius: 8, 
              borderWidth: 1, 
              borderColor: COLORS.border 
            }}
          >
            <Text style={{ fontSize: 11, color: COLORS.textPrimary, fontWeight: '700' }}>
              Sort: {historySortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
            </Text>
            <Feather name="chevron-down" size={12} color={COLORS.textPrimary} />
          </TouchableOpacity>
          {showSortDropdown && (
            <View style={{ 
              position: 'absolute', 
              top: 36, 
              left: 0, 
              right: 0, 
              backgroundColor: COLORS.card, 
              borderRadius: 8, 
              borderWidth: 1, 
              borderColor: COLORS.border,
              ...getShadow('#000', 0, 4, 0.1, 8, 5),
              zIndex: 200, 
              minWidth: 120 
            }}>
              <TouchableOpacity 
                onPress={() => { setHistorySortOrder('newest'); setShowSortDropdown(false); }}
                style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border }}
              >
                <Text style={{ fontSize: 11, color: historySortOrder === 'newest' ? COLORS.primary : COLORS.textPrimary, fontWeight: '700' }}>Newest First</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => { setHistorySortOrder('oldest'); setShowSortDropdown(false); }}
                style={{ padding: 10 }}
              >
                <Text style={{ fontSize: 11, color: historySortOrder === 'oldest' ? COLORS.primary : COLORS.textPrimary, fontWeight: '700' }}>Oldest First</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <View style={{ position: 'relative', zIndex: 100 }}>
          <TouchableOpacity 
            onPress={() => setShowDateDropdown(!showDateDropdown)}
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 6,
              paddingHorizontal: 12, 
              paddingVertical: 8, 
              backgroundColor: isDarkMode ? '#111' : '#F1F5F9', 
              borderRadius: 8, 
              borderWidth: 1, 
              borderColor: COLORS.border 
            }}
          >
            <Text style={{ fontSize: 11, color: COLORS.textPrimary, fontWeight: '700', textTransform: 'capitalize' }}>
              Range: {historyDateRange}
            </Text>
            <Feather name="chevron-down" size={12} color={COLORS.textPrimary} />
          </TouchableOpacity>
          {showDateDropdown && (
            <View style={{ 
              position: 'absolute', 
              top: 36, 
              left: 0, 
              right: 0, 
              backgroundColor: COLORS.card, 
              borderRadius: 8, 
              borderWidth: 1, 
              borderColor: COLORS.border,
              ...getShadow('#000', 0, 4, 0.1, 8, 5),
              zIndex: 200, 
              minWidth: 120 
            }}>
              {['all', 'today', 'week', 'month', 'custom'].map((range, idx, arr) => (
                <TouchableOpacity 
                  key={range}
                  onPress={() => { setHistoryDateRange(range); setShowDateDropdown(false); }}
                  style={{ 
                    padding: 10, 
                    borderBottomWidth: idx === arr.length - 1 ? 0 : 1, 
                    borderBottomColor: COLORS.border 
                  }}
                >
                  <Text style={{ fontSize: 11, color: historyDateRange === range ? COLORS.primary : COLORS.textPrimary, fontWeight: '700', textTransform: 'capitalize' }}>
                    {range}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {historyDateRange === 'custom' && (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20, alignItems: 'center' }}>
          {Platform.OS === 'web' ? (
            createElement('input', {
              type: 'date',
              value: historyStartDate,
              onChange: (e) => setHistoryStartDate(e.target.value),
              style: {
                backgroundColor: COLORS.input,
                color: COLORS.textPrimary,
                borderRadius: 8,
                paddingHorizontal: 10,
                height: 36,
                fontSize: 11,
                borderWidth: 1,
                borderColor: COLORS.border,
                outline: 'none',
                flex: 1,
                minWidth: 120
              }
            })
          ) : (
            <TextInput 
              style={[styles.compactInput, { backgroundColor: COLORS.input, borderRadius: 8, paddingHorizontal: 10, height: 36, fontSize: 11 }]} 
              placeholder="Start (YYYY-MM-DD)" 
              placeholderTextColor={COLORS.textSecondary}
              value={historyStartDate}
              onChangeText={setHistoryStartDate}
            />
          )}
          <Text style={{ color: COLORS.textSecondary }}>to</Text>
          {Platform.OS === 'web' ? (
            createElement('input', {
              type: 'date',
              value: historyEndDate,
              onChange: (e) => setHistoryEndDate(e.target.value),
              style: {
                backgroundColor: COLORS.input,
                color: COLORS.textPrimary,
                borderRadius: 8,
                paddingHorizontal: 10,
                height: 36,
                fontSize: 11,
                borderWidth: 1,
                borderColor: COLORS.border,
                outline: 'none',
                flex: 1,
                minWidth: 120
              }
            })
          ) : (
            <TextInput 
              style={[styles.compactInput, { backgroundColor: COLORS.input, borderRadius: 8, paddingHorizontal: 10, height: 36, fontSize: 11 }]} 
              placeholder="End (YYYY-MM-DD)" 
              placeholderTextColor={COLORS.textSecondary}
              value={historyEndDate}
              onChangeText={setHistoryEndDate}
            />
          )}
        </View>
      )}

      {historyLoading ? (
        <ActivityIndicator color={COLORS.nav} size="large" style={{ marginTop: 50 }} />
      ) : (
        <View style={{ gap: 20, marginBottom: 40 }}>
          {/* Upcoming Jobs Collapsible Section */}
          <View>
            <TouchableOpacity 
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingVertical: 4 }}
              onPress={() => setUpcomingJobsExpanded(!isUpcomingJobsExpanded)}
            >
              <Text style={[styles.sectionTitle, { fontSize: 16, marginBottom: 0 }]}>
                Upcoming Jobs ({upcomingJobs.length})
              </Text>
              <Feather 
                name={isUpcomingJobsExpanded ? "chevron-up" : "chevron-down"} 
                size={18} 
                color={COLORS.textPrimary} 
              />
            </TouchableOpacity>
            {isUpcomingJobsExpanded && (
              <View style={{ gap: 12 }}>
                {upcomingJobs.length > 0 ? upcomingJobs.map(renderJobCard) : (
                  <View style={{ padding: 20, alignItems: 'center', backgroundColor: isDarkMode ? '#111' : '#F8FAFC', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.border }}>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>No upcoming {isProviderMode ? 'jobs' : 'bookings'} found.</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Past Jobs Collapsible Section */}
          <View>
            <TouchableOpacity 
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingVertical: 4 }}
              onPress={() => setPastJobsExpanded(!isPastJobsExpanded)}
            >
              <Text style={[styles.sectionTitle, { fontSize: 16, marginBottom: 0 }]}>
                Past Jobs ({pastJobs.length})
              </Text>
              <Feather 
                name={isPastJobsExpanded ? "chevron-up" : "chevron-down"} 
                size={18} 
                color={COLORS.textPrimary} 
              />
            </TouchableOpacity>
            {isPastJobsExpanded && (
              <View style={{ gap: 12 }}>
                {pastJobs.length > 0 ? pastJobs.map(renderJobCard) : (
                  <View style={{ padding: 20, alignItems: 'center', backgroundColor: isDarkMode ? '#111' : '#F8FAFC', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.border }}>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>No past {isProviderMode ? 'jobs' : 'bookings'} found.</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
