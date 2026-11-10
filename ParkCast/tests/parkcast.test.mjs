import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocket } from 'ws';
import { server } from '../server/relay-server.js';

test('ParkCast brand & subscription configuration contains Free and Pro plans', () => {
  const brandSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/config/brand.ts'),
    'utf8'
  );
  assert.match(brandSrc, /appName:\s*'ParkCast'/);
  assert.match(brandSrc, /parkcast_pro_yearly_2499/);
  assert.match(brandSrc, /parkcast_pro_monthly_499/);
  assert.match(brandSrc, /parkcast_pro_lifetime_4999/);
  assert.match(brandSrc, /maxSessionSeconds:\s*15\s*\*\s*60/);
});

test('ParkCast WebSocket relay pairs iPhone Controller and Car Screen Receiver by 4-digit PIN', async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 4848;

  const iphoneClient = new WebSocket(`ws://127.0.0.1:${port}`);
  const carScreenClient = new WebSocket(`ws://127.0.0.1:${port}`);

  await Promise.all([
    new Promise((resolve) => iphoneClient.once('open', resolve)),
    new Promise((resolve) => carScreenClient.once('open', resolve)),
  ]);

  iphoneClient.send(JSON.stringify({ type: 'join', roomCode: '7744' }));
  carScreenClient.send(JSON.stringify({ type: 'join', roomCode: '7744' }));

  const receivedOnCar = new Promise((resolve) => {
    carScreenClient.on('message', (data) => {
      const parsed = JSON.parse(String(data));
      if (parsed.type === 'state_update' && parsed.roomCode === '7744') {
        resolve(parsed.payload);
      }
    });
  });

  iphoneClient.send(
    JSON.stringify({
      type: 'state_update',
      roomCode: '7744',
      payload: {
        quality: '1080p',
        aspectMode: 'cinema',
        isPlaying: true,
        activeMediaTitle: 'Swiss Alps 4K Scenic Drive & Lounge',
      },
    })
  );

  const payload = await receivedOnCar;
  assert.equal(payload.quality, '1080p');
  assert.equal(payload.aspectMode, 'cinema');
  assert.equal(payload.isPlaying, true);

  iphoneClient.close();
  carScreenClient.close();
  await new Promise((resolve) => server.close(resolve));
});
