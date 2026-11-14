import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCar } from '../context/CarContext';
import { useLibrary } from '../context/LibraryContext';
import { useSettings, type NavApp } from '../context/SettingsContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useMediaPicker } from '../hooks/useMediaPicker';
import { parseSmartSearch, youtubeSearchUrl, type SmartCommand } from '../lib/smartSearch';
import { formatArrival, formatDistance, formatDuration, greetingFor } from '../lib/format';
import type { PlaceResult } from '../native/ParkCastNative';
import { ActionTile, Badge, Card, ListRow, SearchBar, tap } from '../ui/components';
import { colors, radius, space, text } from '../ui/theme';
import { CarStatusCard } from '../components/CarStatusCard';
import { GuidanceBanner } from '../components/GuidanceBanner';
import { AdBanner } from '../ads/ads';
import type { TabId } from '../navigation';

const appIcon = require('../../assets/icon.png');

interface HomeScreenProps {
  onNavigate: (tab: TabId) => void;
  onOpenBrowser: (url?: string) => void;
  onOpenVoice: () => void;
  pendingQuery: string | null;
  onPendingHandled: () => void;
}

const NAV_APPS: Array<{ id: NavApp; label: string }> = [
  { id: 'apple', label: 'Apple Maps' },
  { id: 'google', label: 'Google Maps' },
  { id: 'waze', label: 'Waze' },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onOpenBrowser,
  onOpenVoice,
  pendingQuery,
  onPendingHandled,
}) => {
  const car = useCar();
  const { settings, update } = useSettings();
  const { places } = useLibrary();
  const { isPro, openPaywall } = useSubscription();
  const { pickAndPlay, pickMemories } = useMediaPicker();

  const [query, setQuery] = useState('');
  const [searchedFor, setSearchedFor] = useState('');
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const say = (message: string) => setNotice(message);

  const findPlaces = useCallback(
    async (placeQuery: string) => {
      setSearchedFor(placeQuery);
      car.clearPlannedRoute();
      if (!car.nativeAvailable) {
        setResults([]);
        return;
      }
      if (car.locationStatus !== 'granted') {
        await car.requestLocation();
      }
      setBusy(true);
      try {
        setResults(await car.searchPlaces(placeQuery));
      } catch {
        setResults([]);
      } finally {
        setBusy(false);
      }
    },
    [car]
  );

  const runCommand = useCallback(
    (command: SmartCommand) => {
      switch (command) {
        case 'mirror':
          onNavigate('mirror');
          break;
        case 'library':
          onNavigate('library');
          break;
        case 'memories':
          pickMemories().catch(() => {});
          break;
        case 'settings':
          onNavigate('settings');
          break;
        case 'premium':
          openPaywall();
          break;
        case 'play':
          car.setPlaying(true);
          say('Playing on your car');
          break;
        case 'pause':
          car.setPlaying(false);
          say('Paused');
          break;
        case 'stop':
          car.stop();
          say('Stopped');
          break;
        case 'playLast':
          say(car.playLast() ? 'Playing your last item on the car' : 'Nothing played yet — pick a photo or video first');
          break;
        case 'home':
          car.setMode('home');
          say('Showing the clock on your car');
          break;
        case 'map':
          car.setMode('map');
          say('Showing the map on your car');
          break;
        case 'fill':
          car.setFill(true);
          say('Filling the car screen');
          break;
        case 'fit':
          car.setFill(false);
          say('Fitting to the car screen');
          break;
        case 'unitsKmh':
          update({ units: 'kmh' });
          say('Using kilometres');
          break;
        case 'unitsMph':
          update({ units: 'mph' });
          say('Using miles');
          break;
        case 'endRoute':
          car.endRoute();
          say('Route ended');
          break;
      }
    },
    [car, onNavigate, openPaywall, pickMemories, update]
  );

  const submit = useCallback(
    (raw: string) => {
      setNotice('');
      const intent = parseSmartSearch(raw);
      switch (intent.type) {
        case 'empty':
          return;
        case 'url':
        case 'youtube':
          onOpenBrowser(intent.url);
          return;
        case 'command':
          runCommand(intent.command);
          setQuery('');
          return;
        case 'navigate':
        case 'search':
          findPlaces(intent.query);
          return;
      }
    },
    [findPlaces, onOpenBrowser, runCommand]
  );

  useEffect(() => {
    if (pendingQuery) {
      setQuery(pendingQuery);
      submit(pendingQuery);
      onPendingHandled();
    }
  }, [pendingQuery, submit, onPendingHandled]);

  const clearSearch = () => {
    setQuery('');
    setResults(null);
    setSearchedFor('');
    car.clearPlannedRoute();
  };

  const choosePlace = async (place: PlaceResult) => {
    setBusy(true);
    try {
      await car.planRoute(place);
    } catch (error: any) {
      say(error?.message ?? 'No driving route found.');
    } finally {
      setBusy(false);
    }
  };

  const showingSearch = results !== null || car.plannedRoute !== null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AdBanner visible={!isPro} />
      <View style={styles.header}>
        <Image source={appIcon} style={styles.logo} />
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greetingFor()}</Text>
          <Text style={text.hero}>ParkCast</Text>
        </View>
        {!isPro ? (
          <Pressable onPress={() => openPaywall()} style={styles.premiumChip}>
            <Ionicons name="diamond" size={14} color="#9A6B00" />
            <Text style={styles.premiumText}>Premium</Text>
          </Pressable>
        ) : (
          <Badge label="PREMIUM" tone="gold" />
        )}
      </View>

      <GuidanceBanner />

      <SearchBar
        testID="home-search"
        value={query}
        onChangeText={setQuery}
        onSubmit={() => submit(query)}
        placeholder="Search, paste a link, or say where to"
        onMicPress={onOpenVoice}
      />
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {showingSearch ? (
        <View style={styles.block}>
          <View style={styles.resultsHeader}>
            <Text style={text.sectionLabel}>{car.plannedRoute ? 'Routes' : `Results for “${searchedFor}”`}</Text>
            <Pressable onPress={clearSearch} hitSlop={12}>
              <Text style={styles.link}>Close</Text>
            </Pressable>
          </View>

          {busy ? <ActivityIndicator style={{ marginVertical: space(6) }} color={colors.primary} /> : null}

          {car.plannedRoute ? (
            <Card padded={false}>
              <View style={styles.routeHeader}>
                <Text style={styles.placeName}>{car.plannedRoute.place.name}</Text>
                {car.plannedRoute.place.address ? <Text style={text.secondary}>{car.plannedRoute.place.address}</Text> : null}
              </View>
              {car.plannedRoute.options.map((route, index) => (
                <Pressable
                  key={route.index}
                  onPress={() => {
                    tap();
                    car.startRoute(route.index);
                  }}
                  style={[styles.routeRow, index === 0 && styles.routeRowBest]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.routeTime, index === 0 && { color: colors.success }]}>
                      {formatDuration(route.expectedTravelTime)}
                    </Text>
                    <Text style={text.secondary}>
                      {formatDistance(route.distance, settings.units)}
                      {route.name ? ` · via ${route.name}` : ''} · Arrive {formatArrival(route.expectedTravelTime)}
                    </Text>
                    {route.advisories[0] ? <Text style={styles.advisory}>{route.advisories[0]}</Text> : null}
                  </View>
                  <View style={styles.goButton}>
                    <Text style={styles.goText}>Go</Text>
                  </View>
                </Pressable>
              ))}
              <View style={styles.otherApps}>
                {NAV_APPS.map((app) => (
                  <Pressable
                    key={app.id}
                    style={styles.otherApp}
                    onPress={() => car.plannedRoute && car.openInNavApp(car.plannedRoute.place, app.id)}
                  >
                    <Text style={styles.otherAppText}>{app.label}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          ) : !busy && results ? (
            <Card padded={false}>
              {results.map((place) => (
                <ListRow
                  key={place.id}
                  icon="location"
                  title={place.name}
                  subtitle={place.address}
                  value={place.distance != null ? formatDistance(place.distance, settings.units) : undefined}
                  onPress={() => choosePlace(place)}
                />
              ))}
              {!results.length ? (
                <ListRow
                  icon="map"
                  title={car.nativeAvailable ? 'No places found nearby' : 'Search in Apple Maps'}
                  subtitle={car.nativeAvailable ? 'Try a name, address or category' : searchedFor}
                  onPress={
                    car.nativeAvailable
                      ? undefined
                      : () => onOpenBrowser(`https://maps.apple.com/?q=${encodeURIComponent(searchedFor)}`)
                  }
                />
              ) : null}
              <ListRow
                icon="logo-youtube"
                iconColor="#FF0000"
                title={`YouTube: ${searchedFor}`}
                onPress={() => onOpenBrowser(youtubeSearchUrl(searchedFor))}
                chevron
              />
              <ListRow
                icon="globe-outline"
                title={`Search the web for “${searchedFor}”`}
                onPress={() => onOpenBrowser(`https://www.google.com/search?q=${encodeURIComponent(searchedFor)}`)}
                chevron
                last
              />
            </Card>
          ) : null}
        </View>
      ) : (
        <>
          <View style={styles.block}>
            <CarStatusCard />
          </View>

          <View style={[styles.block, { gap: space(3) }]}>
            <ActionTile
              testID="home-mirror"
              icon="phone-portrait-outline"
              title="Mirror my screen"
              subtitle="Show your whole iPhone on the car"
              color={colors.primary}
              onPress={() => onNavigate('mirror')}
            />
            <ActionTile
              testID="home-media"
              icon="images-outline"
              title="Photos and videos"
              subtitle="Pick one and it plays on the car"
              color="#0F9D58"
              onPress={() => pickAndPlay().catch(() => {})}
            />
            <ActionTile
              testID="home-browse"
              icon="globe-outline"
              title="Browse"
              subtitle="YouTube and any website, watched in the car"
              color="#E8710A"
              onPress={() => onOpenBrowser()}
            />
          </View>

          {places.length ? (
            <View style={styles.block}>
              <Text style={[text.sectionLabel, { marginBottom: space(2) }]}>Recent places</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
                {places.map((place) => (
                  <Pressable key={place.id} style={styles.placeChip} onPress={() => choosePlace(place)}>
                    <Ionicons name="time-outline" size={16} color={colors.primary} />
                    <Text style={styles.placeChipText} numberOfLines={1}>
                      {place.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(5), paddingBottom: space(10) },
  header: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginBottom: space(5) },
  logo: { width: 52, height: 52, borderRadius: 14 },
  greeting: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  premiumChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF6D6',
    paddingHorizontal: space(3),
    paddingVertical: space(2),
    borderRadius: radius.pill,
  },
  premiumText: { color: '#9A6B00', fontWeight: '800', fontSize: 13 },
  notice: { marginTop: space(3), textAlign: 'center', color: colors.primary, fontWeight: '700', fontSize: 15 },
  block: { marginTop: space(6) },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space(2) },
  link: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  routeHeader: { padding: space(4), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  placeName: { fontSize: 20, fontWeight: '800', color: colors.text },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space(4),
    gap: space(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  routeRowBest: { backgroundColor: '#F3FBF6' },
  routeTime: { fontSize: 22, fontWeight: '800', color: colors.text },
  advisory: { fontSize: 12, color: colors.warning, marginTop: 4, fontWeight: '600' },
  goButton: { backgroundColor: colors.success, borderRadius: radius.pill, paddingHorizontal: space(6), paddingVertical: space(3) },
  goText: { color: colors.white, fontWeight: '800', fontSize: 17 },
  otherApps: { flexDirection: 'row', gap: space(2), padding: space(3), flexWrap: 'wrap' },
  otherApp: { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: space(3), paddingVertical: space(2) },
  otherAppText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
  placeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: space(4),
    paddingVertical: space(2.5),
    maxWidth: 220,
  },
  placeChipText: { color: colors.text, fontWeight: '600' },
});
