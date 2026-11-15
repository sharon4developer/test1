import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const SCANNED = ['App.tsx', 'src', 'plugins', 'modules/parkcast-native/ios', 'server'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.swift', '.html']);

// Values from the 1.x demo build that must never come back.
const FORBIDDEN = [
  '4829',
  '10.0.0.87',
  '43.6532',
  '-79.3832',
  'Turn Right',
  'Swiss Alps',
  'ysz5S6PUM-U',
  'gtv-videos-bucket',
  'onrender.com',
  'BigBuckBunny',
  'innertube',
  'setTimeout(() => setIsPro(true)',
];

function walk(target) {
  const full = path.join(root, target);
  if (!fs.existsSync(full)) return [];
  if (fs.statSync(full).isFile()) return [full];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) return walk(child);
    return EXTENSIONS.has(path.extname(entry.name)) ? [path.join(root, child)] : [];
  });
}

const files = SCANNED.flatMap(walk);

test('source tree is scanned', () => {
  assert.ok(files.length > 30, `expected many source files, found ${files.length}`);
});

for (const value of FORBIDDEN) {
  test(`no hard-coded "${value}"`, () => {
    const offenders = files.filter((file) => fs.readFileSync(file, 'utf8').toLowerCase().includes(value.toLowerCase()));
    assert.deepEqual(offenders.map((file) => path.relative(root, file)), []);
  });
}

test('legacy demo screens and cloud polling are gone', () => {
  for (const removed of [
    'src/context/CastSessionContext.tsx',
    'src/screens/CarReceiverScreen.tsx',
    'src/screens/DashboardScreen.tsx',
    'src/screens/PlayerRemoteScreen.tsx',
    'src/screens/NavigationLandingScreen.tsx',
    'src/screens/VoiceCommandModal.tsx',
  ]) {
    assert.equal(fs.existsSync(path.join(root, removed)), false, `${removed} should be deleted`);
  }
});

test('prices exist only in pricing.json', () => {
  const pricing = JSON.parse(fs.readFileSync(path.join(root, 'src/config/pricing.json'), 'utf8'));
  for (const plan of pricing.plans) {
    const offenders = files.filter((file) => fs.readFileSync(file, 'utf8').includes(plan.price));
    assert.deepEqual(offenders.map((file) => path.relative(root, file)), [], `${plan.price} is duplicated`);
  }
});

test('runtime endpoints are configured in app.json, not code', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
  assert.match(app.extra.relayUrl, /^https:\/\//);
  assert.match(app.extra.weatherApiUrl, /^https:\/\//);
  assert.ok(Number.isInteger(app.extra.mirrorPort) && app.extra.mirrorPort > 1024);
});
