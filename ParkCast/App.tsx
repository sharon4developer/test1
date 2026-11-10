import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { BRAND } from './src/config/brand';
import { CastSessionProvider, useCastSession } from './src/context/CastSessionContext';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { PlayerRemoteScreen } from './src/screens/PlayerRemoteScreen';
import { CarReceiverScreen } from './src/screens/CarReceiverScreen';
import { PaywallModal } from './src/screens/PaywallModal';

type ViewLayoutMode = 'auto_split' | 'iphone_only' | 'car_only';
type PhoneTab = 'dashboard' | 'remote';

const ParkCastShell: React.FC = () => {
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 900;

  const [layoutMode, setLayoutMode] = useState<ViewLayoutMode>(
    isWideScreen ? 'auto_split' : 'iphone_only'
  );
  const [phoneTab, setPhoneTab] = useState<PhoneTab>('dashboard');

  const { connectionTarget, isPlaying, isParkedConfirmed } = useCastSession();
  const isCastingActive =
    connectionTarget !== 'disconnected' && isPlaying && isParkedConfirmed;

  const effectiveMode: ViewLayoutMode =
    layoutMode === 'auto_split' && !isWideScreen ? 'iphone_only' : layoutMode;

  return (
    <SubscriptionProvider isCastingActive={isCastingActive}>
      <SafeAreaView style={styles.safeRoot}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND.colors.bgPrimary} />

        {/* Top Mode Switcher Bar (lets you test iPhone Controller, Car Display Receiver, or Both side-by-side) */}
        <View style={styles.modeBar}>
          <View style={styles.modeBarLeft}>
            <Text style={styles.modeBarLabel}>VIEW MODE:</Text>
            {isWideScreen && (
              <TouchableOpacity
                testID="mode-split-btn"
                style={[
                  styles.modeChip,
                  effectiveMode === 'auto_split' && styles.modeChipActive,
                ]}
                onPress={() => setLayoutMode('auto_split')}
              >
                <Text
                  style={[
                    styles.modeChipText,
                    effectiveMode === 'auto_split' && styles.modeChipTextActive,
                  ]}
                >
                  Split Studio (iPhone + Car Screen)
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              testID="mode-iphone-btn"
              style={[
                styles.modeChip,
                effectiveMode === 'iphone_only' && styles.modeChipActive,
              ]}
              onPress={() => setLayoutMode('iphone_only')}
            >
              <Text
                style={[
                  styles.modeChipText,
                  effectiveMode === 'iphone_only' && styles.modeChipTextActive,
                ]}
              >
                iPhone Controller (Expo Go)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="mode-car-btn"
              style={[
                styles.modeChip,
                effectiveMode === 'car_only' && styles.modeChipActive,
              ]}
              onPress={() => setLayoutMode('car_only')}
            >
              <Text
                style={[
                  styles.modeChipText,
                  effectiveMode === 'car_only' && styles.modeChipTextActive,
                ]}
              >
                Car Display Receiver
              </Text>
            </TouchableOpacity>
          </View>

          {effectiveMode !== 'car_only' && (
            <View style={styles.phoneNavTabs}>
              <TouchableOpacity
                testID="tab-dashboard-btn"
                style={[
                  styles.navTabBtn,
                  phoneTab === 'dashboard' && styles.navTabBtnActive,
                ]}
                onPress={() => setPhoneTab('dashboard')}
              >
                <Text
                  style={[
                    styles.navTabText,
                    phoneTab === 'dashboard' && styles.navTabTextActive,
                  ]}
                >
                  1. Sources
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="tab-remote-btn"
                style={[
                  styles.navTabBtn,
                  phoneTab === 'remote' && styles.navTabBtnActive,
                ]}
                onPress={() => setPhoneTab('remote')}
              >
                <Text
                  style={[
                    styles.navTabText,
                    phoneTab === 'remote' && styles.navTabTextActive,
                  ]}
                >
                  2. Player & Car Remote
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Main Workspace Body */}
        <View style={styles.workspaceBody}>
          {effectiveMode === 'car_only' ? (
            <View style={styles.fullCarPane}>
              <CarReceiverScreen />
            </View>
          ) : effectiveMode === 'iphone_only' ? (
            <View style={styles.singlePhonePane}>
              {phoneTab === 'dashboard' ? (
                <DashboardScreen onOpenRemote={() => setPhoneTab('remote')} />
              ) : (
                <PlayerRemoteScreen
                  onBackToDashboard={() => setPhoneTab('dashboard')}
                />
              )}
            </View>
          ) : (
            <View style={styles.splitStudioContainer}>
              {/* Left Pane: iPhone Controller App */}
              <View style={styles.splitPhoneColumn}>
                {phoneTab === 'dashboard' ? (
                  <DashboardScreen onOpenRemote={() => setPhoneTab('remote')} />
                ) : (
                  <PlayerRemoteScreen
                    onBackToDashboard={() => setPhoneTab('dashboard')}
                  />
                )}
              </View>

              {/* Right Pane: Live Car Head-Unit Display */}
              <View style={styles.splitCarColumn}>
                <CarReceiverScreen />
              </View>
            </View>
          )}
        </View>

        {/* Global Subscription Paywall Modal */}
        <PaywallModal />
      </SafeAreaView>
    </SubscriptionProvider>
  );
};

export default function App() {
  return (
    <CastSessionProvider>
      <ParkCastShell />
    </CastSessionProvider>
  );
}

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
    backgroundColor: BRAND.colors.bgPrimary,
  },
  modeBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#050811',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 8,
  },
  modeBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  modeBarLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    marginRight: 4,
  },
  modeChip: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  modeChipActive: {
    backgroundColor: '#1E3A8A',
    borderColor: BRAND.colors.accentBlue,
  },
  modeChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: '#FFFFFF',
  },
  phoneNavTabs: {
    flexDirection: 'row',
    gap: 6,
  },
  navTabBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  navTabBtnActive: {
    backgroundColor: '#065F46',
    borderColor: '#10B981',
  },
  navTabText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  navTabTextActive: {
    color: '#ECFDF5',
  },
  workspaceBody: {
    flex: 1,
  },
  fullCarPane: {
    flex: 1,
    padding: 14,
  },
  singlePhonePane: {
    flex: 1,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  splitStudioContainer: {
    flex: 1,
    flexDirection: 'row',
    padding: 12,
    gap: 14,
  },
  splitPhoneColumn: {
    width: 440,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#1E293B',
    overflow: 'hidden',
    backgroundColor: BRAND.colors.bgPrimary,
  },
  splitCarColumn: {
    flex: 1,
  },
});
