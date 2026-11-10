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
        <StatusBar barStyle="dark-content" />

        {/* Clean Top Navigation Bar */}
        <View style={styles.modeBar}>
          {isWideScreen && (
            <View style={styles.modeBarLeft}>
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
                  Phone + Car Preview
                </Text>
              </TouchableOpacity>
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
                  Phone Only
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
                  Car Screen Only
                </Text>
              </TouchableOpacity>
            </View>
          )}

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
                  Home
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
                  Car Remote
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
              <View style={styles.splitPhoneColumn}>
                {phoneTab === 'dashboard' ? (
                  <DashboardScreen onOpenRemote={() => setPhoneTab('remote')} />
                ) : (
                  <PlayerRemoteScreen
                    onBackToDashboard={() => setPhoneTab('dashboard')}
                  />
                )}
              </View>

              <View style={styles.splitCarColumn}>
                <CarReceiverScreen />
              </View>
            </View>
          )}
        </View>

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
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BRAND.colors.borderSubtle,
  },
  modeBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  modeChipActive: {
    backgroundColor: '#DBEAFE',
  },
  modeChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: '#1D4ED8',
  },
  phoneNavTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  navTabBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  navTabBtnActive: {
    backgroundColor: BRAND.colors.accentBlue,
  },
  navTabText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  navTabTextActive: {
    color: '#FFFFFF',
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
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  splitStudioContainer: {
    flex: 1,
    flexDirection: 'row',
    padding: 14,
    gap: 16,
  },
  splitPhoneColumn: {
    width: 420,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
    overflow: 'hidden',
    backgroundColor: BRAND.colors.bgPrimary,
  },
  splitCarColumn: {
    flex: 1,
  },
});
