import React from 'react';
import { ActionSheetIOS, Alert, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSettings, newScreenCode, type NavApp, type Settings } from '../context/SettingsContext';
import { useSubscription } from '../context/SubscriptionContext';
import { ParkCastNative } from '../native/ParkCastNative';
import { ENV } from '../config/env';
import { AdBanner } from '../ads/ads';
import { ListRow, ScreenTitle, Section, Segmented, ToggleRow } from '../ui/components';
import { colors, space } from '../ui/theme';

const NAV_APP_LABEL: Record<NavApp, string> = {
  parkcast: 'ParkCast (on the car)',
  apple: 'Apple Maps',
  google: 'Google Maps',
  waze: 'Waze',
};

const SLEEP_OPTIONS = [0, 15, 30, 60, 90];
const OPACITY_OPTIONS = [0.5, 0.85, 1];

function choose<T>(title: string, options: Array<{ label: string; value: T }>, onPick: (value: T) => void) {
  const labels = options.map((option) => option.label);
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions({ title, options: [...labels, 'Cancel'], cancelButtonIndex: labels.length }, (index) => {
      if (index < labels.length) onPick(options[index].value);
    });
    return;
  }
  Alert.alert(title, undefined, [
    ...options.map((option) => ({ text: option.label, onPress: () => onPick(option.value) })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

const open = (url: string) => {
  if (url) Linking.openURL(url).catch(() => {});
};

export const SettingsScreen: React.FC<{ onShowOnboarding: () => void }> = ({ onShowOnboarding }) => {
  const { settings, update } = useSettings();
  const { isPro, openPaywall, manageSubscription, restore } = useSubscription();

  const set = <K extends keyof Settings>(key: K) => (value: Settings[K]) => update({ [key]: value } as Partial<Settings>);

  const restorePurchases = async () => {
    try {
      const active = await restore();
      Alert.alert(active ? 'Premium restored' : 'No purchases found', active ? 'Welcome back!' : 'This Apple ID has no ParkCast Premium subscription.');
    } catch (error: any) {
      Alert.alert('Restore failed', error?.message ?? 'Please try again.');
    }
  };

  const clearBrowser = () =>
    Alert.alert('Clear browsing data?', 'This signs you out of websites and removes cookies and history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => ParkCastNative.clearWebData().then(() => Alert.alert('Browsing data cleared')),
      },
    ]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenTitle title="Settings" />
      <AdBanner visible={!isPro} />

      <Section title="Premium">
        {isPro ? (
          <ListRow icon="diamond" iconColor={colors.gold} title="ParkCast Premium is active" subtitle="Thank you for your support" />
        ) : (
          <ListRow
            icon="diamond"
            iconColor={colors.gold}
            title="Go Premium"
            subtitle="Unlimited watching, HD mirroring and no ads"
            onPress={() => openPaywall()}
            chevron
          />
        )}
        <ListRow icon="card-outline" title="Manage subscription" onPress={manageSubscription} chevron />
        <ListRow icon="refresh" title="Restore purchases" onPress={restorePurchases} last />
      </Section>

      <Section title="General">
        <View style={styles.inlineControl}>
          <Segmented
            value={settings.units}
            options={[
              { value: 'kmh', label: 'Kilometres' },
              { value: 'mph', label: 'Miles' },
            ]}
            onChange={set('units')}
          />
        </View>
        <ListRow
          icon="navigate-outline"
          title="Directions open in"
          value={NAV_APP_LABEL[settings.navApp]}
          onPress={() =>
            choose(
              'Directions open in',
              (Object.keys(NAV_APP_LABEL) as NavApp[]).map((value) => ({ value, label: NAV_APP_LABEL[value] })),
              set('navApp')
            )
          }
          last
        />
      </Section>

      <Section title="Car screen" footer="Video, slideshows and mirroring always pause while the car is moving and resume when you park.">
        <View style={styles.inlineControl}>
          <Segmented
            value={settings.carHome}
            options={[
              { value: 'clock', label: 'Clock home' },
              { value: 'map', label: 'Map home' },
            ]}
            onChange={set('carHome')}
          />
        </View>
        <ToggleRow icon="color-palette-outline" title="Cinema glow" subtitle="The car background takes the video's colour" value={settings.glow} onChange={set('glow')} />
        <ToggleRow icon="time-outline" title="Status bar on video" subtitle="Time, speed, weather and battery" value={settings.statusBar} onChange={set('statusBar')} />
        <ListRow
          icon="contrast-outline"
          title="Status bar opacity"
          value={`${Math.round(settings.statusOpacity * 100)}%`}
          onPress={() =>
            choose(
              'Status bar opacity',
              OPACITY_OPTIONS.map((value) => ({ value, label: `${Math.round(value * 100)}%` })),
              set('statusOpacity')
            )
          }
        />
        <ListRow
          icon="moon-outline"
          title="Sleep timer"
          value={settings.sleepMinutes ? `${settings.sleepMinutes} min` : 'Off'}
          onPress={() =>
            choose(
              'Stop playing after',
              SLEEP_OPTIONS.map((value) => ({ value, label: value ? `${value} minutes` : 'Off' })),
              set('sleepMinutes')
            )
          }
        />
        <ListRow icon="shield-checkmark-outline" title="Pause while driving" value="Always on" last />
      </Section>

      <Section title="Browser">
        <ToggleRow icon="ban-outline" title="Block ads and pop-ups" value={settings.browserAdBlock} onChange={set('browserAdBlock')} />
        <ListRow icon="trash-outline" title="Clear browsing data" onPress={clearBrowser} destructive last />
      </Section>

      <Section
        title="Other screens"
        footer={
          settings.webScreen && ENV.webScreenUrl
            ? `On a tablet or rear-seat screen, open ${ENV.webScreenUrl} and enter code ${settings.webScreenCode}. Only web links can play there; items from your iPhone stay on CarPlay.`
            : 'Show web videos on any screen with a browser, for cars without CarPlay.'
        }
      >
        <ToggleRow
          icon="desktop-outline"
          title="Web screen"
          value={settings.webScreen}
          onChange={(value) => update({ webScreen: value, webScreenCode: value ? newScreenCode() : settings.webScreenCode })}
          disabled={!ENV.webScreenUrl}
          last={!settings.webScreen}
        />
        {settings.webScreen ? <ListRow icon="key-outline" title="Screen code" value={settings.webScreenCode} last /> : null}
      </Section>

      <Section title="About">
        <ListRow icon="help-circle-outline" title="Show the welcome tour" onPress={onShowOnboarding} chevron />
        <ListRow icon="lock-closed-outline" title="Privacy policy" onPress={() => open(ENV.privacyUrl)} chevron />
        <ListRow icon="document-text-outline" title="Terms of use" onPress={() => open(ENV.termsUrl)} chevron />
        {ENV.supportEmail ? (
          <ListRow icon="mail-outline" title="Contact support" value={ENV.supportEmail} onPress={() => open(`mailto:${ENV.supportEmail}`)} />
        ) : null}
        <ListRow icon="information-circle-outline" title="Version" value={ENV.appVersion} last />
      </Section>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(5), paddingBottom: space(10) },
  inlineControl: {
    padding: space(3),
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
});
