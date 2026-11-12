import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { BRAND, NavProvider } from '../config/brand';
import { useCastSession } from '../context/CastSessionContext';

interface NavigationLandingScreenProps {
  onOpenParkedLounge: () => void;
  onOpenVoiceModal: () => void;
}

const ROUTE_OPTIONS = [
  {
    id: 0,
    badge: 'FASTEST',
    title: 'Via Highway 401 Express',
    etaMin: 14,
    distMiles: '6.8 mi',
    distKm: '10.9 km',
    trafficLabel: 'Light traffic · Clear',
  },
  {
    id: 1,
    badge: 'NO TOLLS',
    title: 'Via Queensway Blvd East',
    etaMin: 18,
    distMiles: '6.1 mi',
    distKm: '9.8 km',
    trafficLabel: 'No tolls · Smooth',
  },
  {
    id: 2,
    badge: 'SCENIC',
    title: 'Via Lakeshore Scenic Drive',
    etaMin: 21,
    distMiles: '7.4 mi',
    distKm: '11.9 km',
    trafficLabel: 'Moderate traffic',
  },
];

const QUICK_POIS = [
  {
    label: '🅿️ Nearby Parking',
    dest: 'Queensway Municipal Parking Plaza (64 Open Bays)',
    color: '#EFF6FF',
    textColor: '#1D4ED8',
  },
  {
    label: '⚡ EV Chargers',
    dest: 'Downtown EV Supercharger Plaza (8 Fast Stalls)',
    color: '#ECFDF5',
    textColor: '#047857',
  },
  {
    label: '⛽ Rest Stops',
    dest: 'Highway 401 Service & Rest Plaza',
    color: '#FEF3C7',
    textColor: '#B45309',
  },
  {
    label: '✈️ Airport',
    dest: 'International Airport Terminal 1 Parking',
    color: '#F3E8FF',
    textColor: '#6D28D9',
  },
];

export const NavigationLandingScreen: React.FC<NavigationLandingScreenProps> = ({
  onOpenParkedLounge,
  onOpenVoiceModal,
}) => {
  const {
    roomCode,
    relayConnected,
    relayHost,
    speedUnit,
    navProvider,
    navDestination,
    selectedRouteIndex,
    lastVoiceReply,
    connectToCarReceiver,
    healCarConnection,
    toggleSpeedUnit,
    setNavProvider,
    setNavDestination,
    setSelectedRouteIndex,
    launchExternalNavigation,
    setCarActiveTab,
  } = useCastSession();

  const [destInput, setDestInput] = useState(navDestination);
  const [pinInput, setPinInput] = useState(roomCode);
  const [relayHostInput, setRelayHostInput] = useState(relayHost);
  const [showConnBox, setShowConnBox] = useState(false);

  const activeRoute = ROUTE_OPTIONS[selectedRouteIndex] || ROUTE_OPTIONS[0];

  const handleStartRoute = () => {
    const clean = destInput.trim() || navDestination;
    setNavDestination(clean);
    setCarActiveTab('map');
    launchExternalNavigation(navProvider, clean);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Clean Navigation Header */}
      <View style={styles.headerRow}>
        <View style={styles.brandRow}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>P</Text>
          </View>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.brandTitle} numberOfLines={1} adjustsFontSizeToFit>
              ParkCast Navigation
            </Text>
            <Text style={styles.brandSubtitle} numberOfLines={1}>
              Turn-by-Turn Route Guidance & Parking
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            testID="landing-speed-unit-btn"
            style={styles.unitBtn}
            onPress={toggleSpeedUnit}
          >
            <Text style={styles.unitBtnText}>{speedUnit.toUpperCase()}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="landing-voice-btn"
            style={styles.voiceBtn}
            onPress={onOpenVoiceModal}
          >
            <Text style={styles.voiceBtnText}>🎤 Voice</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* CarPlay Display Connection Bar */}
      <View style={styles.connCard}>
        <View style={styles.connRow}>
          <View style={styles.connLeft}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: relayConnected ? '#10B981' : '#2563EB' },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.connTitle}>
                CarPlay Display Connected · Code {roomCode}
              </Text>
              <Text style={styles.connSub}>
                0 {speedUnit.toUpperCase()} · Vehicle Parked · GPS High Accuracy
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity style={styles.resyncBtn} onPress={healCarConnection}>
              <Text style={styles.resyncBtnText}>Sync</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.setupBtn}
              onPress={() => setShowConnBox(!showConnBox)}
            >
              <Text style={styles.setupBtnText}>
                {showConnBox ? 'Close' : 'Setup'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {showConnBox && (
          <View style={styles.connExpand}>
            <Text style={styles.inputLabel}>4-Digit Car Display Code</Text>
            <TextInput
              style={styles.input}
              value={pinInput}
              onChangeText={setPinInput}
              placeholder="4829"
            />
            <Text style={styles.inputLabel}>Car Display Address (Cloud or Wi-Fi)</Text>
            <TextInput
              style={styles.input}
              value={relayHostInput}
              onChangeText={setRelayHostInput}
              autoCapitalize="none"
            />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              <TouchableOpacity
                style={[styles.setupBtn, { flex: 1, alignItems: 'center' }]}
                onPress={() => setRelayHostInput('parkcast-x9nd.onrender.com')}
              >
                <Text style={styles.setupBtnText}>☁️ Cloud (5G Anywhere)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.setupBtn, { flex: 1, alignItems: 'center' }]}
                onPress={() => setRelayHostInput('10.0.0.87:4848')}
              >
                <Text style={styles.setupBtnText}>🏠 Home Wi-Fi</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                connectToCarReceiver(pinInput, undefined, relayHostInput);
                setShowConnBox(false);
              }}
            >
              <Text style={styles.primaryBtnText}>Save & Connect to CarPlay</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Live Turn-by-Turn Maneuver Banner (Matches CarPlay CPManeuver) */}
      <View style={styles.maneuverBanner}>
        <View style={styles.maneuverIconBox}>
          <Text style={styles.maneuverArrow}>↱</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.maneuverTopLine}>
            <Text style={styles.maneuverDist}>
              {speedUnit === 'mph' ? '0.4 mi' : '650 m'} · Turn Right
            </Text>
            <View style={styles.parkedPill}>
              <Text style={styles.parkedPillText}>
                0 {speedUnit.toUpperCase()} · PARKED
              </Text>
            </View>
          </View>
          <Text style={styles.maneuverStreet}>Queensway Blvd East</Text>
          <Text style={styles.maneuverNext}>
            Then in {speedUnit === 'mph' ? '1.8 mi' : '2.9 km'}: Take Exit 14B Downtown
          </Text>
        </View>
      </View>

      {/* Destination Search & Voice Input */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { flex: 1, marginRight: 6 }]} numberOfLines={1}>
            Where would you like to drive?
          </Text>
          <TouchableOpacity onPress={onOpenVoiceModal}>
            <Text style={styles.voiceLink}>🎤 Speak</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            testID="nav-destination-input"
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            value={destInput}
            onChangeText={(val) => {
              setDestInput(val);
              setNavDestination(val);
            }}
            placeholder="Search address, parking, or EV charger..."
            placeholderTextColor="#94A3B8"
          />
          <TouchableOpacity
            testID="nav-search-go-btn"
            style={styles.goBtn}
            onPress={() => {
              setNavDestination(destInput);
              setCarActiveTab('map');
            }}
          >
            <Text style={styles.goBtnText}>Preview</Text>
          </TouchableOpacity>
        </View>

        {/* 1-Tap Quick POI Categories (CPPointOfInterestTemplate) */}
        <View style={styles.poiGrid}>
          {QUICK_POIS.map((poi) => (
            <TouchableOpacity
              key={poi.label}
              style={[styles.poiChip, { backgroundColor: poi.color }]}
              onPress={() => {
                setDestInput(poi.dest);
                setNavDestination(poi.dest);
                setCarActiveTab('map');
              }}
            >
              <Text style={[styles.poiChipText, { color: poi.textColor }]}>
                {poi.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Preferred Map Engine Switcher (Apple Maps · Waze · Google Maps) */}
        <Text style={styles.subLabel}>Preferred Navigation Engine</Text>
        <View style={styles.providerRow}>
          {(
            [
              { id: 'apple_maps', label: 'Apple Maps' },
              { id: 'waze', label: 'Waze' },
              { id: 'google_maps', label: 'Google Maps' },
            ] as { id: NavProvider; label: string }[]
          ).map((p) => {
            const active = navProvider === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.providerPill, active && styles.providerPillActive]}
                onPress={() => setNavProvider(p.id)}
              >
                <Text
                  style={[
                    styles.providerPillText,
                    active && styles.providerPillTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Route Preview & Trip Selection (CPTripPreviewTextConfiguration) */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Select Route (3 Options Found)</Text>
          <Text style={styles.etaHighlight}>
            {activeRoute.etaMin} min ({speedUnit === 'mph' ? activeRoute.distMiles : activeRoute.distKm})
          </Text>
        </View>

        {ROUTE_OPTIONS.map((rt) => {
          const isSelected = selectedRouteIndex === rt.id;
          return (
            <TouchableOpacity
              key={rt.id}
              testID={`route-option-${rt.id}`}
              style={[styles.routeCard, isSelected && styles.routeCardSelected]}
              onPress={() => setSelectedRouteIndex(rt.id)}
            >
              <View style={{ flex: 1, paddingRight: 6 }}>
                <View style={styles.routeTopLine}>
                  <View
                    style={[
                      styles.routeBadge,
                      isSelected ? styles.routeBadgeSelected : styles.routeBadgeMuted,
                    ]}
                  >
                    <Text
                      style={[
                        styles.routeBadgeText,
                        isSelected && { color: '#FFFFFF' },
                      ]}
                    >
                      {rt.badge}
                    </Text>
                  </View>
                  <Text style={[styles.routeTitle, { flex: 1 }]} numberOfLines={1}>
                    {rt.title}
                  </Text>
                </View>
                <Text style={styles.routeSub}>
                  {rt.etaMin} min · {speedUnit === 'mph' ? rt.distMiles : rt.distKm} ·{' '}
                  {rt.trafficLabel}
                </Text>
              </View>

              <View
                style={[
                  styles.routeGoPill,
                  isSelected && styles.routeGoPillSelected,
                ]}
              >
                <Text
                  style={[
                    styles.routeGoText,
                    isSelected && { color: '#FFFFFF' },
                  ]}
                >
                  {isSelected ? 'GO' : 'Select'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          testID="start-turn-by-turn-btn"
          style={styles.startGuidanceBtn}
          onPress={handleStartRoute}
        >
          <Text style={styles.startGuidanceBtnText}>
            Start Turn-by-Turn Route Guidance
          </Text>
        </TouchableOpacity>
      </View>

      {/* Hands-Free Voice Assistant Status Card */}
      <TouchableOpacity
        testID="voice-assistant-card"
        style={styles.voiceAssistantCard}
        onPress={onOpenVoiceModal}
      >
        <View style={styles.voiceMicCircle}>
          <Text style={{ fontSize: 18 }}>🎤</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.voiceAssistantTitle}>
            Hands-Free CarPlay Voice Control
          </Text>
          <Text style={styles.voiceAssistantSub} numberOfLines={2}>
            {lastVoiceReply}
          </Text>
        </View>
        <Text style={styles.voiceSpeakNowLink}>Speak →</Text>
      </TouchableOpacity>

      {/* Subtle Secondary Entry to Parked Rest-Stop Lounge */}
      <TouchableOpacity
        testID="open-parked-lounge-card"
        style={styles.parkedLoungeBanner}
        onPress={onOpenParkedLounge}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.parkedLoungeTag}>VEHICLE PARKED UTILITY</Text>
          <Text style={styles.parkedLoungeTitle}>
            Parked Rest-Stop Companion →
          </Text>
          <Text style={styles.parkedLoungeSub}>
            Access parked rest-stop media, camera roll viewer, and display tools while stationary.
          </Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.colors.bgPrimary,
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logoCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: BRAND.colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  brandTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 19,
    fontWeight: '800',
  },
  brandSubtitle: {
    color: BRAND.colors.textSecondary,
    fontSize: 11,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unitBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  unitBtnText: {
    color: BRAND.colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  voiceBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  voiceBtnText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '800',
  },
  connCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 13,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  connRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  connTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  connSub: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  resyncBtn: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  resyncBtnText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '800',
  },
  setupBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  setupBtnText: {
    color: BRAND.colors.accentBlue,
    fontSize: 11,
    fontWeight: '700',
  },
  connExpand: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  inputLabel: {
    color: BRAND.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    color: BRAND.colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 10,
  },
  primaryBtn: {
    backgroundColor: BRAND.colors.accentBlue,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  maneuverBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    gap: 14,
  },
  maneuverIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  maneuverArrow: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },
  maneuverTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  maneuverDist: {
    color: '#60A5FA',
    fontSize: 18,
    fontWeight: '900',
  },
  parkedPill: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  parkedPillText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
  },
  maneuverStreet: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  maneuverNext: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  voiceLink: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '800',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  goBtn: {
    backgroundColor: BRAND.colors.accentBlue,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 10,
  },
  goBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  poiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  poiChip: {
    width: '48%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  poiChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  subLabel: {
    color: BRAND.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  providerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  providerPill: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  providerPillActive: {
    backgroundColor: '#10B981',
  },
  providerPillText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  providerPillTextActive: {
    color: '#FFFFFF',
  },
  etaHighlight: {
    color: '#16A34A',
    fontSize: 13,
    fontWeight: '800',
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  routeCardSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  routeTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  routeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  routeBadgeSelected: {
    backgroundColor: '#16A34A',
  },
  routeBadgeMuted: {
    backgroundColor: '#E2E8F0',
  },
  routeBadgeText: {
    color: '#334155',
    fontSize: 10,
    fontWeight: '800',
  },
  routeTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  routeSub: {
    color: BRAND.colors.textSecondary,
    fontSize: 12,
  },
  routeGoPill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 8,
  },
  routeGoPillSelected: {
    backgroundColor: '#2563EB',
  },
  routeGoText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
  },
  startGuidanceBtn: {
    backgroundColor: '#16A34A',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  startGuidanceBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  voiceAssistantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    gap: 12,
  },
  voiceMicCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceAssistantTitle: {
    color: '#1E3A8A',
    fontSize: 13,
    fontWeight: '800',
  },
  voiceAssistantSub: {
    color: '#3730A3',
    fontSize: 11,
    marginTop: 2,
  },
  voiceSpeakNowLink: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '800',
  },
  parkedLoungeBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  parkedLoungeTag: {
    color: '#2563EB',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  parkedLoungeTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  parkedLoungeSub: {
    color: BRAND.colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
});
