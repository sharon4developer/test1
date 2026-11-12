import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import {
  BRAND,
  PRICING_PLANS,
  FEATURE_COMPARISON,
  PlanId,
} from '../config/brand';
import { useSubscription } from '../context/SubscriptionContext';

export const PaywallModal: React.FC = () => {
  const {
    paywallVisible,
    paywallReason,
    isPro,
    planId,
    closePaywall,
    purchasePlan,
    restorePurchases,
  } = useSubscription();

  const [selectedPlan, setSelectedPlan] =
    useState<Exclude<PlanId, 'free'>>('pro_annual');
  const [legalDoc, setLegalDoc] = useState<'privacy' | 'terms' | null>(null);

  if (!paywallVisible) return null;

  const handleConfirmPurchase = () => {
    purchasePlan(selectedPlan, selectedPlan === 'pro_annual');
  };

  return (
    <Modal
      visible={paywallVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={closePaywall}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.topRow}>
              <View style={styles.proPill}>
                <Text style={styles.proPillText}>PARKCAST PRO</Text>
              </View>
              <TouchableOpacity
                testID="paywall-close-btn"
                style={styles.closeBtn}
                onPress={closePaywall}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.headline}>
              Enjoy Unlimited Car Video & Screen Mirroring
            </Text>

            {paywallReason && (
              <View style={styles.reasonBox}>
                <Text style={styles.reasonText}>{paywallReason}</Text>
              </View>
            )}

            {/* Simple Plan Selector */}
            <View style={styles.planList}>
              {PRICING_PLANS.map((plan) => {
                const isSelected = selectedPlan === plan.id;
                const isCurrentOwned = isPro && planId === plan.id;
                return (
                  <TouchableOpacity
                    key={plan.id}
                    testID={`plan-card-${plan.id}`}
                    style={[
                      styles.planCard,
                      isSelected && styles.planCardSelected,
                    ]}
                    onPress={() => setSelectedPlan(plan.id)}
                  >
                    {plan.badge && (
                      <View style={styles.badgePill}>
                        <Text style={styles.badgeText}>{plan.badge}</Text>
                      </View>
                    )}
                    <View style={styles.planRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planName}>
                          {plan.name} {isCurrentOwned ? '(Active)' : ''}
                        </Text>
                        <Text style={styles.planSub}>{plan.subtext}</Text>
                        {plan.trialLabel && (
                          <Text style={styles.trialText}>✓ {plan.trialLabel}</Text>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.priceText}>{plan.price}</Text>
                        <Text style={styles.periodText}>{plan.period}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Big Friendly Continue Button */}
            <TouchableOpacity
              testID="paywall-subscribe-cta"
              style={styles.ctaBtn}
              onPress={handleConfirmPurchase}
            >
              <Text style={styles.ctaTitle}>
                {selectedPlan === 'pro_annual'
                  ? 'Start 3-Day Free Trial ($24.99/yr)'
                  : selectedPlan === 'pro_monthly'
                  ? 'Continue with Monthly ($4.99/mo)'
                  : 'Unlock Lifetime Access ($49.99)'}
              </Text>
              <Text style={styles.ctaSub}>Cancel anytime in iPhone Settings</Text>
            </TouchableOpacity>

            {/* Simple Comparison */}
            <Text style={styles.tableHeading}>What's Included</Text>
            <View style={styles.tableCard}>
              {FEATURE_COMPARISON.map((row, idx) => (
                <View
                  key={row.feature}
                  style={[
                    styles.tableRow,
                    idx === FEATURE_COMPARISON.length - 1 && {
                      borderBottomWidth: 0,
                    },
                  ]}
                >
                  <Text style={styles.featureCell}>{row.feature}</Text>
                  <Text style={styles.freeCell}>{row.free}</Text>
                  <Text style={styles.proCell}>{row.pro}</Text>
                </View>
              ))}
            </View>

            <View style={styles.footerRow}>
              <TouchableOpacity
                testID="paywall-restore-btn"
                onPress={restorePurchases}
              >
                <Text style={styles.footerLink}>Restore Purchases</Text>
              </TouchableOpacity>
              <Text style={{ color: '#CBD5E1' }}>•</Text>
              <TouchableOpacity onPress={() => setLegalDoc('terms')}>
                <Text style={styles.footerLink}>Terms of Use</Text>
              </TouchableOpacity>
              <Text style={{ color: '#CBD5E1' }}>•</Text>
              <TouchableOpacity onPress={() => setLegalDoc('privacy')}>
                <Text style={styles.footerLink}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>

            {legalDoc && (
              <View style={styles.legalCard}>
                <View style={styles.legalHeaderRow}>
                  <Text style={styles.legalTitle}>
                    {legalDoc === 'privacy'
                      ? 'ParkCast Privacy Policy'
                      : 'ParkCast Terms of Use (EULA)'}
                  </Text>
                  <TouchableOpacity onPress={() => setLegalDoc(null)}>
                    <Text style={styles.footerLink}>Close</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.legalBodyText}>
                  {legalDoc === 'privacy'
                    ? 'ParkCast v1.2 respects your privacy. 1) Location & Navigation: GPS location is used only while in use for turn-by-turn route guidance, MPH/KM/H speed display, and nearby parking/EV charger search, and is never sold or shared. 2) Voice Control: Spoken commands are processed only when you tap Voice Control and are never stored. 3) Media & Playlists: M3U playlists remain on your iPhone, and casted camera roll files are buffered only for your active 4-digit Car Code session. 4) Subscriptions: Verified securely via Apple StoreKit and RevenueCat. Full policy: https://parkcast-x9nd.onrender.com/privacy'
                    : '1) Safety Rule: Turn-by-turn navigation is for driving assistance; all video, M3U/IPTV, browser, and mirroring features in Parked Lounge are strictly for when your vehicle is safely parked. Never watch video while driving. 2) Utility Player Only: ParkCast does not host, bundle, or provide any TV channels or copyrighted streams; users supply their own legally permitted playlists and files. 3) Subscriptions: Monthly ($4.99), Yearly ($24.99 with 3-day trial), and Lifetime ($49.99) plans are billed via Apple Account and auto-renew unless canceled 24h before period end in iPhone Settings. Full EULA: https://parkcast-x9nd.onrender.com/terms'}
                </Text>
              </View>
            )}

            <Text style={styles.appleDisclosureText}>
              Payment is charged to your Apple Account upon confirmation. Subscriptions renew automatically unless auto-renew is turned off at least 24 hours before the current period ends.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  proPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  proPillText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '800',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: BRAND.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  headline: {
    color: BRAND.colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
  },
  reasonBox: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  reasonText: {
    color: '#1E40AF',
    fontSize: 13,
    fontWeight: '600',
  },
  planList: {
    gap: 10,
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  planCardSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: BRAND.colors.accentBlue,
  },
  badgePill: {
    alignSelf: 'flex-start',
    backgroundColor: BRAND.colors.accentBlue,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    color: BRAND.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  planSub: {
    color: BRAND.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  trialText: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  priceText: {
    color: BRAND.colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  periodText: {
    color: BRAND.colors.textSecondary,
    fontSize: 11,
  },
  ctaBtn: {
    backgroundColor: BRAND.colors.accentBlue,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 18,
  },
  ctaTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  ctaSub: {
    color: '#DBEAFE',
    fontSize: 11,
    marginTop: 2,
  },
  tableHeading: {
    color: BRAND.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  tableCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    alignItems: 'center',
  },
  featureCell: {
    flex: 1.3,
    color: BRAND.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  freeCell: {
    flex: 1,
    color: BRAND.colors.textSecondary,
    fontSize: 11,
  },
  proCell: {
    flex: 1,
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  footerLink: {
    color: BRAND.colors.accentBlue,
    fontSize: 13,
    fontWeight: '700',
  },
  legalCard: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  legalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  legalTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  legalBodyText: {
    color: BRAND.colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  appleDisclosureText: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
});
