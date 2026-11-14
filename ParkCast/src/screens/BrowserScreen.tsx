import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView as BaseWebView, type WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useCar } from '../context/CarContext';
import { useSettings } from '../context/SettingsContext';
import { AD_BLOCK_CSS, AD_HOST_PATTERNS, BROWSER_FAVORITES } from '../config/browser';
import { carFriendlyUrl, normalizeUrl, parseSmartSearch } from '../lib/smartSearch';
import { Button, IconButton } from '../ui/components';
import { colors, radius, space, text } from '../ui/theme';

const WebView = BaseWebView<{}>;
type WebView = BaseWebView<{}>;

const PAUSE_PHONE_VIDEO = "document.querySelectorAll('video').forEach(function(v){v.pause();});true;";

const adBlockScript = `(function(){var s=document.createElement('style');s.textContent=${JSON.stringify(
  `${AD_BLOCK_CSS}{display:none!important}`
)};document.documentElement.appendChild(s);window.open=function(){return null;};})();true;`;

function toUrl(input: string): string | null {
  const intent = parseSmartSearch(input);
  if (intent.type === 'url' || intent.type === 'youtube') return intent.url;
  if (intent.type === 'empty') return null;
  return `https://www.google.com/search?q=${encodeURIComponent(input.trim())}`;
}

const hostOf = (url: string) => url.replace(/^https?:\/\//i, '').split('/')[0];

export const BrowserScreen: React.FC<{ visible: boolean; initialUrl?: string; onClose: () => void }> = ({
  visible,
  initialUrl,
  onClose,
}) => {
  const car = useCar();
  const { settings } = useSettings();
  const webRef = useRef<WebView>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [title, setTitle] = useState('');
  const [nav, setNav] = useState({ canGoBack: false, canGoForward: false, loading: false });

  useEffect(() => {
    if (visible) {
      const start = initialUrl ? normalizeUrl(initialUrl) : null;
      setUrl(start);
      setAddress(start ?? '');
    }
  }, [visible, initialUrl]);

  const go = (input: string) => {
    const next = toUrl(input);
    if (next) {
      setUrl(next);
      setAddress(next);
    }
  };

  const onNavigationStateChange = (state: WebViewNavigation) => {
    setNav({ canGoBack: state.canGoBack, canGoForward: state.canGoForward, loading: state.loading });
    setTitle(state.title ?? '');
    setAddress(state.url);
    if (state.url && state.url !== 'about:blank') setUrl(state.url);
  };

  const castingThis = car.mode === 'web' && car.media?.kind === 'web';

  const watchInCar = () => {
    if (!url) return;
    const target = carFriendlyUrl(url);
    const started = car.play({ kind: 'web', uri: target, title: title || hostOf(target), subtitle: hostOf(target) });
    if (started) webRef.current?.injectJavaScript(PAUSE_PHONE_VIDEO);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <IconButton icon="close" label="Close browser" onPress={onClose} size={40} />
          <View style={styles.addressBox}>
            <Ionicons name={url?.startsWith('https') ? 'lock-closed' : 'search'} size={14} color={colors.textMuted} />
            <TextInput
              style={styles.addressInput}
              value={address}
              onChangeText={setAddress}
              onSubmitEditing={() => go(address)}
              placeholder="Search or type a website"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="web-search"
              returnKeyType="go"
              selectTextOnFocus
            />
          </View>
          <IconButton
            icon={nav.loading ? 'close-circle-outline' : 'refresh'}
            label="Reload"
            size={40}
            disabled={!url}
            onPress={() => (nav.loading ? webRef.current?.stopLoading() : webRef.current?.reload())}
          />
        </View>

        <View style={{ flex: 1 }}>
          {url ? (
            <WebView
              ref={webRef}
              source={{ uri: url }}
              style={{ flex: 1 }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              allowsBackForwardNavigationGestures
              setSupportMultipleWindows={false}
              pullToRefreshEnabled
              injectedJavaScript={settings.browserAdBlock ? adBlockScript : undefined}
              onNavigationStateChange={onNavigationStateChange}
              onShouldStartLoadWithRequest={(request) =>
                !settings.browserAdBlock || !AD_HOST_PATTERNS.some((pattern) => request.url.includes(pattern))
              }
            />
          ) : (
            <ScrollView contentContainerStyle={styles.start}>
              <Text style={text.title}>Browse</Text>
              <Text style={[text.secondary, { marginBottom: space(5) }]}>
                Open a site, start a video, then tap Watch in Car.
              </Text>
              <View style={styles.grid}>
                {BROWSER_FAVORITES.map((favorite) => (
                  <Pressable key={favorite.url} style={styles.favorite} onPress={() => go(favorite.url)}>
                    <View style={[styles.favoriteIcon, { backgroundColor: favorite.color }]}>
                      <Ionicons name={favorite.icon} size={26} color={colors.white} />
                    </View>
                    <Text style={styles.favoriteText}>{favorite.title}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        <View style={styles.bottomBar}>
          {castingThis ? (
            <View style={styles.remote}>
              <IconButton icon="play-back" label="Back 10 seconds" onPress={() => car.seekBy(-10)} />
              <IconButton
                icon={car.playing ? 'pause' : 'play'}
                label={car.playing ? 'Pause' : 'Play'}
                size={54}
                color={colors.white}
                background={colors.primary}
                onPress={car.togglePlay}
              />
              <IconButton icon="play-forward" label="Forward 10 seconds" onPress={() => car.seekBy(10)} />
              <IconButton icon={car.fill ? 'contract' : 'expand'} label="Fit or fill" onPress={() => car.setFill(!car.fill)} />
              <IconButton icon="stop" label="Stop" onPress={car.stop} />
            </View>
          ) : (
            <View style={styles.remote}>
              <IconButton icon="chevron-back" label="Back" disabled={!nav.canGoBack} onPress={() => webRef.current?.goBack()} />
              <IconButton
                icon="chevron-forward"
                label="Forward"
                disabled={!nav.canGoForward}
                onPress={() => webRef.current?.goForward()}
              />
              <Button title="Watch in Car" icon="car-sport" onPress={watchInCar} disabled={!url} style={{ flex: 1 }} />
            </View>
          )}
          {castingThis ? (
            <Text style={styles.castingNote}>
              {car.moving ? 'Paused while driving' : `Playing on your car · ${car.media?.title ?? ''}`}
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(3), paddingVertical: space(2) },
  addressBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space(4),
  },
  addressInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: space(2.5) },
  start: { padding: space(5) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(4) },
  favorite: { width: '21%', alignItems: 'center', gap: space(2) },
  favoriteIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  favoriteText: { fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center' },
  bottomBar: {
    paddingHorizontal: space(4),
    paddingTop: space(3),
    paddingBottom: space(2),
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  remote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(3) },
  castingNote: { textAlign: 'center', color: colors.textSecondary, fontSize: 13, marginTop: space(2), fontWeight: '600' },
});
