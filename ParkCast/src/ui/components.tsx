import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, radius, shadow, space, text } from './theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export const tap = () => {
  Haptics.selectionAsync().catch(() => {});
};

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';

export const Button: React.FC<{
  title: string;
  onPress: () => void;
  icon?: IconName;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}> = ({ title, onPress, icon, variant = 'primary', size = 'md', loading, disabled, style, testID }) => {
  const palette = {
    primary: { bg: colors.primary, fg: colors.white },
    secondary: { bg: colors.primarySoft, fg: colors.primary },
    ghost: { bg: 'transparent', fg: colors.primary },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    dark: { bg: colors.ink, fg: colors.white },
  }[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        size === 'lg' && styles.buttonLarge,
        { backgroundColor: palette.bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'lg' ? 22 : 18} color={palette.fg} /> : null}
          <Text style={[styles.buttonText, size === 'lg' && styles.buttonTextLarge, { color: palette.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
};

export const IconButton: React.FC<{
  icon: IconName;
  onPress: () => void;
  color?: string;
  background?: string;
  size?: number;
  label: string;
  disabled?: boolean;
}> = ({ icon, onPress, color = colors.text, background = colors.surfaceAlt, size = 44, label, disabled }) => (
  <Pressable
    accessibilityLabel={label}
    accessibilityRole="button"
    disabled={disabled}
    onPress={() => {
      tap();
      onPress();
    }}
    style={({ pressed }) => [
      styles.iconButton,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: background, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
    ]}
  >
    <Ionicons name={icon} size={size * 0.48} color={color} />
  </Pressable>
);

export const Card: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }> = ({
  children,
  style,
  padded = true,
}) => <View style={[styles.card, padded && styles.cardPadded, style]}>{children}</View>;

export const SearchBar: React.FC<{
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  onMicPress?: () => void;
  autoFocus?: boolean;
  testID?: string;
}> = ({ value, onChangeText, onSubmit, placeholder, onMicPress, autoFocus, testID }) => (
  <View style={styles.searchBar}>
    <Ionicons name="search" size={22} color={colors.textMuted} />
    <TextInput
      testID={testID}
      style={styles.searchInput}
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmit}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      returnKeyType="search"
      autoCorrect={false}
      autoCapitalize="none"
      autoFocus={autoFocus}
      clearButtonMode="while-editing"
    />
    {onMicPress ? (
      <Pressable accessibilityLabel="Speak" onPress={onMicPress} style={styles.micButton}>
        <Ionicons name="mic" size={22} color={colors.primary} />
      </Pressable>
    ) : null}
  </View>
);

export const ListRow: React.FC<{
  icon?: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  right?: React.ReactNode;
  chevron?: boolean;
  last?: boolean;
  testID?: string;
}> = ({ icon, iconColor = colors.primary, title, subtitle, value, onPress, destructive, right, chevron, last, testID }) => (
  <Pressable
    testID={testID}
    disabled={!onPress}
    onPress={
      onPress
        ? () => {
            tap();
            onPress();
          }
        : undefined
    }
    style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && onPress ? styles.rowPressed : null]}
  >
    {icon ? (
      <View style={[styles.rowIcon, { backgroundColor: destructive ? colors.dangerSoft : `${iconColor}1A` }]}>
        <Ionicons name={icon} size={19} color={destructive ? colors.danger : iconColor} />
      </View>
    ) : null}
    <View style={styles.rowBody}>
      <Text style={[styles.rowTitle, destructive && { color: colors.danger }]} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.rowSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
    {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    {right}
    {chevron ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
  </Pressable>
);

export const ToggleRow: React.FC<{
  icon?: IconName;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  last?: boolean;
  disabled?: boolean;
}> = ({ icon, title, subtitle, value, onChange, last, disabled }) => (
  <ListRow
    icon={icon}
    title={title}
    subtitle={subtitle}
    last={last}
    right={
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          tap();
          onChange(next);
        }}
        trackColor={{ true: colors.primary, false: colors.border }}
      />
    }
  />
);

export const Section: React.FC<{ title?: string; footer?: string; children: React.ReactNode }> = ({
  title,
  footer,
  children,
}) => (
  <View style={styles.section}>
    {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
    <Card padded={false}>{children}</Card>
    {footer ? <Text style={styles.sectionFooter}>{footer}</Text> : null}
  </View>
);

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; locked?: boolean }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              tap();
              onChange(option.value);
            }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            {option.locked ? <Ionicons name="lock-closed" size={12} color={active ? colors.white : colors.textMuted} /> : null}
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const ActionTile: React.FC<{
  icon: IconName;
  title: string;
  subtitle: string;
  color: string;
  onPress: () => void;
  testID?: string;
}> = ({ icon, title, subtitle, color, onPress, testID }) => (
  <Pressable
    testID={testID}
    onPress={() => {
      tap();
      onPress();
    }}
    style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.98 }] }]}
  >
    <View style={[styles.tileIcon, { backgroundColor: color }]}>
      <Ionicons name={icon} size={26} color={colors.white} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileSubtitle}>{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
  </Pressable>
);

export const Badge: React.FC<{ label: string; tone?: 'primary' | 'success' | 'warning' | 'gold' | 'muted' }> = ({
  label,
  tone = 'primary',
}) => {
  const palette = {
    primary: [colors.primarySoft, colors.primary],
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning],
    gold: ['#FFF6D6', '#9A6B00'],
    muted: [colors.surfaceAlt, colors.textSecondary],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette[0] }]}>
      <Text style={[styles.badgeText, { color: palette[1] }]}>{label}</Text>
    </View>
  );
};

export const EmptyState: React.FC<{ icon: IconName; title: string; message: string; action?: React.ReactNode }> = ({
  icon,
  title,
  message,
  action,
}) => (
  <View style={styles.empty}>
    <View style={styles.emptyIcon}>
      <Ionicons name={icon} size={34} color={colors.primary} />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyMessage}>{message}</Text>
    {action}
  </View>
);

export const ScreenTitle: React.FC<{ title: string; subtitle?: string; right?: React.ReactNode }> = ({
  title,
  subtitle,
  right,
}) => (
  <View style={styles.screenTitleRow}>
    <View style={{ flex: 1 }}>
      <Text style={text.title}>{title}</Text>
      {subtitle ? <Text style={[text.secondary, { marginTop: 4 }]}>{subtitle}</Text> : null}
    </View>
    {right}
  </View>
);

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: space(5),
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
  },
  buttonLarge: { minHeight: 58, paddingHorizontal: space(6) },
  buttonText: { fontSize: 16, fontWeight: '700' },
  buttonTextLarge: { fontSize: 18 },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, ...shadow.card },
  cardPadded: { padding: space(4) },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingLeft: space(5),
    paddingRight: space(1.5),
    minHeight: 60,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space(3),
    ...shadow.floating,
  },
  searchInput: { flex: 1, fontSize: 18, color: colors.text, paddingVertical: space(3) },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
    gap: space(3),
    minHeight: 56,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  rowValue: { fontSize: 15, color: colors.textSecondary, fontWeight: '600' },
  section: { marginBottom: space(6) },
  sectionTitle: { ...text.sectionLabel, marginBottom: space(2), marginLeft: space(1) },
  sectionFooter: { ...text.caption, marginTop: space(2), marginHorizontal: space(1), lineHeight: 17 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  segmentTextActive: { color: colors.white },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(4),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space(4),
    ...shadow.card,
  },
  tileIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  tileSubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: space(10), paddingHorizontal: space(6), gap: space(3) },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  emptyMessage: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  screenTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space(5), gap: space(3) },
});
