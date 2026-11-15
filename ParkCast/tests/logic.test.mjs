import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { parseSmartSearch, carFriendlyUrl, normalizeUrl } from '../src/lib/smartSearch.ts';
import { formatDistance, formatDuration, formatClock, formatSpeed, greetingFor } from '../src/lib/format.ts';
import { parseM3u } from '../src/lib/m3u.ts';
import { formatWeather, weatherSummary } from '../src/lib/weather.ts';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);

test('smart search understands navigation', () => {
  assert.deepEqual(parseSmartSearch('Take me to Union Station'), { type: 'navigate', query: 'union station' });
  assert.deepEqual(parseSmartSearch('nearest gas station'), { type: 'navigate', query: 'nearest gas station' });
  assert.deepEqual(parseSmartSearch('Hey ParkCast, find a parking lot'), { type: 'navigate', query: 'parking lot' });
});

test('smart search understands commands', () => {
  assert.deepEqual(parseSmartSearch('Mirror my phone'), { type: 'command', command: 'mirror' });
  assert.deepEqual(parseSmartSearch('play my last video'), { type: 'command', command: 'playLast' });
  assert.deepEqual(parseSmartSearch('pause'), { type: 'command', command: 'pause' });
  assert.deepEqual(parseSmartSearch('end route'), { type: 'command', command: 'endRoute' });
  assert.deepEqual(parseSmartSearch('switch to miles'), { type: 'command', command: 'unitsMph' });
  assert.deepEqual(parseSmartSearch('show memories'), { type: 'command', command: 'memories' });
  assert.deepEqual(parseSmartSearch('Where did I park?'), { type: 'command', command: 'parkedCar' });
  assert.deepEqual(parseSmartSearch("where's my car"), { type: 'command', command: 'parkedCar' });
});

test('smart search understands video and links', () => {
  const yt = parseSmartSearch('lofi beats on YouTube');
  assert.equal(yt.type, 'youtube');
  assert.equal(yt.url, 'https://m.youtube.com/results?search_query=lofi%20beats');
  assert.equal(parseSmartSearch('play cat videos').type, 'youtube');
  assert.deepEqual(parseSmartSearch('vimeo.com/123'), { type: 'url', url: 'https://vimeo.com/123' });
  assert.deepEqual(parseSmartSearch('   '), { type: 'empty' });
  assert.deepEqual(parseSmartSearch('coffee'), { type: 'search', query: 'coffee' });
});

test('YouTube links become car-friendly watch pages', () => {
  assert.equal(carFriendlyUrl('https://youtu.be/dQw4w9WgXcQ'), 'https://m.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(carFriendlyUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'https://m.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(carFriendlyUrl('https://www.youtube.com/watch?v=abc'), 'https://m.youtube.com/watch?v=abc');
  assert.equal(carFriendlyUrl('https://vimeo.com/1'), 'https://vimeo.com/1');
  assert.equal(normalizeUrl('example.com'), 'https://example.com');
});

test('distance, duration and speed formatting respect units', () => {
  assert.equal(formatDistance(250, 'kmh'), '250 m');
  assert.equal(formatDistance(4200, 'kmh'), '4.2 km');
  assert.equal(formatDistance(100, 'mph'), '350 ft');
  assert.equal(formatDistance(16093.44, 'mph'), '10 mi');
  assert.equal(formatDuration(30), '1 min');
  assert.equal(formatDuration(3900), '1 h 5 min');
  assert.equal(formatClock(3725), '1:02:05');
  assert.equal(formatSpeed(10, 'kmh'), '36 km/h');
  assert.equal(formatSpeed(10, 'mph'), '22 mph');
  assert.equal(greetingFor(new Date(2026, 0, 1, 9)), 'Good morning');
});

test('M3U playlists parse names, groups and URLs', () => {
  const channels = parseM3u('#EXTM3U\n#EXTINF:-1 tvg-logo="l.png" group-title="News",World News\nhttps://a.example/news.m3u8\n');
  assert.equal(channels.length, 1);
  assert.equal(channels[0].name, 'World News');
  assert.equal(channels[0].group, 'News');
  assert.equal(channels[0].url, 'https://a.example/news.m3u8');
});

test('weather is formatted from real data only', () => {
  assert.equal(formatWeather(null, 'kmh'), '');
  assert.equal(typeof weatherSummary(0), 'string');
});

test('pricing matches the published plans', () => {
  const pricing = JSON.parse(fs.readFileSync(path.join(root, 'src/config/pricing.json'), 'utf8'));
  const prices = Object.fromEntries(pricing.plans.map((plan) => [plan.id, plan.price]));
  assert.deepEqual(prices, { weekly: '$1.49', monthly: '$2.99', quarterly: '$5.99', yearly: '$11.99' });
  assert.equal(pricing.entitlementId, 'pro');
  for (const plan of pricing.plans) assert.match(plan.productId, /^parkcast\./);
});

test('legal pages are generated from pricing.json', () => {
  const { termsPage, privacyPage, wss, server } = require('../server/relay-server.js');
  const terms = termsPage();
  for (const price of ['$1.49', '$2.99', '$5.99', '$11.99']) assert.ok(terms.includes(price), `terms missing ${price}`);
  assert.match(privacyPage(), /on your iPhone/);
  wss.close();
  server.close();
});

test('Expo config wires CarPlay, mirroring and the native module', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
  const plugins = app.plugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));
  assert.ok(plugins.includes('./plugins/withParkCastCarPlay'));
  assert.ok(plugins.includes('./plugins/withParkCastBroadcast'));
  assert.ok(fs.existsSync(path.join(root, 'modules/parkcast-native/ios/ParkCastCarPlaySceneDelegate.swift')));
  assert.ok(fs.existsSync(path.join(root, 'plugins/broadcast/SampleHandler.swift')));
  assert.equal(app.ios.infoPlist.NSLocationWhenInUseUsageDescription.length > 20, true);
});

test('native module sources are committed, so EAS builds include them', (t) => {
  let tracked;
  try {
    tracked = execFileSync('git', ['ls-files', 'modules/parkcast-native', 'plugins/broadcast'], { cwd: root, encoding: 'utf8' });
  } catch {
    t.skip('not a git checkout');
    return;
  }
  for (const file of [
    'modules/parkcast-native/expo-module.config.json',
    'modules/parkcast-native/ios/ParkCastNative.podspec',
    'modules/parkcast-native/ios/ParkCastNativeModule.swift',
    'modules/parkcast-native/ios/ParkCastCarPlaySceneDelegate.swift',
    'plugins/broadcast/SampleHandler.swift',
  ]) {
    assert.ok(tracked.includes(file), `${file} is not committed; EAS would build without it`);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.expo.autolinking.nativeModulesDir, './modules');
});

test('nearby categories match the native list', () => {
  const swift = fs.readFileSync(path.join(root, 'modules/parkcast-native/ios/NavigationEngine.swift'), 'utf8');
  const native = [...swift.matchAll(/NearbyCategory\(id: "([a-z]+)"/g)].map((match) => match[1]);
  const js = [...fs.readFileSync(path.join(root, 'src/config/nearby.ts'), 'utf8').matchAll(/\{ id: '([a-z]+)'/g)].map((match) => match[1]);
  assert.ok(native.length >= 6);
  assert.deepEqual(js, native);
});
