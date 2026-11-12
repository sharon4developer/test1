#!/usr/bin/env node
/**
 * ParkCast Realtime Pairing Relay & Standalone Car Screen Receiver Server
 *
 * Features:
 * 1. WebSocket (`ws://<HOST>:4848`) + HTTP `/sync` fallback
 * 2. iPhone Camera Roll Photo & Video upload (`POST /upload` & `POST /upload-file`)
 *    with automatic ffmpeg H.264 MP4 transcoding for iPhone `.mov` (HEVC) clips
 *    and HTTP 206 Byte-Range streaming so Linux Chrome plays iPhone videos smoothly!
 * 3. Standalone Car Cinema Receiver Web Player (`http://<HOST>:4848/car`)
 */

const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT || process.env.PARKCAST_RELAY_PORT || 4848);
const rooms = new Map();
const MEDIA_DIR = path.join(os.tmpdir(), 'parkcast-media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });

// Map of mediaId -> { filePath, mimeType }
const uploadedMedia = new Map();
const LIVE_MIRROR_JPG = path.join(MEDIA_DIR, 'live-mirror.jpg');
let uxplayProcess = null;
let uxplayActive = false;

function startWholePhoneAirPlayReceiver() {
  if (uxplayProcess) return;
  try {
    // Use -p so uxplay binds fixed ports (TCP 7000,7001,7100 and UDP 6000,6001,7011)
    // and opens a clean native 60fps window when the iPhone connects via Control Center.
    const child = spawn('uxplay', ['-n', 'ParkCast Car Display', '-nh', '-p'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    uxplayProcess = child;
    uxplayActive = true;

    child.stdout.on('data', (data) => {
      const line = String(data).trim();
      if (line) {
        console.log(`[AirPlay Full-Phone Mirror] ${line}`);
      }
    });

    child.stderr.on('data', (data) => {
      const line = String(data).trim();
      if (line) {
        console.log(`[AirPlay Mirror Notice] ${line}`);
      }
    });

    child.on('error', () => {
      uxplayActive = false;
      uxplayProcess = null;
    });

    child.on('exit', () => {
      uxplayActive = false;
      uxplayProcess = null;
    });
  } catch {
    uxplayActive = false;
  }
}

function getLocalLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '10.0.0.87';
}

function getPublicBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `${getLocalLanIp()}:${PORT}`;
  return `${proto}://${host}`;
}

function getOrCreateRoom(code) {
  const clean = String(code || '4829').trim();
  if (!rooms.has(clean)) {
    rooms.set(clean, { clients: new Set(), lastState: null });
  }
  return { code: clean, room: rooms.get(clean) };
}

function broadcastRoomState(code, payload, senderWs = null) {
  const { code: clean, room } = getOrCreateRoom(code);
  room.lastState = payload;

  const message = JSON.stringify({
    type: 'state_update',
    roomCode: clean,
    payload,
  });

  for (const client of room.clients) {
    if (client !== senderWs && client.readyState === 1) {
      client.send(message);
    }
  }
}

function transcodeToBrowserMp4IfNeeded(inputPath, callback) {
  const outputPath = `${inputPath}-h264.mp4`;
  execFile(
    'ffmpeg',
    [
      '-y',
      '-i',
      inputPath,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-c:a',
      'aac',
      outputPath,
    ],
    { timeout: 60000 },
    (err) => {
      if (!err && fs.existsSync(outputPath)) {
        callback(outputPath, 'video/mp4');
      } else {
        callback(inputPath, 'video/mp4');
      }
    }
  );
}

const CAR_RECEIVER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ParkCast Car Screen</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #F4F6FB; color: #0F172A; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
    .top-bar { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: #FFFFFF; border-bottom: 1px solid #E2E8F0; }
    .status-group { display: flex; align-items: center; gap: 10px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: #10B981; }
    .pin-box { background: #EFF6FF; color: #1D4ED8; font-weight: 800; padding: 5px 12px; border-radius: 8px; font-size: 13px; border: 1px solid #BFDBFE; }
    .badges { display: flex; gap: 8px; align-items: center; }
    .badge { background: #F1F5F9; color: #334155; padding: 5px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; }
    .main { flex: 1; display: flex; position: relative; overflow: hidden; margin: 14px; border-radius: 22px; background: #0F172A; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12); border: 1px solid #CBD5E1; }
    .dock { width: 70px; background: #FFFFFF; border-right: 1px solid #E2E8F0; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 16px 0; z-index: 5; color: #0F172A; }
    .dock-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; color: #fff; margin-bottom: 10px; }
    .stage { flex: 1; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #0F172A; }
    video, iframe, #photoViewer { width: 100%; height: 100%; border: none; background: #000; position: relative; z-index: 4; }
    #photoViewer { object-fit: contain; display: none; }
    .fit-contain { object-fit: contain; }
    .fit-cover { object-fit: cover; }
    .fit-cinema { object-fit: cover; transform: scale(1.12); }
    .visualizer-fallback { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%); z-index: 1; padding: 24px; text-align: center; color: #0F172A; }
    .hud-top { position: absolute; top: 14px; left: 16px; right: 16px; display: flex; justify-content: space-between; align-items: center; background: rgba(255, 255, 255, 0.92); padding: 10px 16px; border-radius: 14px; border-left: 4px solid #2563EB; pointer-events: none; z-index: 10; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
    .hud-title { font-size: 16px; font-weight: 800; color: #0F172A; }
    .hud-sub { font-size: 11px; color: #2563EB; font-weight: 800; text-transform: uppercase; }
    .cursor { position: absolute; padding: 6px 10px; background: #2563EB; border: 2px solid #FFFFFF; border-radius: 14px; color: #FFFFFF; font-size: 11px; font-weight: 800; pointer-events: none; z-index: 30; transition: left 0.12s ease, top 0.12s ease; box-shadow: 0 4px 12px rgba(37,99,235,0.4); }
    .mirror-overlay { position: absolute; inset: 0; background: #F8FAFC; display: none; flex-direction: column; z-index: 20; color: #0F172A; }
    .mirror-header { background: #FFFFFF; padding: 10px 18px; border-bottom: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
    .mirror-body { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
    .phone-frame { width: 360px; height: 90%; background: #FFFFFF; border: 3px solid #2563EB; border-radius: 30px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 16px 40px rgba(15,23,42,0.12); }
    .app-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px; }
    .app-tile { padding: 16px 8px; border-radius: 14px; text-align: center; font-weight: 800; font-size: 11px; color: #fff; }
    .bottom-bar { background: #FFFFFF; border-top: 1px solid #E2E8F0; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #475569; z-index: 25; }
    .stage-row { flex: 1; display: flex; width: 100%; height: 100%; position: relative; overflow: hidden; }
    .stage-primary { flex: 1; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; height: 100%; }
    .map-pane { display: none; flex-direction: column; justify-content: space-between; background: #E8EEF5; color: #0F172A; position: relative; overflow: hidden; height: 100%; padding: 18px; z-index: 18; }
    .map-pane.full-map { flex: 1; display: flex; }
    .map-pane.split-map { width: 38%; min-width: 310px; display: flex; border-left: 2px solid #CBD5E1; }
    .top-tab-strip { display: flex; gap: 6px; }
    .top-tab-btn { background: #F1F5F9; color: #475569; border: 1px solid #E2E8F0; padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; }
    .top-tab-btn.active { background: #2563EB; color: #FFFFFF; border-color: #2563EB; }
  </style>
</head>
<body>
  <div class="top-bar">
    <div class="status-group">
      <div class="dot" id="connDot"></div>
      <strong id="carTitle" style="font-size:16px">ParkCast Car Display</strong>
      <span class="pin-box" id="pinDisplay">Car Code: 4829</span>
    </div>
    <div class="top-tab-strip">
      <button class="top-tab-btn active" id="tabBtn-map" onclick="switchLocalTab('map')">🧭 Drive & Map</button>
      <button class="top-tab-btn" id="tabBtn-library" onclick="switchLocalTab('library')">🅿️ Parked Lounge</button>
      <button class="top-tab-btn" id="tabBtn-browser" onclick="switchLocalTab('browser')">🌐 Web</button>
      <button class="top-tab-btn" id="tabBtn-mirror" onclick="switchLocalTab('mirror')">📱 Mirror</button>
      <button class="top-tab-btn" id="tabBtn-split" onclick="toggleLocalSplit()">◫ Split-View</button>
      <button class="top-tab-btn" id="tabBtn-voice" onclick="startCarVoiceControl()" style="background:#EFF6FF;color:#1D4ED8;border-color:#BFDBFE">🎤 Voice</button>
    </div>
    <div class="badges">
      <span class="badge" id="carTabBadge">MAP</span>
      <span class="badge" id="speedUnitBadge">MPH</span>
      <span class="badge" id="qualityBadge">GPS HD</span>
      <span class="badge" id="aspectBadge">FIT</span>
      <span class="badge" id="volBadge">VOL 85%</span>
    </div>
  </div>

  <div class="main" id="mainRow">
    <div class="dock">
      <div style="text-align:center">
        <div style="font-weight:800;font-size:14px" id="clockText">12:45</div>
        <div style="font-size:10px;color:#2563EB;font-weight:700">CarPlay</div>
      </div>
      <div>
        <div class="dock-icon" style="background:#2563EB;cursor:pointer" onclick="switchLocalTab('map')">NAV</div>
        <div class="dock-icon" style="background:#10B981;cursor:pointer" onclick="switchLocalTab('map')">MAP</div>
        <div class="dock-icon" style="background:#475569;cursor:pointer" onclick="switchLocalTab('library')">POI</div>
      </div>
      <div style="width:28px;height:28px;border-radius:14px;border:2px solid #94A3B8"></div>
    </div>

    <div class="stage" style="display:none">
      <div class="hud-top">
        <div>
          <div class="hud-sub" id="hudCategory">NOW SHOWING</div>
          <div class="hud-title" id="hudTitle">Downtown EV Supercharger & Parking Plaza</div>
        </div>
        <div class="badge" id="lastActionBadge">Connected to iPhone</div>
      </div>

      <div class="visualizer-fallback" id="visualizerFallback">
        <div style="background:#FFFFFF;border:1px solid #DBEAFE;border-radius:22px;padding:28px 36px;max-width:480px;box-shadow:0 12px 30px rgba(37,99,235,0.08)">
          <div style="color:#16A34A;font-size:12px;font-weight:800;letter-spacing:0.6px;margin-bottom:8px">● CONNECTED TO YOUR IPHONE</div>
          <h2 style="font-size:22px;margin-bottom:8px;color:#0F172A" id="stageCenterTitle">Parked Rest-Stop Companion</h2>
          <p style="color:#475569;font-size:14px;line-height:1.5" id="stageCenterSub">Use Turn-by-Turn Navigation, Voice Control, or open Parked Lounge on your iPhone.</p>
        </div>
      </div>

      <video id="videoPlayer" controls playsinline autoplay muted loop class="fit-contain" style="display:none"></video>
      <iframe id="ytFrame" style="display:none" allow="autoplay; encrypted-media; fullscreen"></iframe>
      <img id="photoViewer" alt="Casted iPhone Photo" />

      <div class="mirror-overlay" id="mirrorOverlay">
        <div class="mirror-header">
          <span style="color:#7C3AED;font-weight:800">● LIVE IPHONE SCREEN MIRROR</span>
          <span id="mirrorUrlLabel" style="color:#2563EB;font-weight:700">Mirroring iPhone</span>
        </div>
        <div class="mirror-body">
          <iframe id="mirrorWebFrame" style="display:none;width:100%;height:100%;border:none;background:#fff"></iframe>
          <img id="liveAirPlayImg" style="display:none;height:96%;width:auto;max-width:96%;object-fit:contain;border-radius:26px;border:3px solid #2563EB;box-shadow:0 16px 40px rgba(15,23,42,0.22);background:#000" alt="Live iPhone Screen" />
          <div class="phone-frame" id="mirrorPhoneMock">
            <div style="display:flex;justify-content:space-between;font-size:12px;color:#475569;font-weight:700">
              <span>iPhone Whole-Screen Mirror</span>
              <span style="color:#EF4444">● LIVE 60FPS</span>
            </div>
            <div>
              <div style="font-size:17px;font-weight:800;margin-bottom:6px;text-align:center;color:#0F172A">Mirror Your Entire iPhone</div>
              <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:14px;padding:12px;font-size:12px;color:#1E3A8A;line-height:1.5;margin-bottom:10px">
                <strong>Step 1:</strong> Swipe down from the top-right corner of your iPhone to open <strong>Control Center</strong>.<br/>
                <strong>Step 2:</strong> Tap the <strong>Screen Mirroring</strong> icon (two rectangles).<br/>
                <strong>Step 3:</strong> Tap <strong>"ParkCast Car Display"</strong> — your entire iPhone screen & apps will appear live!
              </div>
              <div class="app-grid">
                <div class="app-tile" style="background:#DC2626">YouTube</div>
                <div class="app-tile" style="background:#2563EB">Safari</div>
                <div class="app-tile" style="background:#16A34A">Photos</div>
                <div class="app-tile" style="background:#EA580C">Videos</div>
                <div class="app-tile" style="background:#7C3AED">Music</div>
                <div class="app-tile" style="background:#0284C7">Maps</div>
              </div>
            </div>
            <div style="font-size:12px;color:#2563EB;text-align:center;font-weight:700" id="mirrorLiveStatus">
              Ready for Control Center -> Screen Mirroring
            </div>
          </div>
        </div>
      </div>

      <div class="cursor" id="remoteCursor" style="left:68%;top:36%">● Pointer</div>
    </div>

    <!-- Turn-by-Turn CarPlay Navigation Map Pane (Default Full Map on Load) -->
    <div class="map-pane full-map" id="carMapPane">
      <svg viewBox="0 0 800 600" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;z-index:1">
        <rect width="800" height="600" fill="#E8EEF5"/>
        <polygon points="0,0 350,0 300,240 0,210" fill="#D1FAE5"/>
        <polygon points="480,280 800,240 800,600 510,600" fill="#DCFCE7"/>
        <path d="M 360,-10 C 410,160 320,340 270,610 L 355,610 C 405,340 495,160 445,-10 Z" fill="#93C5FD"/>
        <g stroke="#FFFFFF" stroke-width="12">
          <line x1="0" y1="130" x2="800" y2="170"/>
          <line x1="0" y1="290" x2="800" y2="275"/>
          <line x1="0" y1="430" x2="800" y2="415"/>
          <line x1="180" y1="0" x2="210" y2="600"/>
          <line x1="520" y1="0" x2="495" y2="600"/>
          <line x1="680" y1="0" x2="660" y2="600"/>
        </g>
        <path d="M 480,580 L 502,420 L 668,415 L 675,140" stroke="#1E40AF" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M 480,580 L 502,420 L 668,415 L 675,140" stroke="#3B82F6" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <circle cx="675" cy="140" r="16" fill="#EF4444" stroke="#FFFFFF" stroke-width="4"/>
        <circle cx="495" cy="485" r="20" fill="#FFFFFF" stroke="#2563EB" stroke-width="5"/>
        <polygon points="495,472 485,494 495,489 505,494" fill="#2563EB"/>
      </svg>

      <!-- Top Turn Maneuver Card -->
      <div style="position:relative;z-index:5;background:#0F172A;color:#FFFFFF;border-radius:18px;padding:16px 18px;box-shadow:0 12px 28px rgba(15,23,42,0.25);max-width:440px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span id="mapProviderLabel" style="background:#10B981;color:#fff;font-size:11px;font-weight:800;padding:3px 10px;border-radius:6px">APPLE MAPS</span>
          <span id="mapSpeedBadge" style="background:#1E293B;color:#38BDF8;font-size:11px;font-weight:800;padding:3px 10px;border-radius:6px">0 MPH · PARKED</span>
        </div>
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:48px;height:48px;border-radius:12px;background:#2563EB;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900">↱</div>
          <div>
            <div id="mapTurnDist" style="font-size:22px;font-weight:900;color:#60A5FA">0.4 mi · Turn Right</div>
            <div style="font-size:15px;font-weight:700;color:#FFFFFF">Queensway Blvd East</div>
          </div>
        </div>
      </div>

      <!-- Bottom Trip Estimate Card -->
      <div style="position:relative;z-index:5;background:rgba(255,255,255,0.96);border:1px solid #CBD5E1;border-radius:16px;padding:14px 18px;box-shadow:0 8px 24px rgba(15,23,42,0.14);max-width:460px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div id="mapEtaLine" style="font-size:18px;font-weight:900;color:#16A34A">14 min · 2.4 mi · ETA 1:02 PM</div>
          <div id="mapDestLabel" style="font-size:13px;font-weight:700;color:#475569;margin-top:2px">To: Downtown Charging & Lounge</div>
        </div>
        <div style="border:2.5px solid #0F172A;border-radius:8px;padding:4px 10px;text-align:center;background:#fff">
          <div style="font-size:8px;font-weight:800">LIMIT</div>
          <div id="mapLimitVal" style="font-size:17px;font-weight:900">35</div>
        </div>
      </div>
    </div>
  </div>

  <div class="bottom-bar">
    <div id="playStatusText">🧭 Active Turn-by-Turn Route Guidance · 0 MPH (Parked) · Voice Control Ready</div>
    <div style="display:flex;gap:8px">
      <button onclick="startCarVoiceControl()"
        style="background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;padding:8px 14px;border-radius:10px;font-weight:800;cursor:pointer">
        🎤 Speak Command
      </button>
      <button onclick="const v=document.getElementById('videoPlayer'); v.muted=false; v.play().catch(()=>{}); this.textContent='🔊 Voice Guidance On';"
        style="background:#2563EB;color:#fff;border:none;padding:8px 16px;border-radius:10px;font-weight:700;cursor:pointer">
        🔊 Voice Guidance On
      </button>
    </div>
  </div>

  <script>
    const params = new URLSearchParams(window.location.search);
    let roomCode = params.get('pin') || '4829';
    document.getElementById('pinDisplay').textContent = 'PIN: ' + roomCode;

    const videoEl = document.getElementById('videoPlayer');
    const ytFrame = document.getElementById('ytFrame');
    const photoViewer = document.getElementById('photoViewer');
    const mirrorOverlay = document.getElementById('mirrorOverlay');
    const mirrorWebFrame = document.getElementById('mirrorWebFrame');
    const mirrorPhoneMock = document.getElementById('mirrorPhoneMock');
    const stagePrimary = document.querySelector('.stage');
    const carMapPane = document.getElementById('carMapPane');
    let currentMediaUrl = '';
    let currentYtId = '';
    let currentMirrorUrl = '';
    let lastUpdatedAt = 0;
    let lastStateCache = { carActiveTab: 'map', carSplitView: false, speedUnit: 'mph', navProvider: 'apple_maps', navDestination: 'Downtown EV Supercharger & Parking Plaza' };

    function switchLocalTab(tab) {
      lastStateCache = Object.assign({}, lastStateCache, { carActiveTab: tab, mirrorMode: tab === 'mirror' ? 'screen_broadcast' : 'off', updatedAt: Date.now() });
      applyState(lastStateCache);
    }

    function toggleLocalSplit() {
      lastStateCache = Object.assign({}, lastStateCache, { carSplitView: !lastStateCache.carSplitView, updatedAt: Date.now() });
      applyState(lastStateCache);
    }

    function startCarVoiceControl() {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          rec.lang = 'en-US';
          document.getElementById('playStatusText').textContent = '🎤 Listening... Say "Navigate to Airport", "Find Parking", "Switch to KM/H", or "Split View"';
          rec.onresult = (ev) => {
            const phrase = (ev.results && ev.results[0] && ev.results[0][0] && ev.results[0][0].transcript) || '';
            if (phrase) handleSpokenPhraseOnCar(phrase);
          };
          rec.start();
          return;
        } catch (e) {}
      }
      const fallback = prompt('Speak or type any Voice Command (e.g., "Navigate to Central Station", "Find EV Charger", "Switch to KM/H", "Split View"):');
      if (fallback) handleSpokenPhraseOnCar(fallback);
    }

    function handleSpokenPhraseOnCar(phrase) {
      const lower = phrase.toLowerCase();
      let nextPatch = { lastRemoteAction: 'Voice: "' + phrase + '"', updatedAt: Date.now() };
      if (lower.includes('km') || lower.includes('kilometer')) {
        nextPatch.speedUnit = 'kmh';
      } else if (lower.includes('mph') || lower.includes('mile')) {
        nextPatch.speedUnit = 'mph';
      } else if (lower.includes('waze')) {
        nextPatch.navProvider = 'waze';
        nextPatch.carActiveTab = 'map';
      } else if (lower.includes('google')) {
        nextPatch.navProvider = 'google_maps';
        nextPatch.carActiveTab = 'map';
      } else if (lower.includes('split')) {
        nextPatch.carSplitView = !lower.includes('off');
      } else if (lower.includes('mirror')) {
        nextPatch.carActiveTab = 'mirror';
        nextPatch.mirrorMode = 'screen_broadcast';
      } else if (lower.includes('lounge') || lower.includes('video') || lower.includes('tv')) {
        nextPatch.carActiveTab = 'library';
      } else {
        const dest = phrase.replace(/^(navigate|route|drive|go)\s+to\s+/i, '').trim();
        nextPatch.navDestination = dest;
        nextPatch.carActiveTab = 'map';
      }
      lastStateCache = Object.assign({}, lastStateCache, nextPatch);
      applyState(lastStateCache);
      fetch('/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, payload: lastStateCache }),
      }).catch(() => {});
    }

    // If a video URL fails to decode or is a local phone file:// path, show a clear diagnostic on stage
    videoEl.addEventListener('error', () => {
      videoEl.style.display = 'none';
      document.getElementById('stageCenterSub').textContent =
        'Uploading / transcoding video stream for Car Screen...';
    });

    function extractYouTubeId(urlOrId) {
      if (!urlOrId) return null;
      const m = String(urlOrId).match(/(?:youtu\\.be\\/|youtube\\.com\\/(?:watch\\?v=|embed\\/|shorts\\/))([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
      if (/^[A-Za-z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
      return null;
    }

    function applyState(s) {
      if (!s) return;
      if (s.updatedAt && s.updatedAt <= lastUpdatedAt) return;
      if (s.updatedAt) lastUpdatedAt = s.updatedAt;
      lastStateCache = Object.assign({}, lastStateCache, s);

      const activeTab = s.carActiveTab || 'library';
      const splitOn = Boolean(s.carSplitView);
      const unit = s.speedUnit || 'mph';
      const navProv = s.navProvider === 'waze' ? 'WAZE' : s.navProvider === 'google_maps' ? 'GOOGLE MAPS' : 'APPLE MAPS';

      ['library', 'browser', 'mirror', 'map'].forEach((t) => {
        const btn = document.getElementById('tabBtn-' + t);
        if (btn) btn.className = 'top-tab-btn' + (activeTab === t ? ' active' : '');
      });
      const splitBtn = document.getElementById('tabBtn-split');
      if (splitBtn) splitBtn.className = 'top-tab-btn' + (splitOn ? ' active' : '');

      // Update Map Pane labels & visibility
      document.getElementById('mapProviderLabel').textContent = navProv;
      document.getElementById('mapSpeedBadge').textContent = unit === 'mph' ? '0 MPH · PARKED' : '0 KM/H · PARKED';
      document.getElementById('mapTurnDist').textContent = (unit === 'mph' ? '0.4 mi' : '650 m') + ' · Turn Right';
      document.getElementById('mapEtaLine').textContent = '14 min · ' + (unit === 'mph' ? '2.4 mi' : '3.9 km') + ' · ETA 1:02 PM';
      document.getElementById('mapDestLabel').textContent = 'To: ' + (s.navDestination || 'Downtown Charging & Lounge');
      document.getElementById('mapLimitVal').textContent = unit === 'mph' ? '35' : '50';

      if (activeTab === 'map' && !splitOn) {
        stagePrimary.style.display = 'none';
        carMapPane.className = 'map-pane full-map';
        videoEl.pause();
        document.getElementById('playStatusText').textContent =
          '🧭 Active Turn-by-Turn Route Guidance to ' +
          (s.navDestination || 'Downtown EV Supercharger & Parking Plaza') +
          ' · 0 ' +
          unit.toUpperCase() +
          ' (Parked)';
        return;
      } else if (splitOn) {
        stagePrimary.style.display = 'flex';
        carMapPane.className = 'map-pane split-map';
      } else {
        stagePrimary.style.display = 'flex';
        carMapPane.className = 'map-pane';
      }

      document.getElementById('qualityBadge').textContent = s.quality || '480p';
      document.getElementById('aspectBadge').textContent = (s.aspectMode || 'fit').toUpperCase();
      document.getElementById('volBadge').textContent = s.isMuted ? 'MUTED' : ('VOL ' + (s.volume ?? 85) + '%');
      document.getElementById('carTabBadge').textContent = ((s.carActiveTab || 'library') + (s.carSplitView ? ' + SPLIT' : '')).toUpperCase();
      document.getElementById('speedUnitBadge').textContent = (s.speedUnit || 'mph').toUpperCase();
      document.getElementById('lastActionBadge').textContent = s.lastRemoteAction || 'Synced with iPhone';

      if (s.cursorPos) {
        const c = document.getElementById('remoteCursor');
        c.style.left = s.cursorPos.x + '%';
        c.style.top = s.cursorPos.y + '%';
      }

      if (s.steeringSide === 'right') {
        document.getElementById('mainRow').style.flexDirection = 'row-reverse';
      } else {
        document.getElementById('mainRow').style.flexDirection = 'row';
      }

      if (s.mirrorMode === 'photo_slideshow' && s.selectedPhotoUri) {
        mirrorOverlay.style.display = 'none';
        videoEl.pause();
        videoEl.style.display = 'none';
        ytFrame.style.display = 'none';
        photoViewer.style.display = 'block';
        photoViewer.src = s.selectedPhotoUri;
        document.getElementById('hudTitle').textContent = 'iPhone Camera Roll Photo Cast';
        document.getElementById('hudCategory').textContent = 'LIVE PHOTO MIRROR · ' + (s.quality || '1080p');
        return;
      } else {
        photoViewer.style.display = 'none';
      }

      if (s.mirrorMode === 'screen_broadcast') {
        mirrorOverlay.style.display = 'flex';
        videoEl.pause();
        document.getElementById('mirrorLiveStatus').textContent = s.lastRemoteAction || 'Live Mirroring from iPhone';
        if (s.mirrorWebUrl) {
          document.getElementById('mirrorUrlLabel').textContent = s.mirrorWebUrl;
          const ytMirrorId = extractYouTubeId(s.mirrorWebUrl);
          const targetEmbed = ytMirrorId
            ? ('https://www.youtube.com/embed/' + ytMirrorId + '?autoplay=1&mute=1&rel=0')
            : s.mirrorWebUrl;
          mirrorPhoneMock.style.display = 'none';
          mirrorWebFrame.style.display = 'block';
          if (currentMirrorUrl !== targetEmbed) {
            currentMirrorUrl = targetEmbed;
            mirrorWebFrame.src = targetEmbed;
          }
        } else {
          mirrorWebFrame.style.display = 'none';
          mirrorPhoneMock.style.display = 'flex';
        }
        return;
      } else {
        mirrorOverlay.style.display = 'none';
      }

      if (s.activeMedia) {
        document.getElementById('hudTitle').textContent = s.activeMedia.title;
        document.getElementById('stageCenterTitle').textContent = s.activeMedia.title;
        document.getElementById('hudCategory').textContent =
          (s.activeMedia.category || 'stream').toUpperCase() + ' · ' + (s.quality || '480p');

        const streamUrl = String(s.activeMedia.streamUrl || '');
        const ytId = extractYouTubeId(s.activeMedia.youtubeId || streamUrl);

        // Ignore raw iPhone-only file:// paths until the HTTP upload URL arrives
        if (streamUrl.startsWith('file://') || streamUrl.startsWith('ph://')) {
          videoEl.style.display = 'none';
          ytFrame.style.display = 'none';
          document.getElementById('stageCenterSub').textContent =
            'Uploading "' + s.activeMedia.title + '" from iPhone over Wi-Fi...';
          return;
        }

        if (ytId && !streamUrl.includes('/media/')) {
          videoEl.pause();
          videoEl.style.display = 'none';
          ytFrame.style.display = 'block';
          if (currentYtId !== ytId) {
            currentYtId = ytId;
            ytFrame.src = 'https://www.youtube.com/embed/' + ytId + '?autoplay=1&mute=1&rel=0&playsinline=1';
          }
          document.getElementById('playStatusText').textContent = '▶ Playing YouTube on Car Screen: ' + s.activeMedia.title;
        } else if (streamUrl) {
          ytFrame.style.display = 'none';
          ytFrame.src = '';
          currentYtId = '';
          videoEl.style.display = 'block';
          if (currentMediaUrl !== streamUrl) {
            currentMediaUrl = streamUrl;
            videoEl.src = currentMediaUrl;
            videoEl.load();
          }
          videoEl.className = s.aspectMode === 'fill' ? 'fit-cover' : s.aspectMode === 'cinema' ? 'fit-cinema' : 'fit-contain';
          if (typeof s.volume === 'number') {
            videoEl.volume = Math.max(0, Math.min(1, s.volume / 100));
          }
          if (s.isPlaying) {
            videoEl.play().catch(() => {});
            document.getElementById('playStatusText').textContent = '▶ Playing on Car Screen: ' + s.activeMedia.title;
          } else {
            videoEl.pause();
            document.getElementById('playStatusText').textContent = '❚❚ Paused by iPhone Controller';
          }
        }
      }
    }

    function connectRelay() {
      const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(wsProto + '//' + location.host);

      ws.onopen = () => {
        document.getElementById('connDot').style.background = '#10B981';
        ws.send(JSON.stringify({ type: 'join', roomCode }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'state_update' && msg.payload) {
            applyState(msg.payload);
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        setTimeout(connectRelay, 2000);
      };
    }

    // Also poll /sync every 700ms so HTTP POST updates from iPhone always apply immediately
    setInterval(() => {
      fetch('/sync?pin=' + encodeURIComponent(roomCode))
        .then((r) => r.json())
        .then((d) => {
          if (d && d.payload) applyState(d.payload);
        })
        .catch(() => {});
    }, 700);

    // Poll /mirror-status every 180ms (~6fps smooth live browser feed) when UxPlay is receiving live iPhone AirPlay frames
    const liveAirPlayImg = document.getElementById('liveAirPlayImg');
    setInterval(() => {
      fetch('/mirror-status')
        .then((r) => r.json())
        .then((st) => {
          if (st && st.streaming) {
            mirrorOverlay.style.display = 'flex';
            mirrorPhoneMock.style.display = 'none';
            mirrorWebFrame.style.display = 'none';
            liveAirPlayImg.style.display = 'block';
            liveAirPlayImg.src = '/mirror-frame.jpg?t=' + st.mtime;
            document.getElementById('mirrorUrlLabel').textContent = 'Live iPhone AirPlay Stream Active';
          } else if (liveAirPlayImg.style.display === 'block') {
            liveAirPlayImg.style.display = 'none';
            mirrorPhoneMock.style.display = 'flex';
          }
        })
        .catch(() => {});
    }, 180);

    connectRelay();
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-File-Name, X-Mime-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Check if live AirPlay iPhone mirror frame is actively updating (updated within the last 8 seconds)
  if (req.url && req.url.startsWith('/mirror-status')) {
    let streaming = false;
    let mtime = 0;
    try {
      if (fs.existsSync(LIVE_MIRROR_JPG)) {
        const st = fs.statSync(LIVE_MIRROR_JPG);
        mtime = st.mtimeMs;
        if (st.size > 100 && Date.now() - st.mtimeMs < 8000) {
          streaming = true;
        }
      }
    } catch {}
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, streaming, mtime }));
    return;
  }

  // Serve the latest live iPhone AirPlay JPEG frame to /car
  if (req.url && req.url.startsWith('/mirror-frame.jpg')) {
    try {
      if (fs.existsSync(LIVE_MIRROR_JPG)) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.writeHead(200);
        fs.createReadStream(LIVE_MIRROR_JPG).pipe(res);
        return;
      }
    } catch {}
    res.writeHead(404);
    res.end();
    return;
  }

  // HTTP State Sync endpoint
  if (req.url && req.url.startsWith('/sync')) {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const msg = JSON.parse(body);
          const pin = String(msg.roomCode || '4829').trim();
          if (msg.payload) {
            console.log(
              `[iPhone -> Car PIN ${pin}] ${msg.payload.lastRemoteAction || 'State updated'}`
            );
            broadcastRoomState(pin, msg.payload);
          }
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true, roomCode: pin }));
        } catch {
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false }));
        }
      });
      return;
    }

    const urlObj = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const pin = urlObj.searchParams.get('pin') || '4829';
    const { room } = getOrCreateRoom(pin);
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, roomCode: pin, payload: room.lastState }));
    return;
  }

  // Serve uploaded photos/videos with full HTTP 206 Byte-Range support (required by Chrome <video>)
  if (req.url && req.url.startsWith('/media/')) {
    const id = req.url.replace('/media/', '').split('?')[0];
    const item = uploadedMedia.get(id);
    if (!item || !fs.existsSync(item.filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const stat = fs.statSync(item.filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(item.filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': item.mimeType,
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
        'Content-Type': item.mimeType,
      });
      fs.createReadStream(item.filePath).pipe(res);
    }
    return;
  }

  // Receive raw binary or multipart video/photo upload from iPhone Expo Go (`POST /upload-raw`)
  if (req.method === 'POST' && req.url && req.url.startsWith('/upload-raw')) {
    const urlObj = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const ext = urlObj.searchParams.get('ext') || 'mov';
    const isVideo = urlObj.searchParams.get('video') === '1';
    const id = `media-${Date.now()}`;
    const rawFilePath = path.join(MEDIA_DIR, `${id}.${ext}`);
    const writeStream = fs.createWriteStream(rawFilePath);

    req.pipe(writeStream);

    writeStream.on('finish', () => {
      const baseUrl = getPublicBaseUrl(req);
      if (isVideo) {
        console.log(`[iPhone Video Upload] Transcoding ${rawFilePath} to H.264 MP4...`);
        transcodeToBrowserMp4IfNeeded(rawFilePath, (finalPath, finalMime) => {
          uploadedMedia.set(id, { filePath: finalPath, mimeType: finalMime });
          const publicUrl = `${baseUrl}/media/${id}`;
          console.log(`[iPhone Video Ready] Streaming at ${publicUrl}`);
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true, url: publicUrl }));
        });
      } else {
        uploadedMedia.set(id, { filePath: rawFilePath, mimeType: 'image/jpeg' });
        const publicUrl = `${baseUrl}/media/${id}`;
        console.log(`[iPhone Photo Ready] Displaying at ${publicUrl}`);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, url: publicUrl }));
      }
    });
    return;
  }

  // Receive JSON base64 photo/video upload from iPhone Expo Go (`POST /upload`)
  if (req.method === 'POST' && req.url === '/upload') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 80 * 1024 * 1024) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const mimeType = data.mimeType || 'image/jpeg';
        const isVideo = mimeType.startsWith('video/');
        const base64Clean = String(data.base64 || '').replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Clean, 'base64');
        const id = `media-${Date.now()}`;
        const rawPath = path.join(MEDIA_DIR, `${id}.${isVideo ? 'mov' : 'jpg'}`);
        fs.writeFileSync(rawPath, buffer);
        const baseUrl = getPublicBaseUrl(req);

        if (isVideo) {
          transcodeToBrowserMp4IfNeeded(rawPath, (finalPath, finalMime) => {
            uploadedMedia.set(id, { filePath: finalPath, mimeType: finalMime });
            const publicUrl = `${baseUrl}/media/${id}`;
            console.log(`[iPhone Video Upload] Saved & transcoded -> ${publicUrl}`);
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true, url: publicUrl }));
          });
        } else {
          uploadedMedia.set(id, { filePath: rawPath, mimeType });
          const publicUrl = `${baseUrl}/media/${id}`;
          console.log(`[iPhone Photo Upload] Saved -> ${publicUrl}`);
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true, url: publicUrl }));
        }
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: String(err) }));
      }
    });
    return;
  }

  if (req.url && (req.url === '/car' || req.url.startsWith('/car?'))) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.writeHead(200);
    res.end(CAR_RECEIVER_HTML);
    return;
  }

  if (req.url === '/privacy') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.writeHead(200);
    res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ParkCast Privacy Policy</title></head><body style="font-family:sans-serif;max-width:680px;margin:40px auto;padding:0 20px;color:#0F172A;line-height:1.6"><h1>ParkCast Privacy Policy</h1><p>Effective Date: November 10, 2026</p><p>ParkCast ("we", "our", or "the App") respects your privacy. Photos and videos selected from your device are transmitted solely to your paired car screen receiver and are never sold or shared with third parties.</p><h3>Data We Collect</h3><ul><li><strong>Purchase &amp; Subscription Status:</strong> Processed securely by Apple In-App Purchases (StoreKit) and RevenueCat to unlock ParkCast Pro features.</li><li><strong>Temporary Media Relay:</strong> Photos or videos you choose to cast are temporarily buffered only for your active 4-digit Car Code session.</li></ul><h3>Contact</h3><p>For questions or support, contact support@parkcast.app.</p></body></html>`);
    return;
  }

  if (req.url === '/terms') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.writeHead(200);
    res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ParkCast Terms of Use (EULA)</title></head><body style="font-family:sans-serif;max-width:680px;margin:40px auto;padding:0 20px;color:#0F172A;line-height:1.6"><h1>ParkCast Terms of Use (EULA)</h1><p>Effective Date: November 10, 2026</p><h3>1. Safety Notice (Parked Use Only)</h3><p>ParkCast is intended strictly for use while your vehicle is safely parked. Never watch video or interact with the app while driving.</p><h3>2. Subscriptions &amp; Billing</h3><p>ParkCast Pro is offered as a Monthly ($4.99/month), Yearly ($24.99/year with a 3-day free trial), or Lifetime ($49.99 one-time) purchase. Payment is charged to your Apple Account at confirmation of purchase. Subscriptions automatically renew unless auto-renew is turned off at least 24 hours before the end of the current period in your iPhone Account Settings.</p></body></html>`);
    return;
  }

  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/health') {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        service: 'ParkCast Realtime Relay',
        status: 'ok',
        activeRooms: rooms.size,
        port: PORT,
        lanIp: getLocalLanIp(),
      })
    );
    return;
  }

  res.writeHead(200);
  res.end(
    JSON.stringify({
      app: 'ParkCast Car Screen Relay',
      carReceiverUrl: `http://${getLocalLanIp()}:${PORT}/car`,
      message: 'Open /car in your car browser or laptop to view the live Car Screen Receiver.',
    })
  );
});

const wss = new WebSocketServer({ server, maxPayload: 80 * 1024 * 1024 });

wss.on('connection', (ws) => {
  let currentRoom = '4829';

  const joinRoom = (code) => {
    const clean = String(code || '4829').trim();
    if (rooms.has(currentRoom)) {
      rooms.get(currentRoom).clients.delete(ws);
    }
    const { room } = getOrCreateRoom(clean);
    currentRoom = clean;
    room.clients.add(ws);

    if (room.lastState) {
      ws.send(
        JSON.stringify({
          type: 'state_update',
          roomCode: clean,
          payload: room.lastState,
        })
      );
    }
  };

  joinRoom(currentRoom);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(String(raw));
      if (msg.type === 'join' && msg.roomCode) {
        joinRoom(msg.roomCode);
        return;
      }

      if (msg.type === 'state_update' && msg.payload) {
        const targetRoom = String(msg.roomCode || currentRoom).trim();
        if (targetRoom !== currentRoom) {
          joinRoom(targetRoom);
        }
        console.log(
          `[WS iPhone -> Car PIN ${currentRoom}] ${msg.payload.lastRemoteAction || 'State updated'}`
        );
        broadcastRoomState(currentRoom, msg.payload, ws);
      }
    } catch {
      // Ignore malformed JSON frames
    }
  });

  ws.on('close', () => {
    if (rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      room.clients.delete(ws);
      if (room.clients.size === 0 && !room.lastState) {
        rooms.delete(currentRoom);
      }
    }
  });
});

if (require.main === module) {
  const lanIp = getLocalLanIp();
  startWholePhoneAirPlayReceiver();
  server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('==============================================================');
    console.log('  🚗 ParkCast Realtime Relay & Car Screen Receiver Ready!');
    console.log(`  • Relay Host IP (for iPhone):  ${lanIp}:${PORT}`);
    console.log(`  • Car Screen Receiver URL:     http://${lanIp}:${PORT}/car`);
    console.log(
      `  • Whole-Phone AirPlay Mirror:  ${
        uxplayActive
          ? 'ACTIVE ("ParkCast Car Display" in iPhone Control Center)'
          : 'Install uxplay (`sudo apt install -y uxplay`) for full iOS Control Center mirror'
      }`
    );
    console.log('==============================================================');
    console.log('');
  });
}

module.exports = { server, wss, rooms };
