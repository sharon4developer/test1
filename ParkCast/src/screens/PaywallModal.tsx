import React, { useEffect, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '../context/SubscriptionContext';
import { PRO_FEATURES, type PlanId } from '../config/brand';
import { ENV } from '../config/env';
import { Button, IconButton } from '../ui/components';
import { colors, radius, space, text } from '../ui/theme';

export const PaywallModal: React.FC = () => {
  const { paywallVisible, paywallReason, closePaywall, offers, purchase, restore, storeReady } = useSubscription();
  const defaultPlan = offers.find((offer) => offer.highlight)?.id ?? offers[0]?.id;
  const [selected, setSelected] = useState<PlanId | undefined>(defaultPlan);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);

  useEffect(() => {
    if (paywallVisible) setSelected(defaultPlan);
  }, [paywallVisible, defaultPlan]);

  const plan = offers.find((offer) => offer.id === selected);

  const buy = async () => {
    if (!plan) return;
    setBusy('buy');
    try {
      if (await purchase(plan.id)) closePaywall();
    } catch (error: any) {
      Alert.alert('Purchase not completed', error?.message ?? 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const restorePurchases = async () => {
    setBusy('restore');
    try {
      if (await restore()) closePaywall();
      else Alert.alert('No purchases found', 'This Apple ID has no ParkCast Premium subscription.');
    } catch (error: any) {
      Alert.alert('Restore failed', error?.message ?? 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const ctaTitle = plan?.trialDays
    ? `Try ${plan.trialDays} days free`
    : plan
      ? `Continue · ${plan.displayPrice}/${plan.periodLabel}`
      : 'Continue';

  return (
    <Modal visible={paywallVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closePaywall}>
      <SafeAreaView style={styles.root} edges={['bottom']}>
        <View style={styles.close}>
          <IconButton icon="close" label="Close" onPress={closePaywall} size={36} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Ionicons name="diamond" size={34} color={colors.gold} />
          </View>
          <Text style={[text.hero, styles.center]}>ParkCast Premium</Text>
          {paywallReason ? <Text style={[text.secondary, styles.center, styles.reason]}>{paywallReason}</Text> : null}

          <View style={styles.features}>
            {PRO_FEATURES.map((feature) => (
              <View key={feature} style={styles.feature}>
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                <Text style={text.body}>{feature}</Text>
              </View>
            ))}
          </View>

          {offers.map((offer) => {
            const active = offer.id === selected;
            return (
              <Pressable
                key={offer.id}
                onPress={() => setSelected(offer.id)}
                style={[styles.plan, active && styles.planActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={active ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={active ? colors.primary : colors.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{offer.name}</Text>
                  <Text style={text.secondary}>
                    {offer.trialDays ? `${offer.trialDays}-day free trial, then ` : ''}
                    {offer.displayPrice} {offer.renewalLabel}
                  </Text>
                </View>
                {offer.badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{offer.badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}

          <Button
            title={ctaTitle}
            size="lg"
            onPress={buy}
            loading={busy === 'buy'}
            disabled={!plan || busy !== null || !storeReady}
            style={{ marginTop: space(4) }}
          />
          {!storeReady ? (
            <Text style={[text.caption, styles.center, { marginTop: space(2) }]}>
              Purchases are unavailable right now. Check your connection and try again.
            </Text>
          ) : null}

          <Text style={styles.legal}>
            {plan
              ? `${plan.trialDays ? `After the ${plan.trialDays}-day free trial, ` : ''}${plan.displayPrice} is charged to your Apple ID ${plan.renewalLabel}. `
              : ''}
            The subscription renews automatically unless you cancel at least 24 hours before the end of the current period.
            Manage or cancel any time in your App Store account settings.
          </Text>

          <View style={styles.links}>
            <Pressable onPress={restorePurchases} disabled={busy !== null}>
              <Text style={styles.link}>{busy === 'restore' ? 'Restoring…' : 'Restore'}</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL(ENV.termsUrl)}>
              <Text style={styles.link}>Terms</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL(ENV.privacyUrl)}>
              <Text style={styles.link}>Privacy</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  close: { alignItems: 'flex-end', padding: space(3) },
  content: { paddingHorizontal: space(5), paddingBottom: space(8) },
  center: { textAlign: 'center' },
  hero: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space(4),
  },
  reason: { marginTop: space(2) },
  features: { gap: space(3), marginVertical: space(6) },
  feature: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(4),
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: space(3),
  },
  planActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  planName: { fontSize: 17, fontWeight: '800', color: colors.text },
  badge: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '800', color: colors.ink },
  legal: { ...text.caption, lineHeight: 17, marginTop: space(5), textAlign: 'center' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: space(6), marginTop: space(4) },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
