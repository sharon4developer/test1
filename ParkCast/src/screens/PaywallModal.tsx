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
  const [restoredBanner, setRestoredBanner] = useState<string | null>(null);

  if (!paywallVisible) return null;

  const activeChoice =
    PRICING_PLANS.find((p) => p.id === selectedPlan) || PRICING_PLANS[0];

  const handleConfirmPurchase = () => {
    purchasePlan(selectedPlan, selectedPlan === 'pro_annual');
  };

  const handleRestore = () => {
    restorePurchases();
    setRestoredBanner('Previous Pro subscription restored!');
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
            {/* Header */}
            <View style={styles.topRow}>
              <View style={styles.proCrownBadge}>
                <Text style={styles.proCrownText}>PARKCAST PRO CINEMA</Text>
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
              Turn Your Car Screen Into an Unlimited HD Cinema
            </Text>

            {paywallReason && (
              <View style={styles.reasonCallout}>
                <Text style={styles.reasonText}>{paywallReason}</Text>
              </View>
            )}

            {restoredBanner && (
              <View style={styles.restoredCallout}>
                <Text style={styles.restoredText}>{restoredBanner}</Text>
              </View>
            )}

            {/* Plan Cards */}
            <Text style={styles.sectionLabel}>CHOOSE YOUR PLAN</Text>
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
                      <View style={styles.planBadgePill}>
                        <Text style={styles.planBadgeText}>{plan.badge}</Text>
                      </View>
                    )}
                    <View style={styles.planMainRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planName}>
                          {plan.name}{' '}
                          {isCurrentOwned ? ' (ACTIVE)' : ''}
                        </Text>
                        <Text style={styles.planSubtext}>{plan.subtext}</Text>
                        {plan.trialLabel && (
                          <Text style={styles.planTrialText}>
                            ✓ {plan.trialLabel}
                          </Text>
                        )}
                      </View>
                      <View style={styles.priceColumn}>
                        <Text style={styles.priceValue}>{plan.price}</Text>
                        <Text style={styles.pricePeriod}>{plan.period}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Primary CTA Button */}
            <TouchableOpacity
              testID="paywall-subscribe-cta"
              style={styles.ctaButton}
              onPress={handleConfirmPurchase}
            >
              <Text style={styles.ctaButtonTitle}>
                {selectedPlan === 'pro_annual'
                  ? 'Start 3-Day Free Trial · Then $24.99/yr'
                  : selectedPlan === 'pro_monthly'
                  ? 'Subscribe to Pro Monthly · $4.99/mo'
                  : 'Unlock Pro Lifetime · $49.99 Once'}
              </Text>
              <Text style={styles.ctaButtonSub}>
                Instant activation · Cancel anytime in iOS Settings → Subscriptions
              </Text>
            </TouchableOpacity>

            {/* Free vs Pro Comparison Table */}
            <Text style={styles.sectionLabel}>FREE VS. PRO COMPARISON</Text>
            <View style={styles.tableCard}>
              <View style={[styles.tableRow, styles.tableHeaderRow]}>
                <Text style={[styles.tableCellFeature, styles.tableHeaderText]}>
                  Feature
                </Text>
                <Text style={[styles.tableCellTier, styles.tableHeaderText]}>
                  Free Starter
                </Text>
                <Text
                  style={[
                    styles.tableCellTier,
                    styles.tableHeaderText,
                    { color: BRAND.colors.accentGold },
                  ]}
                >
                  ParkCast Pro
                </Text>
              </View>
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
                  <Text style={styles.tableCellFeature}>{row.feature}</Text>
                  <Text style={styles.tableCellFree}>{row.free}</Text>
                  <Text style={styles.tableCellPro}>{row.pro}</Text>
                </View>
              ))}
            </View>

            {/* Footer Actions */}
            <View style={styles.footerRow}>
              <TouchableOpacity
                testID="paywall-restore-btn"
                onPress={handleRestore}
              >
                <Text style={styles.footerLink}>Restore Purchases</Text>
              </TouchableOpacity>
              <Text style={styles.footerDivider}>•</Text>
              <TouchableOpacity onPress={closePaywall}>
                <Text style={styles.footerLink}>Continue with Free Plan</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.billingFootnote}>
              Payments are processed securely via Apple App Store (StoreKit 2) & RevenueCat (`{activeChoice.revenueCatProductId}`). No custom payment server required.
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
    backgroundColor: 'rgba(4, 7, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  sheet: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '94%',
    backgroundColor: BRAND.colors.bgSecondary,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 18,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  proCrownBadge: {
    backgroundColor: '#F59E0B22',
    borderWidth: 1,
    borderColor: BRAND.colors.accentGold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  proCrownText: {
    color: BRAND.colors.accentGold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BRAND.colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: BRAND.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  headline: {
    color: BRAND.colors.textPrimary,
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 27,
    marginBottom: 10,
  },
  reasonCallout: {
    backgroundColor: '#1E3A8A55',
    borderLeftWidth: 3,
    borderLeftColor: '#38BDF8',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  reasonText: {
    color: '#E0F2FE',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  restoredCallout: {
    backgroundColor: '#064E3B',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  restoredText: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionLabel: {
    color: BRAND.colors.accentCyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  planList: {
    gap: 10,
    marginBottom: 14,
  },
  planCard: {
    backgroundColor: BRAND.colors.bgCard,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1.5,
    borderColor: BRAND.colors.borderSubtle,
  },
  planCardSelected: {
    borderColor: BRAND.colors.accentGold,
    backgroundColor: '#1E293B',
  },
  planBadgePill: {
    alignSelf: 'flex-start',
    backgroundColor: BRAND.colors.accentGold,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
    marginBottom: 6,
  },
  planBadgeText: {
    color: '#080C14',
    fontSize: 9,
    fontWeight: '900',
  },
  planMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    color: BRAND.colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  planSubtext: {
    color: BRAND.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  planTrialText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  priceColumn: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  priceValue: {
    color: BRAND.colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  pricePeriod: {
    color: BRAND.colors.textSecondary,
    fontSize: 11,
  },
  ctaButton: {
    backgroundColor: BRAND.colors.accentGold,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 18,
  },
  ctaButtonTitle: {
    color: '#080C14',
    fontSize: 15,
    fontWeight: '900',
  },
  ctaButtonSub: {
    color: '#1E293B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  tableCard: {
    backgroundColor: BRAND.colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
    overflow: 'hidden',
    marginBottom: 14,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    alignItems: 'center',
  },
  tableHeaderRow: {
    backgroundColor: '#0F172A',
  },
  tableHeaderText: {
    fontWeight: '800',
    fontSize: 11,
    color: '#94A3B8',
  },
  tableCellFeature: {
    flex: 1.3,
    color: BRAND.colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
    paddingRight: 6,
  },
  tableCellTier: {
    flex: 1,
    fontSize: 11,
  },
  tableCellFree: {
    flex: 1,
    color: BRAND.colors.textSecondary,
    fontSize: 11,
  },
  tableCellPro: {
    flex: 1,
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  footerLink: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  footerDivider: {
    color: '#475569',
  },
  billingFootnote: {
    color: BRAND.colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
});
