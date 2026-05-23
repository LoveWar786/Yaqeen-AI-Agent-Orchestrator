import React from 'react';
import { View, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Modal, RefreshControl, Text, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { auth, db } from './src/services/firebase';
import { MapView, Marker, Polyline } from './src/components/MapViewHelper';
import { createElement } from 'react-native';

// Features
import ConfirmationModel from './src/features/ConfirmationModel';
import JobRoutingModal from './src/features/JobRoutingModal';
import AuthScreen from './src/features/AuthScreen';
import SettingsScreen from './src/features/SettingsScreen';
import HistoryScreen from './src/features/HistoryScreen';
import ServicesRateSheet from './src/features/ServicesRateSheet';
import ProviderDashboard from './src/features/ProviderDashboard';
import CustomerDashboard from './src/features/CustomerDashboard';
import TopHeader from './src/features/TopHeader';
import ChatModal from './src/features/ChatModal';
import NotificationsDrawer from './src/features/NotificationsDrawer';
import LocationSheet from './src/features/LocationSheet';
import ReceiptModal from './src/features/ReceiptModal';
import EmailVerificationManager from './src/features/EmailVerificationManager';
import OnboardingManager from './src/features/OnboardingManager';
import AgentTracingModal from './src/features/AgentTracingModal';
import { t } from './src/utils/translations';

// Reusable Components & Context Providers
import SplashScreen from './src/components/SplashScreen';
import ToastContainer from './src/components/ToastContainer';
import { ToastProvider, useToast } from './src/services/ToastContext';
import { AppProvider, useAppContext } from './src/services/AppContext';
import { getBackendUrl } from './src/services/api';
import { parseBookingTime, getTimeRemainingString } from './src/services/timeUtils';

function AppContent() {
  const {
    fontsLoaded,
    user,
    currentTab,
    setCurrentTab,
    inputText,
    setInputText,
    serviceMode,
    setServiceMode,
    useLocation,
    locationCoords,
    currentAddress,
    loading,
    setLoading,
    searchResult,
    finalBooking,
    typoSuggestion,
    originalTypoWord,
    error,
    success,
    bookings,
    availableJobs,
    myProviderJobs,
    allRegisteredProviders,
    historyLoading,
    pendingEmail,
    isConnected,
    isCheckingConnection,
    showTracingModal,
    setShowTracingModal,
    agentTracingLogs,
    isDarkMode,
    COLORS,
    styles,
    userProfile,
    isProviderMode,
    setIsProviderMode,
    dialogVisible,
    setDialogVisible,
    dialogConfig,
    showDatePicker,
    setShowDatePicker,
    showReceipt,
    setShowReceipt,
    receiptData,
    isVerifying,
    isEmailVerified,
    showOnboarding,
    setShowOnboarding,
    refreshing,
    showLocationSheet,
    setShowLocationSheet,
    activeAddress,
    imageUri,
    notificationsList,
    showNotificationsDrawer,
    setShowNotificationsDrawer,
    activeChatBooking,
    setActiveChatBooking,
    routingModalVisible,
    selectedRoutingJob,
    providerRouteCoords,
    providerDistance,
    providerDuration,
    clientRouteCoords,
    clientDistance,
    clientDuration,
    isPriceOfferModalVisible,
    negotiationPriceInput,
    counteringMessageId,
    isCustomerActiveBookingsExpanded,
    negotiationStep,
    historySortOrder,
    historyDateRange,
    historyStartDate,
    historyEndDate,
    tempPasswordRef,
    showEmailVerifiedBadge,
    isLoggingInRef,
    showSplash,
    onRefresh,
    checkConnection,
    submitSearch,
    confirmBooking,
    handleAcceptJob,
    submitInlinePriceOffer,
    handleNegotiateManually,
    pickImage,
    handleShowReceipt,
    handleCancelBooking,
    handleLogout,
    notifyAction,
  } = useAppContext();

  const { addToast } = useToast();

  const renderOfflineScreen = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, minHeight: 400 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.danger + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
        <Feather name="wifi-off" size={36} color={COLORS.danger} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8, textAlign: 'center' }}>
        No Internet Connection
      </Text>
      <Text style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 18 }}>
        Please check your network settings and try again to restore services.
      </Text>
      <TouchableOpacity 
        style={[styles.button, { minWidth: 150, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }]} 
        onPress={checkConnection}
        disabled={isCheckingConnection}
      >
        {isCheckingConnection ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Feather name="refresh-cw" size={14} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.buttonText}>Try Again</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  if (!fontsLoaded) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D0D0D' }]}>
        <ActivityIndicator size="large" color="#6B21A8" />
      </View>
    );
  }

  if (isVerifying) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 20, color: COLORS.textPrimary, fontWeight: '700' }}>Finalizing Email Verification...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1 }}>
        <AuthScreen 
          isDarkMode={isDarkMode}
          COLORS={COLORS}
          styles={styles}
          db={db}
          auth={auth}
          loading={loading}
          setLoading={setLoading}
          setUser={setUser}
          setIsProviderMode={setIsProviderMode}
          addToast={addToast}
          getBackendUrl={getBackendUrl}
          notifyAction={notifyAction}
          isLoggingInRef={isLoggingInRef}
        />
        {showSplash && <SplashScreen onAnimationComplete={() => setShowSplash(false)} />}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ToastContainer isDarkMode={isDarkMode} />

      {!showSplash && (
        <TopHeader
          currentTab={currentTab}
          user={user}
          userProfile={userProfile}
          isDarkMode={isDarkMode}
          COLORS={COLORS}
          styles={styles}
          db={db}
          isProviderMode={isProviderMode}
          setIsProviderMode={setIsProviderMode}
          notificationsList={notificationsList}
          onBellPress={() => setShowNotificationsDrawer(true)}
          onThemeToggle={() => setIsDarkMode(!isDarkMode)}
          onLogout={handleLogout}
          addToast={addToast}
        />
      )}

      <EmailVerificationManager 
        isEmailVerified={isEmailVerified}
        setIsEmailVerified={setIsEmailVerified}
        auth={auth}
        addToast={addToast}
        COLORS={COLORS}
        styles={styles}
        userProfile={userProfile}
      />

      {!isProviderMode && currentTab === 'home' && (
        <TouchableOpacity 
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: COLORS.card,
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderBottomWidth: 1,
            borderBottomColor: COLORS.border,
            justifyContent: 'space-between',
          }}
          onPress={() => setShowLocationSheet(true)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 }}>
            <Feather name="map-pin" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: COLORS.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {activeAddress ? activeAddress.label : 'Reach to'}
              </Text>
              <Text style={{ fontSize: 13, color: COLORS.textPrimary, fontWeight: '600' }} numberOfLines={1}>
                {activeAddress ? activeAddress.address : (currentAddress || 'Select Service Location')}
              </Text>
            </View>
          </View>
          <Feather name="chevron-down" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>
      )}

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {success && (
          <View style={styles.successCard}>
            <Text style={styles.successText}>{success}</Text>
          </View>
        )}

        {currentTab === 'home' && (
          !isConnected ? renderOfflineScreen() : (
            isProviderMode ? (
              <ProviderDashboard 
                user={user}
                userProfile={userProfile}
                isEmailVerified={isEmailVerified}
                setUserProfile={setUserProfile}
                setIsProviderMode={setIsProviderMode}
                db={db}
                isDarkMode={isDarkMode}
                COLORS={COLORS}
                styles={styles}
                getShadow={getShadow}
                addToast={addToast}
                getBackendUrl={getBackendUrl}
                availableJobs={availableJobs}
                myProviderJobs={myProviderJobs}
                handleAcceptJob={handleAcceptJob}
                setActiveChatBooking={setActiveChatBooking}
                setSelectedRoutingJob={setSelectedRoutingJob}
                setRoutingModalVisible={setRoutingModalVisible}
                parseBookingTime={parseBookingTime}
                getTimeRemainingString={getTimeRemainingString}
                sendNotification={sendNotification}
                darkMapStyle={darkMapStyle}
                MapView={MapView}
                Marker={Marker}
              />
            ) : (
              <CustomerDashboard 
                user={user}
                userProfile={userProfile}
                showTracingLogs={() => setShowTracingModal(true)}
                isEmailVerified={isEmailVerified}
                bookings={bookings}
                isCustomerActiveBookingsExpanded={isCustomerActiveBookingsExpanded}
                setCustomerActiveBookingsExpanded={setCustomerActiveBookingsExpanded}
                searchResult={searchResult}
                setSearchResult={setSearchResult}
                finalBooking={finalBooking}
                setFinalBooking={setFinalBooking}
                inputText={inputText}
                setInputText={setInputText}
                pickImage={pickImage}
                imageUri={imageUri}
                setImageUri={setImageUri}
                setImageBase64={setImageBase64}
                serviceMode={serviceMode}
                setServiceMode={setServiceMode}
                getBackendUrl={getBackendUrl}
                typoSuggestion={typoSuggestion}
                setTypoSuggestion={setTypoSuggestion}
                originalTypoWord={originalTypoWord}
                setOriginalTypoWord={setOriginalTypoWord}
                activeAddress={activeAddress}
                currentAddress={currentAddress}
                locationCoords={locationCoords}
                pinnedCoords={pinnedCoords}
                submitSearch={submitSearch}
                loading={loading}
                fadeAnim={fadeAnim}
                isDarkMode={isDarkMode}
                COLORS={COLORS}
                styles={styles}
                getShadow={getShadow}
                addToast={addToast}
                confirmBooking={confirmBooking}
                handleNegotiateManually={handleNegotiateManually}
                negotiationStep={negotiationStep}
                setNegotiationStep={setNegotiationStep}
                allRegisteredProviders={allRegisteredProviders}
                clientDistance={clientDistance}
                clientDuration={clientDuration}
                clientRouteCoords={clientRouteCoords}
                setActiveChatBooking={setActiveChatBooking}
                setCurrentTab={setCurrentTab}
                handleShowReceipt={handleShowReceipt}
                darkMapStyle={darkMapStyle}
                MapView={MapView}
                Marker={Marker}
                Polyline={Polyline}
              />
            )
          )
        )}

        {currentTab === 'services' && (
          <ServicesRateSheet 
            user={user}
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            isDarkMode={isDarkMode}
            COLORS={COLORS}
            styles={styles}
            db={db}
            addToast={addToast}
          />
        )}

        {currentTab === 'history' && (
          !isConnected ? renderOfflineScreen() : (
            <HistoryScreen 
              isDarkMode={isDarkMode}
              COLORS={COLORS}
              styles={styles}
              isProviderMode={isProviderMode}
              myProviderJobs={myProviderJobs}
              bookings={bookings}
              historySortOrder={historySortOrder}
              setHistorySortOrder={setHistorySortOrder}
              historyDateRange={historyDateRange}
              setHistoryDateRange={setHistoryDateRange}
              historyStartDate={historyStartDate}
              setHistoryStartDate={setHistoryStartDate}
              historyEndDate={historyEndDate}
              setHistoryEndDate={setHistoryEndDate}
              historyLoading={historyLoading}
              handleShowReceipt={handleShowReceipt}
              setActiveChatBooking={setActiveChatBooking}
              handleCancelBooking={handleCancelBooking}
              getShadow={getShadow}
              parseBookingTime={parseBookingTime}
              getTimeRemainingString={getTimeRemainingString}
              createElement={createElement}
            />
          )
        )}

        {currentTab === 'profile' && (
          <SettingsScreen 
            user={user}
            userProfile={userProfile}
            setUser={setUser}
            setUserProfile={setUserProfile}
            isDarkMode={isDarkMode}
            COLORS={COLORS}
            styles={styles}
            db={db}
            auth={auth}
            addToast={addToast}
            getBackendUrl={getBackendUrl}
            notifyAction={notifyAction}
            pendingEmail={pendingEmail}
            setPendingEmail={setPendingEmail}
            showEmailVerifiedBadge={showEmailVerifiedBadge}
            setShowEmailVerifiedBadge={setShowEmailVerifiedBadge}
            tempPasswordRef={tempPasswordRef}
            setDialogConfig={setDialogConfig}
            setDialogVisible={setDialogVisible}
            setCurrentTab={setCurrentTab}
          />
        )}
      </ScrollView>

      {!showSplash && (
        <View style={styles.bottomNav}>
          <TouchableOpacity style={[styles.navItem, currentTab === 'home' && styles.navItemActive]} onPress={() => setCurrentTab('home')}>
            <Feather name="home" size={24} color={currentTab === 'home' ? COLORS.primary : COLORS.textSecondary} />
            <Text style={[styles.navText, currentTab === 'home' && styles.navTextActive]}>
              {t('home', userProfile?.language || 'ENGLISH')}
            </Text>
          </TouchableOpacity>

          {isProviderMode && (
            <TouchableOpacity style={[styles.navItem, currentTab === 'services' && styles.navItemActive]} onPress={() => setCurrentTab('services')}>
              <Feather name="briefcase" size={24} color={currentTab === 'services' ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[styles.navText, currentTab === 'services' && styles.navTextActive]}>
                {t('services', userProfile?.language || 'ENGLISH')}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.navItem, currentTab === 'history' && styles.navItemActive]} onPress={() => setCurrentTab('history')}>
            <Feather name="list" size={24} color={currentTab === 'history' ? COLORS.primary : COLORS.textSecondary} />
            <Text style={[styles.navText, currentTab === 'history' && styles.navTextActive]}>
              {t('history', userProfile?.language || 'ENGLISH')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.navItem, currentTab === 'profile' && styles.navItemActive]} onPress={() => setCurrentTab('profile')}>
            <Feather name="user" size={24} color={currentTab === 'profile' ? COLORS.primary : COLORS.textSecondary} />
            <Text style={[styles.navText, currentTab === 'profile' && styles.navTextActive]}>
              {t('account', userProfile?.language || 'ENGLISH')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ConfirmationModel 
        visible={dialogVisible} 
        config={dialogConfig} 
        setVisible={setDialogVisible} 
        COLORS={COLORS} 
        styles={styles} 
      />

      {showDatePicker && (
        <Modal transparent={true} visible={true} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { width: '90%', maxWidth: 350 }]}>
              <Text style={styles.modalTitle}>Select Time</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {['09:00 AM', '12:00 PM', '03:00 PM', '06:00 PM'].map((t) => (
                  <TouchableOpacity key={t} style={styles.secondaryButton} onPress={() => { setInputText(prev => prev + ` at ${t}`); setShowDatePicker(false); submitSearch(); }}>
                    <Text style={styles.secondaryButtonText}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.button} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <ReceiptModal
        visible={showReceipt}
        onClose={() => setShowReceipt(false)}
        receiptData={receiptData}
        COLORS={COLORS}
        styles={styles}
        addToast={addToast}
        isDarkMode={isDarkMode}
      />

      <JobRoutingModal 
        visible={routingModalVisible}
        onClose={() => { setRoutingModalVisible(false); setSelectedRoutingJob(null); }}
        selectedRoutingJob={selectedRoutingJob}
        isDarkMode={isDarkMode}
        isProviderMode={isProviderMode}
        COLORS={COLORS}
        styles={styles}
        providerDistance={providerDistance}
        providerDuration={providerDuration}
        locationCoords={locationCoords}
        userProfile={userProfile}
        providerRouteCoords={providerRouteCoords}
        darkMapStyle={darkMapStyle}
      />

      <ChatModal
        activeChatBooking={activeChatBooking}
        onClose={() => setActiveChatBooking(null)}
        user={user}
        userProfile={userProfile}
        db={db}
        isProviderMode={isProviderMode}
        isDarkMode={isDarkMode}
        COLORS={COLORS}
        styles={styles}
        addToast={addToast}
        sendNotification={sendNotification}
        allRegisteredProviders={allRegisteredProviders}
      />

      <Modal visible={isPriceOfferModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { width: '90%', maxWidth: 400, borderRadius: 20, padding: 20 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Feather name="tag" size={20} color={COLORS.primary} />
              <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.textPrimary }}>
                {counteringMessageId ? "Counter Price Offer" : "Make Price Offer"}
              </Text>
            </View>
            
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 }}>
              {counteringMessageId ? "Enter your counter price proposal for this service job:" : "Enter your proposed price for this service job:"}
            </Text>

            <TextInput
              style={{
                height: 50,
                backgroundColor: isDarkMode ? '#222' : '#F1F5F9',
                borderRadius: 10,
                paddingHorizontal: 16,
                fontSize: 15,
                color: COLORS.textPrimary,
                borderWidth: 1,
                borderColor: COLORS.border,
                marginBottom: 20
              }}
              placeholder="Enter price in PKR (e.g. 2000)"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numeric"
              value={negotiationPriceInput}
              onChangeText={setNegotiationPriceInput}
              autoFocus
            />

            <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end' }}>
              <TouchableOpacity
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  backgroundColor: isDarkMode ? '#333' : '#E2E8F0'
                }}
                onPress={() => {
                  setPriceOfferModalVisible(false);
                  setNegotiationPriceInput('');
                  setCounteringMessageId(null);
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textPrimary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 10,
                  backgroundColor: COLORS.primary
                }}
                onPress={submitInlinePriceOffer}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Submit Offer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <NotificationsDrawer
        visible={showNotificationsDrawer}
        onClose={() => setShowNotificationsDrawer(false)}
        notificationsList={notificationsList}
        user={user}
        db={db}
        isDarkMode={isDarkMode}
        COLORS={COLORS}
        styles={styles}
        addToast={addToast}
        setActiveChatBooking={setActiveChatBooking}
        setIsChatContextMode={setIsChatContextMode}
      />

      <LocationSheet
        visible={showLocationSheet}
        onClose={() => setShowLocationSheet(false)}
        user={user}
        db={db}
        activeAddress={activeAddress}
        setActiveAddress={setActiveAddress}
        isDarkMode={isDarkMode}
        COLORS={COLORS}
        styles={styles}
        addToast={addToast}
        getBackendUrl={getBackendUrl}
        MapView={MapView}
        Marker={Marker}
        darkMapStyle={darkMapStyle}
      />

      <OnboardingManager 
        visible={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        db={db}
        user={user}
        userProfile={userProfile}
        setUserProfile={setUserProfile}
        isDarkMode={isDarkMode}
        COLORS={COLORS}
        styles={styles}
        addToast={addToast}
      />

      <AgentTracingModal
        visible={showTracingModal}
        onClose={() => setShowTracingModal(false)}
        logs={agentTracingLogs}
        onClear={() => setAgentTracingLogs([])}
        isDarkMode={isDarkMode}
        COLORS={COLORS}
        addToast={addToast}
      />
      {showSplash && <SplashScreen onAnimationComplete={() => setShowSplash(false)} />}
    </View>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ToastProvider>
  );
}