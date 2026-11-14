/*
 * ParkCast web services: legal pages, a health check and the optional "web screen"
 * receiver for cars without CarPlay. CarPlay itself never talks to this server.
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');

const pricing = require(path.join(__dirname, '..', 'src', 'config', 'pricing.json'));
const appConfig = require(path.join(__dirname, '..', 'app.json')).expo;

const PORT = Number(process.env.PORT || process.env.PARKCAST_RELAY_PORT || 4848);
const SUPPORT_EMAIL = process.env.PARKCAST_SUPPORT_EMAIL || appConfig.extra?.supportEmail || '';
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_JOINS_PER_MINUTE = 20;
const CODE_PATTERN = /^\d{6}$/;

const rooms = new Map();
const joinAttempts = new Map();

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function getRoom(code) {
  let room = rooms.get(code);
  if (!room) {
    room = { state: null, screens: new Set(), touchedAt: Date.now() };
    rooms.set(code, room);
  }
  room.touchedAt = Date.now();
  return room;
}

function allowJoin(ip) {
  const now = Date.now();
  const recent = (joinAttempts.get(ip) || []).filter((time) => now - time < 60 * 1000);
  recent.push(now);
  joinAttempts.set(ip, recent);
  return recent.length <= MAX_JOINS_PER_MINUTE;
}

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.screens.size === 0 && now - room.touchedAt > ROOM_TTL_MS) rooms.delete(code);
  }
  for (const [ip, times] of joinAttempts) {
    if (!times.some((time) => now - time < 60 * 1000)) joinAttempts.delete(ip);
  }
}, 60 * 1000).unref();

function planLines() {
  return pricing.plans
    .map((plan) => {
      const trial = plan.trialDays ? ` with a ${plan.trialDays}-day free trial` : '';
      return `<li><strong>${escapeHtml(plan.name)}:</strong> ${escapeHtml(plan.price)} ${escapeHtml(plan.renewalLabel)}${trial}</li>`;
    })
    .join('');
}

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · ParkCast</title>
<style>
body{font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#0E1525;background:#F7F8FB;margin:0}
main{max-width:760px;margin:0 auto;padding:40px 24px 80px}
h1{font-size:32px;letter-spacing:-.5px;margin:0 0 4px}h2{font-size:20px;margin-top:32px}
.muted{color:#5B6475}a{color:#1A73E8}
</style></head><body><main>${body}</main></body></html>`;
}

function privacyPage() {
  const contact = SUPPORT_EMAIL ? `<a href="mailto:${escapeHtml(SUPPORT_EMAIL)}">${escapeHtml(SUPPORT_EMAIL)}</a>` : 'the support address in the App Store listing';
  return page(
    'Privacy Policy',
    `<h1>Privacy Policy</h1><p class="muted">ParkCast ${escapeHtml(appConfig.version)}</p>
<h2>What stays on your iPhone</h2>
<p>Photos, videos, screen mirroring, browsing and voice commands are processed on your iPhone and sent to your car over CarPlay. They are not uploaded to ParkCast servers. Voice recognition runs on-device when your iPhone supports it.</p>
<h2>Location</h2>
<p>Your location is used on your iPhone to show directions, local weather and to pause video while the car is moving. To show the weather, approximate coordinates are sent to Open-Meteo. Location is never stored by ParkCast.</p>
<h2>Web screen (optional)</h2>
<p>If you turn on Web screen, the title and address of web videos you send to the car are relayed through our server to the screen that entered your code. Nothing is kept after the session ends.</p>
<h2>Purchases</h2>
<p>Subscriptions are processed by Apple. We use RevenueCat to check whether your subscription is active; it receives an anonymous app user ID and your purchase receipts.</p>
<h2>Advertising</h2>
<p>The free version may show ads from Google AdMob on the iPhone (never on the car screen). Ads are personalised only if you allow tracking when iOS asks. Premium removes ads.</p>
<h2>Contact</h2><p>Questions: ${contact}.</p>`
  );
}

function termsPage() {
  return page(
    'Terms of Use',
    `<h1>Terms of Use</h1><p class="muted">ParkCast ${escapeHtml(appConfig.version)}</p>
<h2>Safe use</h2>
<p>Video, slideshows, websites and mirroring are for passengers or while parked. ParkCast pauses them automatically when it detects the car moving, but you remain responsible for obeying the law and driving safely.</p>
<h2>ParkCast Premium</h2>
<p>The free version includes ${pricing.freeSessionMinutes} minutes of watching or mirroring per day, at basic (480p) quality, with ads on the iPhone. ParkCast Premium is an auto-renewing subscription:</p>
<ul>${planLines()}</ul>
<p>Payment is charged to your Apple ID at confirmation of purchase. The subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Your account is charged for renewal within 24 hours before the end of the period. Any unused part of a free trial is forfeited when you buy a subscription. Manage or cancel in your App Store account settings.</p>
<h2>Content</h2>
<p>You are responsible for the content you play. Websites opened in ParkCast are subject to their own terms.</p>
<p>Apple's standard <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/">Licensed Application End User License Agreement</a> applies.</p>`
  );
}

const RECEIVER_HTML = fs.readFileSync(path.join(__dirname, 'web-screen.html'), 'utf8');

function send(res, status, type, body) {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  switch (url.pathname) {
    case '/health':
      return send(res, 200, 'application/json', JSON.stringify({ ok: true, version: appConfig.version, rooms: rooms.size }));
    case '/privacy':
      return send(res, 200, 'text/html; charset=utf-8', privacyPage());
    case '/terms':
      return send(res, 200, 'text/html; charset=utf-8', termsPage());
    case '/':
    case '/car':
      return send(res, 200, 'text/html; charset=utf-8', RECEIVER_HTML);
    default:
      return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
  }
});

const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });

wss.on('connection', (ws, req) => {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  let joined = null;

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const code = String(message.roomCode || '');
    if (!CODE_PATTERN.test(code)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Enter the 6-digit code shown in ParkCast › Settings.' }));
      return;
    }

    if (message.type === 'join') {
      if (!allowJoin(ip)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Too many attempts. Wait a minute and try again.' }));
        return;
      }
      if (joined) joined.room.screens.delete(ws);
      const room = getRoom(code);
      const role = message.role === 'phone' ? 'phone' : 'screen';
      if (role === 'screen') room.screens.add(ws);
      joined = { code, role, room };
      ws.send(JSON.stringify({ type: 'joined', roomCode: code, state: role === 'screen' ? room.state : null }));
      return;
    }

    if (message.type === 'state_update' && joined && joined.role === 'phone' && joined.code === code) {
      joined.room.state = message.payload && typeof message.payload === 'object' ? message.payload : null;
      joined.room.touchedAt = Date.now();
      const outgoing = JSON.stringify({ type: 'state', state: joined.room.state });
      for (const screen of joined.room.screens) {
        if (screen.readyState === screen.OPEN) screen.send(outgoing);
      }
    }
  });

  ws.on('close', () => {
    if (joined) joined.room.screens.delete(ws);
  });
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`ParkCast web services listening on :${PORT}`));
}

module.exports = { server, wss, rooms, privacyPage, termsPage };
