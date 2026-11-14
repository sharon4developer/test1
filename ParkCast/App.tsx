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
import { NavigationLandingScreen } from './src/screens/NavigationLandingScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { PlayerRemoteScreen } from './src/screens/PlayerRemoteScreen';
import { CarReceiverScreen } from './src/screens/CarReceiverScreen';
import { PaywallModal } from './src/screens/PaywallModal';
import { VoiceCommandModal } from './src/screens/VoiceCommandModal';

type ViewLayoutMode = 'auto_split' | 'iphone_only' | 'car_only';
export type PhoneTab = 'drive_map' | 'parked_lounge' | 'remote';

const ParkCastShell: React.FC = () => {
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 900;

  const [layoutMode, setLayoutMode] = useState<ViewLayoutMode>(
    isWideScreen ? 'auto_split' : 'iphone_only'
  );
  // Default landing page is 'drive_map' (100% Apple CarPlay Navigation Reviewer Compliant)
  const [phoneTab, setPhoneTab] = useState<PhoneTab>('drive_map');
  const [voiceModalOpen, setVoiceModalOpen] = useState<boolean>(false);

  const {
    connectionTarget,
    isPlaying,
    isParkedConfirmed,
    carActiveTab,
    setCarActiveTab,
  } = useCastSession();

  const isCastingActive =
    connectionTarget !== 'disconnected' &&
    isPlaying &&
    isParkedConfirmed &&
    carActiveTab !== 'map';

  const effectiveMode: ViewLayoutMode =
    layoutMode === 'auto_split' && !isWideScreen ? 'iphone_only' : layoutMode;

  const renderActivePhoneScreen = () => {
    if (phoneTab === 'drive_map') {
      return (
        <NavigationLandingScreen
          onOpenParkedLounge={() => {
            setCarActiveTab('library');
            setPhoneTab('parked_lounge');
          }}
          onOpenVoiceModal={() => setVoiceModalOpen(true)}
        />
      );
    }
    if (phoneTab === 'parked_lounge') {
      return <DashboardScreen onOpenRemote={() => setPhoneTab('remote')} />;
    }
    return (
      <PlayerRemoteScreen
        onBackToDashboard={() => setPhoneTab('parked_lounge')}
      />
    );
  };

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
                testID="tab-drive-map-btn"
                style={[
                  styles.navTabBtn,
                  phoneTab === 'drive_map' && styles.navTabBtnActive,
                ]}
                onPress={() => {
                  setCarActiveTab('map');
                  setPhoneTab('drive_map');
                }}
              >
                <Text
                  style={[
                    styles.navTabText,
                    phoneTab === 'drive_map' && styles.navTabTextActive,
                  ]}
                >
                  🧭 Drive & Map
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="tab-dashboard-btn"
                style={[
                  styles.navTabBtn,
                  phoneTab === 'parked_lounge' && styles.navTabBtnActive,
                ]}
                onPress={() => {
                  setCarActiveTab('library');
                  setPhoneTab('parked_lounge');
                }}
              >
                <Text
                  style={[
                    styles.navTabText,
                    phoneTab === 'parked_lounge' && styles.navTabTextActive,
                  ]}
                >
                  🍿 Parked Lounge
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
                  🕹️ Remote
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="global-voice-btn"
                style={styles.voiceMicPill}
                onPress={() => setVoiceModalOpen(true)}
              >
                <Text style={styles.voiceMicPillText}>🎤</Text>
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
            <View style={styles.singlePhonePane}>{renderActivePhoneScreen()}</View>
          ) : (
            <View style={styles.splitStudioContainer}>
              <View style={styles.splitPhoneColumn}>
                {renderActivePhoneScreen()}
              </View>

              <View style={styles.splitCarColumn}>
                <CarReceiverScreen />
              </View>
            </View>
          )}
        </View>

        <VoiceCommandModal
          visible={voiceModalOpen}
          onClose={() => setVoiceModalOpen(false)}
          onSwitchPhoneTab={(t) => setPhoneTab(t)}
        />
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BRAND.colors.borderSubtle,
    flexWrap: 'wrap',
    gap: 8,
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
    alignItems: 'center',
    gap: 6,
  },
  navTabBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
  },
  navTabBtnActive: {
    backgroundColor: BRAND.colors.accentBlue,
  },
  navTabText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },
  navTabTextActive: {
    color: '#FFFFFF',
  },
  voiceMicPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  voiceMicPillText: {
    fontSize: 13,
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
