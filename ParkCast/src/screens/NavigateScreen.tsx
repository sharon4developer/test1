import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCar } from '../context/CarContext';
import { useLibrary } from '../context/LibraryContext';
import { useSettings, type NavApp } from '../context/SettingsContext';
import { usePlaceSuggestions } from '../hooks/usePlaceSuggestions';
import { NavMap, type NavMapHandle } from '../components/NavMap';
import { GuidanceBanner } from '../components/GuidanceBanner';
import { NEARBY_CATEGORIES } from '../config/nearby';
import {
  isNativeAvailable,
  NATIVE_UNAVAILABLE_TEXT,
  nativeUnavailableReason,
  ParkCastNative,
  type PlaceResult,
  type PlaceSuggestion,
} from '../native/ParkCastNative';
import { formatArrival, formatDistance, formatDuration } from '../lib/format';
import { tap } from '../ui/components';
import { colors, radius, shadow, space } from '../ui/theme';

export type NavigateStart =
  | { type: 'category'; id: string; label: string }
  | { type: 'suggestion'; suggestion: PlaceSuggestion }
  | { type: 'place'; place: PlaceResult }
  | { type: 'query'; query: string };

const NAV_APPS: Array<{ id: NavApp; label: string }> = [
  { id: 'apple', label: 'Apple Maps' },
  { id: 'google', label: 'Google Maps' },
  { id: 'waze', label: 'Waze' },
];

type Snap = 'collapsed' | 'medium' | 'expanded';

export const NavigateScreen: React.FC<{ visible: boolean; start?: NavigateStart; onClose: () => void }> = ({
  visible,
  start,
  onClose,
}) => {
  const car = useCar();
  const { places: recentPlaces } = useLibrary();
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const mapRef = useRef<NavMapHandle>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [resultsTitle, setResultsTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [focused, setFocused] = useState(false);

  const guiding = Boolean(car.guidance?.active);
  const planned = car.plannedRoute;
  const { suggestions, loading: suggesting } = usePlaceSuggestions(query, focused && !planned);
  const showSuggestions = focused && query.trim().length > 0 && !planned;

  // Bottom sheet
  const heights = useMemo(
    () => ({
      collapsed: 168 + insets.bottom,
      medium: Math.round(windowHeight * 0.46),
      expanded: windowHeight - insets.top - 56,
    }),
    [insets.bottom, insets.top, windowHeight]
  );
  const [snap, setSnap] = useState<Snap>('medium');
  const offsetFor = useCallback((target: Snap) => heights.expanded - heights[target], [heights]);
  const translateY = useRef(new Animated.Value(heights.expanded - heights.medium)).current;
  const dragStart = useRef(0);

  const snapTo = useCallback(
    (target: Snap) => {
      setSnap(target);
      Animated.spring(translateY, { toValue: offsetFor(target), useNativeDriver: true, bounciness: 2, speed: 16 }).start();
    },
    [offsetFor, translateY]
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
        onPanResponderGrant: () => {
          translateY.stopAnimation((value) => {
            dragStart.current = value;
          });
        },
        onPanResponderMove: (_, gesture) => {
          translateY.setValue(Math.min(offsetFor('collapsed'), Math.max(0, dragStart.current + gesture.dy)));
        },
        onPanResponderRelease: (_, gesture) => {
          const position = dragStart.current + gesture.dy + gesture.vy * 120;
          const options: Snap[] = ['expanded', 'medium', 'collapsed'];
          const nearest = options.reduce((best, option) =>
            Math.abs(offsetFor(option) - position) < Math.abs(offsetFor(best) - position) ? option : best
          );
          if (nearest !== 'expanded') Keyboard.dismiss();
          snapTo(nearest);
        },
      }),
    [offsetFor, snapTo, translateY]
  );

  const visibleSheet = guiding ? 0 : heights[snap];

  // Actions
  const fail = (message: string) => {
    setError(message);
    setBusy(false);
  };

  const choosePlace = useCallback(
    async (place: PlaceResult) => {
      tap();
      Keyboard.dismiss();
      setFocused(false);
      setError('');
      setBusy(true);
      setSelectedRoute(0);
      try {
        if (car.locationStatus !== 'granted') await car.requestLocation();
        await car.planRoute(place);
        snapTo('medium');
      } catch (failure: any) {
        setError(failure?.message ?? 'No driving route found.');
      } finally {
        setBusy(false);
      }
    },
    [car, snapTo]
  );

  const showResults = (title: string, list: PlaceResult[]) => {
    setResultsTitle(title);
    setResults(list);
    snapTo('medium');
  };

  const searchCategory = useCallback(
    async (id: string, label: string) => {
      tap();
      Keyboard.dismiss();
      setFocused(false);
      setQuery('');
      setError('');
      car.clearPlannedRoute();
      setResultsTitle(`${label} nearby`);
      setResults([]);
      if (car.locationStatus !== 'granted' && !(await car.requestLocation())) {
        fail('Allow location so ParkCast can find places near you.');
        return;
      }
      setBusy(true);
      try {
        showResults(`${label} nearby`, await car.searchNearby(id));
      } catch (failure: any) {
        fail(failure?.message ?? 'Search failed.');
      } finally {
        setBusy(false);
      }
    },
    [car]
  );

  const searchText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      Keyboard.dismiss();
      setFocused(false);
      setError('');
      car.clearPlannedRoute();
      if (!isNativeAvailable) {
        setResultsTitle(`“${trimmed}”`);
        setResults([]);
        fail(NATIVE_UNAVAILABLE_TEXT[nativeUnavailableReason ?? 'missingFromBuild'].detail);
        return;
      }
      setBusy(true);
      try {
        showResults(`“${trimmed}”`, await car.searchPlaces(trimmed));
      } catch (failure: any) {
        fail(failure?.message ?? 'Search failed.');
      } finally {
        setBusy(false);
      }
    },
    [car]
  );

  const pickSuggestion = useCallback(
    async (suggestion: PlaceSuggestion) => {
      tap();
      Keyboard.dismiss();
      setFocused(false);
      setQuery(suggestion.title);
      setError('');
      setBusy(true);
      try {
        const found = await ParkCastNative.resolveSuggestion(suggestion.id);
        if (found.length === 1 && !suggestion.isQuery) {
          setResults(null);
          await choosePlace(found[0]);
        } else {
          showResults(suggestion.title, found);
        }
      } catch (failure: any) {
        fail(failure?.message ?? 'Search failed.');
      } finally {
        setBusy(false);
      }
    },
    [choosePlace]
  );

  const closeRoutes = () => {
    car.clearPlannedRoute();
    setError('');
    if (!results) snapTo('medium');
  };

  const clearAll = () => {
    setQuery('');
    setResults(null);
    setError('');
    car.clearPlannedRoute();
  };

  const go = async () => {
    tap();
    await car.startRoute(planned?.options[selectedRoute]?.index ?? 0);
  };

  const openParkedCar = () => {
    const parked = ParkCastNative.getParkedCar();
    if (parked) Linking.openURL(`http://maps.apple.com/?daddr=${parked.latitude},${parked.longitude}&dirflg=w`).catch(() => {});
  };

  const close = () => {
    if (!guiding) clearAll();
    setFocused(false);
    onClose();
  };

  // Opening with a category, suggestion, place or query from Home.
  useEffect(() => {
    if (!visible) return;
    setError('');
    setSelectedRoute(0);
    translateY.setValue(offsetFor('medium'));
    setSnap('medium');
    if (car.locationStatus !== 'granted') car.requestLocation().catch(() => {});
    if (!start) return;
    switch (start.type) {
      case 'category':
        searchCategory(start.id, start.label);
        break;
      case 'suggestion':
        pickSuggestion(start.suggestion);
        break;
      case 'place':
        setResults(null);
        choosePlace(start.place);
        break;
      case 'query':
        setQuery(start.query);
        searchText(start.query);
        break;
    }
    // Only react to a new open request.
  }, [visible, start]);

  const parked = visible ? ParkCastNative.getParkedCar() : null;
  const unavailable = !isNativeAvailable ? NATIVE_UNAVAILABLE_TEXT[nativeUnavailableReason ?? 'missingFromBuild'] : null;

  // Sheet content
  const renderBrowse = () => (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
        {NEARBY_CATEGORIES.map((category) => (
          <Pressable
            key={category.id}
            testID={`navigate-nearby-${category.id}`}
            style={styles.chip}
            onPress={() => searchCategory(category.id, category.label)}
          >
            <View style={[styles.chipIcon, { backgroundColor: category.color }]}>
              <Ionicons name={category.icon} size={22} color={colors.white} />
            </View>
            <Text style={styles.chipText} numberOfLines={1}>
              {category.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {unavailable ? (
        <View style={styles.warning}>
          <Ionicons name="alert-circle" size={20} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>{unavailable.title}</Text>
            <Text style={styles.warningText}>{unavailable.detail}</Text>
          </View>
        </View>
      ) : null}

      {parked ? (
        <>
          <Text style={styles.sectionLabel}>Your car</Text>
          <View style={styles.group}>
            <Row icon="car" iconColor={colors.primary} title="Parked car" subtitle={parked.address || 'Walking directions'} onPress={openParkedCar} last />
          </View>
        </>
      ) : null}

      {recentPlaces.length ? (
        <>
          <Text style={styles.sectionLabel}>Recents</Text>
          <View style={styles.group}>
            {recentPlaces.slice(0, 8).map((place, index, list) => (
              <Row
                key={place.id}
                icon="time"
                iconColor={colors.textSecondary}
                title={place.name}
                subtitle={place.address}
                onPress={() => choosePlace(place)}
                last={index === list.length - 1}
              />
            ))}
          </View>
        </>
      ) : null}
    </>
  );

  const renderSuggestions = () => (
    <View style={styles.group}>
      {suggestions.map((suggestion, index) => (
        <Row
          key={suggestion.id}
          icon={suggestion.isQuery ? 'search' : 'location'}
          iconColor={suggestion.isQuery ? colors.textSecondary : colors.danger}
          title={suggestion.title}
          subtitle={suggestion.subtitle}
          onPress={() => pickSuggestion(suggestion)}
          last={index === suggestions.length - 1 && !query.trim()}
        />
      ))}
      {!suggestions.length && suggesting ? <ActivityIndicator style={{ margin: space(4) }} color={colors.primary} /> : null}
      {query.trim() ? (
        <Row icon="search" iconColor={colors.primary} title={`Search “${query.trim()}”`} onPress={() => searchText(query)} last />
      ) : null}
    </View>
  );

  const renderResults = () => (
    <>
      <View style={styles.headerRow}>
        <Text style={styles.sheetTitle} numberOfLines={1}>
          {resultsTitle}
        </Text>
        <CloseButton onPress={clearAll} />
      </View>
      {busy ? <ActivityIndicator style={{ margin: space(5) }} color={colors.primary} /> : null}
      {!busy && results?.length ? (
        <View style={styles.group}>
          {results.map((place, index) => (
            <Row
              key={place.id}
              icon="location"
              iconColor={colors.danger}
              title={place.name}
              subtitle={place.address}
              value={place.distance != null ? formatDistance(place.distance, settings.units) : undefined}
              onPress={() => choosePlace(place)}
              last={index === results.length - 1}
            />
          ))}
        </View>
      ) : null}
      {!busy && results && !results.length && !error ? <Text style={styles.empty}>Nothing found nearby.</Text> : null}
    </>
  );

  const renderRoutes = () => {
    if (!planned) return null;
    const option = planned.options[selectedRoute] ?? planned.options[0];
    return (
      <>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {planned.place.name}
            </Text>
            {planned.place.address ? (
              <Text style={styles.subtle} numberOfLines={1}>
                {planned.place.address}
              </Text>
            ) : null}
          </View>
          <CloseButton onPress={closeRoutes} />
        </View>

        <View style={{ gap: space(2) }}>
          {planned.options.map((route, index) => {
            const active = index === selectedRoute;
            return (
              <Pressable
                key={route.index}
                testID={`route-${index}`}
                onPress={() => {
                  tap();
                  setSelectedRoute(index);
                }}
                style={[styles.routeCard, active && styles.routeCardActive]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.routeTime, index === 0 && { color: colors.success }]}>{formatDuration(route.expectedTravelTime)}</Text>
                  <Text style={styles.subtle}>
                    {formatDistance(route.distance, settings.units)}
                    {route.name ? ` · via ${route.name}` : ''}
                  </Text>
                  {route.advisories[0] ? <Text style={styles.advisory}>{route.advisories[0]}</Text> : null}
                </View>
                <Text style={styles.arrival}>Arrive {formatArrival(route.expectedTravelTime)}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable testID="navigate-go" onPress={go} style={({ pressed }) => [styles.goButton, pressed && { opacity: 0.85 }]}>
          <Text style={styles.goText}>Go</Text>
          {option ? <Text style={styles.goSub}>{formatDuration(option.expectedTravelTime)}</Text> : null}
        </Pressable>
        <Text style={styles.goHint}>
          {settings.navApp === 'parkcast'
            ? car.carConnected
              ? 'Turn-by-turn directions start on your car screen.'
              : 'Directions show here and on CarPlay when you connect.'
            : `Opens in ${NAV_APPS.find((app) => app.id === settings.navApp)?.label ?? 'your maps app'} (change in Settings).`}
        </Text>

        <View style={styles.otherApps}>
          {NAV_APPS.map((app) => (
            <Pressable key={app.id} style={styles.otherApp} onPress={() => car.openInNavApp(planned.place, app.id)}>
              <Text style={styles.otherAppText}>{app.label}</Text>
            </Pressable>
          ))}
        </View>
      </>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={styles.root}>
        <NavMap
          ref={mapRef}
          userLocation={car.location}
          places={planned ? [] : results ?? []}
          destination={planned?.place ?? null}
          routes={planned?.options ?? []}
          selectedRoute={selectedRoute}
          following={guiding}
          bottomInset={guiding ? 120 + insets.bottom : visibleSheet}
          topInset={guiding ? 190 + insets.top : insets.top + 56}
          onSelectPlace={choosePlace}
          onSelectRoute={setSelectedRoute}
        />

        <View style={[styles.topControls, { top: insets.top + space(2) }]} pointerEvents="box-none">
          <MapButton icon="chevron-down" label="Close" onPress={close} />
          {!guiding ? <MapButton icon="navigate" label="Show my location" onPress={() => mapRef.current?.recenter()} /> : null}
        </View>

        {guiding ? (
          <View style={[styles.guidance, { top: insets.top + space(16) }]}>
            <GuidanceBanner />
          </View>
        ) : (
          <Animated.View style={[styles.sheet, shadow.floating, { height: heights.expanded, transform: [{ translateY }] }]}>
            <View {...pan.panHandlers} style={styles.grabArea}>
              <View style={styles.grabber} />
              {!planned && !results ? (
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={19} color={colors.textMuted} />
                  <TextInput
                    testID="navigate-search"
                    style={styles.searchInput}
                    value={query}
                    onChangeText={setQuery}
                    onFocus={() => {
                      setFocused(true);
                      snapTo('expanded');
                    }}
                    onSubmitEditing={() => searchText(query)}
                    placeholder="Search Maps"
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="search"
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                  />
                  {focused ? (
                    <Pressable
                      onPress={() => {
                        Keyboard.dismiss();
                        setFocused(false);
                        setQuery('');
                        snapTo('medium');
                      }}
                      hitSlop={10}
                    >
                      <Text style={styles.cancel}>Cancel</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + space(6) + (heights.expanded - heights[snap]) }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                  <Pressable
                    onPress={() =>
                      Linking.openURL(`http://maps.apple.com/?q=${encodeURIComponent(planned?.place.name ?? (query || resultsTitle))}`).catch(() => {})
                    }
                  >
                    <Text style={styles.errorLink}>Open in Apple Maps</Text>
                  </Pressable>
                </View>
              ) : null}
              {busy && !results && !planned ? <ActivityIndicator style={{ margin: space(5) }} color={colors.primary} /> : null}
              {planned ? renderRoutes() : showSuggestions ? renderSuggestions() : results ? renderResults() : renderBrowse()}
            </ScrollView>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
};

const Row: React.FC<{
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  title: string;
  subtitle?: string;
  value?: string;
  onPress: () => void;
  last?: boolean;
}> = ({ icon, iconColor, title, subtitle, value, onPress, last }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && { backgroundColor: colors.surfaceAlt }]}>
    <View style={[styles.rowIcon, { backgroundColor: `${iconColor}1A` }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
    {value ? <Text style={styles.rowValue}>{value}</Text> : null}
  </Pressable>
);

const CloseButton: React.FC<{ onPress: () => void }> = ({ onPress }) => (
  <Pressable accessibilityLabel="Close" onPress={onPress} hitSlop={10} style={styles.closeButton}>
    <Ionicons name="close" size={18} color={colors.textSecondary} />
  </Pressable>
);

const MapButton: React.FC<{ icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }> = ({
  icon,
  label,
  onPress,
}) => (
  <Pressable accessibilityLabel={label} onPress={onPress} style={[styles.mapButton, shadow.card]}>
    <Ionicons name={icon} size={22} color={colors.primary} />
  </Pressable>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#DDE7F3' },
  topControls: { position: 'absolute', left: space(4), right: space(4), flexDirection: 'row', justifyContent: 'space-between' },
  mapButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidance: { position: 'absolute', left: space(3), right: space(3) },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F7F7F9',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  grabArea: { paddingHorizontal: space(4), paddingBottom: space(2) },
  grabber: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: '#C9CDD5', marginTop: 8, marginBottom: space(3) },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    backgroundColor: '#E8E9EE',
    borderRadius: 12,
    paddingHorizontal: space(3),
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 17, color: colors.text, paddingVertical: space(2) },
  cancel: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  sheetContent: { paddingHorizontal: space(4), gap: space(3) },
  chips: { gap: space(4), paddingVertical: space(2), paddingRight: space(4) },
  chip: { alignItems: 'center', width: 68, gap: 6 },
  chipIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.text },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.textSecondary, marginTop: space(2) },
  group: { backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(3), paddingVertical: space(3), minHeight: 56 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowValue: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  subtle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  sheetTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: colors.text },
  closeButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E3E4E9', alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: colors.textSecondary, marginVertical: space(5), fontWeight: '600' },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: space(4),
    borderWidth: 2,
    borderColor: 'transparent',
  },
  routeCardActive: { borderColor: colors.primary },
  routeTime: { fontSize: 22, fontWeight: '800', color: colors.text },
  arrival: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  advisory: { fontSize: 12, color: colors.warning, marginTop: 4, fontWeight: '600' },
  goButton: {
    backgroundColor: colors.success,
    borderRadius: 14,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space(2),
  },
  goText: { color: colors.white, fontSize: 20, fontWeight: '800' },
  goSub: { color: '#D8F5E3', fontSize: 15, fontWeight: '700' },
  goHint: { textAlign: 'center', fontSize: 13, color: colors.textSecondary },
  otherApps: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), justifyContent: 'center' },
  otherApp: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space(3), paddingVertical: space(2) },
  otherAppText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
  warning: { flexDirection: 'row', gap: space(3), backgroundColor: colors.warningSoft, borderRadius: 14, padding: space(3) },
  warningTitle: { fontWeight: '800', color: colors.text },
  warningText: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: 14, padding: space(3), gap: space(2) },
  errorText: { color: colors.danger, fontWeight: '700' },
  errorLink: { color: colors.primary, fontWeight: '700' },
});
