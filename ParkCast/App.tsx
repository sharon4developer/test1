import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import { LibraryProvider } from './src/context/LibraryContext';
import { SubscriptionProvider, useSubscription } from './src/context/SubscriptionContext';
import { CarProvider, useCar } from './src/context/CarContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { MirrorScreen } from './src/screens/MirrorScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { BrowserScreen } from './src/screens/BrowserScreen';
import { NavigateScreen, type NavigateStart } from './src/screens/NavigateScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { PaywallModal } from './src/screens/PaywallModal';
import { VoiceModal } from './src/screens/VoiceModal';
import { NowPlayingBar } from './src/components/NowPlayingBar';
import { initAds, maybeShowInterstitial } from './src/ads/ads';
import { tap, type IconName } from './src/ui/components';
import { colors, space } from './src/ui/theme';
import type { TabId } from './src/navigation';

const TABS: Array<{ id: TabId; label: string; icon: IconName; activeIcon: IconName }> = [
  { id: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { id: 'library', label: 'Library', icon: 'albums-outline', activeIcon: 'albums' },
  { id: 'mirror', label: 'Mirror', icon: 'phone-portrait-outline', activeIcon: 'phone-portrait' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
];

const Shell: React.FC = () => {
  const { settings, ready, update } = useSettings();
  const { isPro } = useSubscription();
  const car = useCar();
  const [tab, setTab] = useState<TabId>('home');
  const [browser, setBrowser] = useState<{ visible: boolean; url?: string }>({ visible: false });
  const [navigate, setNavigate] = useState<{ visible: boolean; start?: NavigateStart }>({ visible: false });
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const previousTab = useRef<TabId>('home');

  useEffect(() => {
    if (ready && settings.onboarded && !isPro) initAds().catch(() => {});
  }, [ready, settings.onboarded, isPro]);

  const switchTab = (next: TabId) => {
    if (next === tab) return;
    tap();
    if (previousTab.current === 'library' && !isPro) maybeShowInterstitial().catch(() => {});
    previousTab.current = next;
    setTab(next);
  };

  const openBrowser = (url?: string) => setBrowser({ visible: true, url });
  const openNavigate = (start?: NavigateStart) => setNavigate({ visible: true, start });

  if (!ready) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!settings.onboarded) {
    return <OnboardingScreen onDone={() => update({ onboarded: true })} />;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.content}>
        {tab === 'home' ? (
          <HomeScreen
            onNavigate={switchTab}
            onOpenBrowser={openBrowser}
            onOpenNavigate={openNavigate}
            onOpenVoice={() => setVoiceOpen(true)}
            pendingQuery={pendingQuery}
            onPendingHandled={() => setPendingQuery(null)}
          />
        ) : null}
        {tab === 'library' ? <LibraryScreen onOpenBrowser={openBrowser} /> : null}
        {tab === 'mirror' ? <MirrorScreen /> : null}
        {tab === 'settings' ? <SettingsScreen onShowOnboarding={() => update({ onboarded: false })} /> : null}
      </View>

      <NowPlayingBar onOpen={() => (car.media?.kind === 'web' ? openBrowser() : switchTab('library'))} />

      <SafeAreaView edges={['bottom']} style={styles.tabBar}>
        {TABS.map((item) => {
          const active = item.id === tab;
          return (
            <Pressable
              key={item.id}
              style={styles.tab}
              onPress={() => switchTab(item.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              testID={`tab-${item.id}`}
            >
              <Ionicons name={active ? item.activeIcon : item.icon} size={24} color={active ? colors.primary : colors.textMuted} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </SafeAreaView>

      <BrowserScreen visible={browser.visible} initialUrl={browser.url} onClose={() => setBrowser({ visible: false })} />
      <NavigateScreen visible={navigate.visible} start={navigate.start} onClose={() => setNavigate({ visible: false })} />
      <VoiceModal
        visible={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onResult={(transcript) => {
          setVoiceOpen(false);
          setPendingQuery(transcript);
          setTab('home');
        }}
      />
      <PaywallModal />
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SettingsProvider>
        <LibraryProvider>
          <SubscriptionProvider>
            <CarProvider>
              <Shell />
            </CarProvider>
          </SubscriptionProvider>
        </LibraryProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space(2),
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingBottom: space(1) },
  tabLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  tabLabelActive: { color: colors.primary },
});
