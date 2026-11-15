import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCar } from '../context/CarContext';
import { useLibrary } from '../context/LibraryContext';
import { useSettings } from '../context/SettingsContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useMediaPicker } from '../hooks/useMediaPicker';
import { parseSmartSearch, youtubeSearchUrl, type SmartCommand } from '../lib/smartSearch';
import { formatDistance, greetingFor } from '../lib/format';
import { isNativeAvailable, NATIVE_UNAVAILABLE_TEXT, nativeUnavailableReason, type PlaceResult } from '../native/ParkCastNative';
import { usePlaceSuggestions } from '../hooks/usePlaceSuggestions';
import type { NavigateStart } from './NavigateScreen';
import { ActionTile, Badge, Card, ListRow, SearchBar, tap } from '../ui/components';
import { colors, radius, space, text } from '../ui/theme';
import { CarStatusCard } from '../components/CarStatusCard';
import { GuidanceBanner } from '../components/GuidanceBanner';
import { AdBanner } from '../ads/ads';
import { ParkedCarCard } from '../components/ParkedCarCard';
import { NEARBY_CATEGORIES } from '../config/nearby';
import { ParkCastNative } from '../native/ParkCastNative';
import type { TabId } from '../navigation';

const appIcon = require('../../assets/icon.png');

interface HomeScreenProps {
  onNavigate: (tab: TabId) => void;
  onOpenBrowser: (url?: string) => void;
  onOpenNavigate: (start?: NavigateStart) => void;
  onOpenVoice: () => void;
  pendingQuery: string | null;
  onPendingHandled: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onOpenBrowser,
  onOpenNavigate,
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
        case 'parkedCar': {
          const parked = ParkCastNative.getParkedCar();
          if (parked) {
            Linking.openURL(`http://maps.apple.com/?daddr=${parked.latitude},${parked.longitude}&dirflg=w`).catch(() => {});
          } else {
            say('No parking spot saved yet');
          }
          break;
        }
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
          setQuery('');
          setResults(null);
          onOpenNavigate({ type: 'query', query: intent.query });
          return;
        case 'search':
          findPlaces(intent.query);
          return;
      }
    },
    [findPlaces, onOpenBrowser, onOpenNavigate, runCommand]
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
  };

  const choosePlace = (place: PlaceResult) => onOpenNavigate({ type: 'place', place });

  const showingSearch = results !== null;
  const { suggestions } = usePlaceSuggestions(query, !showingSearch);
  const unavailable = !isNativeAvailable ? NATIVE_UNAVAILABLE_TEXT[nativeUnavailableReason ?? 'missingFromBuild'] : null;

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

      {!showingSearch && suggestions.length ? (
        <Card padded={false} style={styles.suggestions}>
          {suggestions.map((suggestion, index) => (
            <ListRow
              key={suggestion.id}
              testID={`home-suggestion-${index}`}
              icon={suggestion.isQuery ? 'search' : 'location'}
              iconColor={suggestion.isQuery ? colors.textSecondary : colors.danger}
              title={suggestion.title}
              subtitle={suggestion.subtitle}
              onPress={() => {
                setQuery('');
                onOpenNavigate({ type: 'suggestion', suggestion });
              }}
              last={index === suggestions.length - 1}
            />
          ))}
        </Card>
      ) : null}

      {showingSearch ? (
        <View style={styles.block}>
          <View style={styles.resultsHeader}>
            <Text style={text.sectionLabel}>{`Results for “${searchedFor}”`}</Text>
            <Pressable onPress={clearSearch} hitSlop={12}>
              <Text style={styles.link}>Close</Text>
            </Pressable>
          </View>

          {busy ? <ActivityIndicator style={{ marginVertical: space(6) }} color={colors.primary} /> : null}

          {!busy && results ? (
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
                  title={unavailable ? 'Search in Apple Maps' : 'No places found nearby'}
                  subtitle={unavailable ? unavailable.title : 'Try a name, address or category'}
                  onPress={
                    unavailable ? () => Linking.openURL(`http://maps.apple.com/?q=${encodeURIComponent(searchedFor)}`).catch(() => {}) : undefined
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.nearbyRow}
            contentContainerStyle={{ gap: space(2), paddingRight: space(10) }}
            keyboardShouldPersistTaps="handled"
          >
            {NEARBY_CATEGORIES.map((category) => (
              <Pressable
                key={category.id}
                testID={`nearby-${category.id}`}
                style={styles.nearbyChip}
                onPress={() => {
                  tap();
                  onOpenNavigate({ type: 'category', id: category.id, label: category.label });
                }}
              >
                <Ionicons name={category.icon} size={16} color={category.color} />
                <Text style={styles.placeChipText}>{category.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.block}>
            <CarStatusCard />
          </View>

          <View style={styles.block}>
            <ParkedCarCard />
          </View>

          <View style={[styles.block, { gap: space(3) }]}>
            <ActionTile
              testID="home-navigate"
              icon="navigate"
              title="Navigate"
              subtitle={car.guidance?.active ? 'Route in progress, tap to view' : 'Search places, see routes, turn-by-turn on the car'}
              color="#34C759"
              onPress={() => onOpenNavigate()}
            />
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
  suggestions: { marginTop: space(3) },
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
  nearbyRow: { marginTop: space(4), marginHorizontal: -space(5), paddingHorizontal: space(5) },
  nearbyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: space(4),
    paddingVertical: space(2.5),
  },
});
