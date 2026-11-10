#!/usr/bin/env node
/**
 * ParkCast Realtime Pairing Relay & Standalone Car Screen Receiver Server
 *
 * Supports BOTH:
 * 1. WebSocket (`ws://<HOST>:4848`)
 * 2. Instant HTTP Poll/Push (`POST /sync` & `GET /sync?pin=4829`) so iPhones in Expo Go
 *    never fail if iOS blocks raw WebSockets.
 * 3. Camera Roll Photo/Video upload (`POST /upload`)
 * 4. Standalone Car Cinema Receiver Web Player (`http://<HOST>:4848/car`)
 */

const http = require('http');
const os = require('os');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PARKCAST_RELAY_PORT || 4848);
const rooms = new Map(); // roomCode -> { clients: Set<WebSocket>, lastState: object | null }
const uploadedMedia = new Map(); // id -> { mimeType, buffer }

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

const CAR_RECEIVER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ParkCast Car Screen Receiver</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #05080F; color: #F8FAFC; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
    .top-bar { display: flex; justify-content: space-between; align-items: center; padding: 10px 18px; background: #0B1120; border-bottom: 1px solid #1E293B; }
    .status-group { display: flex; align-items: center; gap: 10px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: #10B981; box-shadow: 0 0 8px #10B981; }
    .pin-box { background: #1E3A8A; color: #fff; font-weight: 800; padding: 4px 12px; border-radius: 8px; font-size: 14px; letter-spacing: 1px; }
    .badges { display: flex; gap: 8px; align-items: center; }
    .badge { background: #1E293B; color: #38BDF8; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 800; }
    .main { flex: 1; display: flex; position: relative; overflow: hidden; background: #030712; }
    .dock { width: 72px; background: #0F172A; border-right: 1px solid #1E293B; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 14px 0; z-index: 5; }
    .dock-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; color: #fff; margin-bottom: 10px; cursor: pointer; }
    .stage { flex: 1; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #030712; }
    video, iframe, #photoViewer { width: 100%; height: 100%; border: none; background: #000; position: relative; z-index: 4; }
    #photoViewer { object-fit: contain; display: none; }
    .fit-contain { object-fit: contain; }
    .fit-cover { object-fit: cover; }
    .fit-cinema { object-fit: cover; transform: scale(1.12); }
    .visualizer-fallback { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: radial-gradient(circle at 75% 20%, rgba(56,189,248,0.18), #050814 70%); z-index: 1; padding: 24px; text-align: center; }
    .hud-top { position: absolute; top: 14px; left: 16px; right: 16px; display: flex; justify-content: space-between; align-items: center; background: rgba(11, 17, 32, 0.86); padding: 10px 16px; border-radius: 12px; border-left: 4px solid #38BDF8; pointer-events: none; z-index: 10; }
    .hud-title { font-size: 16px; font-weight: 800; color: #fff; }
    .hud-sub { font-size: 11px; color: #38BDF8; font-weight: 700; text-transform: uppercase; }
    .cursor { position: absolute; padding: 5px 9px; background: rgba(15, 23, 42, 0.92); border: 2px solid #38BDF8; border-radius: 14px; color: #E0F2FE; font-size: 10px; font-weight: 800; pointer-events: none; z-index: 30; transition: left 0.12s ease, top 0.12s ease; }
    .mirror-overlay { position: absolute; inset: 0; background: #090D16; display: none; flex-direction: column; z-index: 20; }
    .mirror-header { background: #111827; padding: 8px 16px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
    .mirror-body { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
    .phone-frame { width: 360px; height: 92%; background: #0F172A; border: 3px solid #6366F1; border-radius: 32px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 20px 50px rgba(0,0,0,0.7); }
    .app-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px; }
    .app-tile { padding: 16px 8px; border-radius: 14px; text-align: center; font-weight: 800; font-size: 11px; color: #fff; }
    .bottom-bar { background: #0B1120; border-top: 1px solid #1E293B; padding: 10px 18px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #94A3B8; z-index: 25; }
  </style>
</head>
<body>
  <div class="top-bar">
    <div class="status-group">
      <div class="dot" id="connDot"></div>
      <strong id="carTitle">PARKCAST CAR DISPLAY RECEIVER</strong>
      <span class="pin-box" id="pinDisplay">PIN: 4829</span>
    </div>
    <div class="badges">
      <span class="badge" id="qualityBadge">480p</span>
      <span class="badge" id="aspectBadge">FIT</span>
      <span class="badge" id="volBadge">VOL 85%</span>
    </div>
  </div>

  <div class="main" id="mainRow">
    <div class="dock">
      <div style="text-align:center">
        <div style="font-weight:800;font-size:14px" id="clockText">12:45</div>
        <div style="font-size:10px;color:#38BDF8;font-weight:700">5G · Wi-Fi</div>
      </div>
      <div>
        <div class="dock-icon" style="background:#3B82F6">P</div>
        <div class="dock-icon" style="background:#10B981">NAV</div>
        <div class="dock-icon" style="background:#F43F5E">YT</div>
      </div>
      <div style="width:28px;height:28px;border-radius:14px;border:2px solid #94A3B8"></div>
    </div>

    <div class="stage">
      <div class="hud-top">
        <div>
          <div class="hud-sub" id="hudCategory">READY FOR IPHONE CAST</div>
          <div class="hud-title" id="hudTitle">Swiss Alps 4K Scenic Drive & Lounge</div>
        </div>
        <div class="badge" id="lastActionBadge">Connected · Ready</div>
      </div>

      <div class="visualizer-fallback" id="visualizerFallback">
        <div style="background:rgba(15,23,42,0.9);border:1px solid #334155;border-radius:18px;padding:24px 32px;max-width:480px">
          <div style="color:#34D399;font-size:11px;font-weight:800;letter-spacing:1px;margin-bottom:8px">● PARKCAST CAR CINEMA STAGE</div>
          <h2 style="font-size:20px;margin-bottom:6px" id="stageCenterTitle">Swiss Alps 4K Scenic Drive & Lounge</h2>
          <p style="color:#94A3B8;font-size:13px" id="stageCenterSub">Select any channel, YouTube link, Camera Roll photo, or Screen Mirror on your iPhone.</p>
        </div>
      </div>

      <video id="videoPlayer" playsinline autoplay muted loop class="fit-contain" style="display:none"></video>
      <iframe id="ytFrame" style="display:none" allow="autoplay; encrypted-media; fullscreen"></iframe>
      <img id="photoViewer" alt="Casted iPhone Photo" />

      <div class="mirror-overlay" id="mirrorOverlay">
        <div class="mirror-header">
          <span style="color:#F43F5E;font-weight:800">● LIVE IPHONE SCREEN MIRRORING (60FPS)</span>
          <span id="mirrorUrlLabel" style="color:#38BDF8;font-weight:700">iPhone Home & Web Mirror</span>
        </div>
        <div class="mirror-body">
          <iframe id="mirrorWebFrame" style="display:none;width:100%;height:100%;border:none;background:#fff"></iframe>
          <div class="phone-frame" id="mirrorPhoneMock">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#94A3B8;font-weight:700">
              <span>iPhone · ParkCast Live</span>
              <span style="color:#F43F5E">● REC</span>
            </div>
            <div>
              <div style="font-size:16px;font-weight:800;margin-bottom:4px;text-align:center">Live iPhone Mirror Active</div>
              <div style="font-size:11px;color:#94A3B8;text-align:center;margin-bottom:8px">Tap any app shortcut on your iPhone Remote screen</div>
              <div class="app-grid">
                <div class="app-tile" style="background:#DC2626">YouTube</div>
                <div class="app-tile" style="background:#2563EB">Safari Web</div>
                <div class="app-tile" style="background:#059669">Photos HD</div>
                <div class="app-tile" style="background:#EA580C">VLC / Files</div>
                <div class="app-tile" style="background:#16A34A">Spotify</div>
                <div class="app-tile" style="background:#4F46E5">Maps Live</div>
              </div>
            </div>
            <div style="font-size:11px;color:#38BDF8;text-align:center;font-weight:700" id="mirrorLiveStatus">
              Synced with iPhone Controller
            </div>
          </div>
        </div>
      </div>

      <div class="cursor" id="remoteCursor" style="left:68%;top:36%">● REMOTE</div>
    </div>
  </div>

  <div class="bottom-bar">
    <div id="playStatusText">▶ Connected · Control playback, YouTube, Photos & Screen Mirror from your iPhone</div>
    <button onclick="const v=document.getElementById('videoPlayer'); v.muted=false; v.play().catch(()=>{}); this.textContent='🔊 Car Audio Enabled';"
      style="background:#3B82F6;color:#fff;border:none;padding:6px 14px;border-radius:8px;font-weight:700;cursor:pointer">
      🔊 Enable Car Audio
    </button>
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
    let currentMediaUrl = '';
    let currentYtId = '';
    let currentMirrorUrl = '';
    let lastUpdatedAt = 0;

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

      document.getElementById('qualityBadge').textContent = s.quality || '480p';
      document.getElementById('aspectBadge').textContent = (s.aspectMode || 'fit').toUpperCase();
      document.getElementById('volBadge').textContent = s.isMuted ? 'MUTED' : ('VOL ' + (s.volume ?? 85) + '%');
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

        const ytId = extractYouTubeId(s.activeMedia.youtubeId || s.activeMedia.streamUrl);
        const isDirectVideo = /\\.(mp4|m3u8|mov|webm)(\\?|$)/i.test(String(s.activeMedia.streamUrl || '')) ||
          String(s.activeMedia.streamUrl || '').startsWith('http://') ||
          String(s.activeMedia.streamUrl || '').startsWith('data:');

        if (ytId) {
          videoEl.pause();
          videoEl.style.display = 'none';
          ytFrame.style.display = 'block';
          if (currentYtId !== ytId) {
            currentYtId = ytId;
            ytFrame.src = 'https://www.youtube.com/embed/' + ytId + '?autoplay=1&mute=1&rel=0&playsinline=1';
          }
          document.getElementById('playStatusText').textContent = '▶ Playing YouTube on Car Screen: ' + s.activeMedia.title;
        } else if (isDirectVideo && s.activeMedia.streamUrl) {
          ytFrame.style.display = 'none';
          ytFrame.src = '';
          currentYtId = '';
          videoEl.style.display = 'block';
          if (currentMediaUrl !== s.activeMedia.streamUrl) {
            currentMediaUrl = s.activeMedia.streamUrl;
            videoEl.src = currentMediaUrl;
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

    connectRelay();
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // HTTP State Sync endpoint (works even if iOS blocks WebSockets)
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
              `[iPhone -> Car PIN ${pin}] ${msg.payload.lastRemoteAction || 'State updated'} (mirror=${msg.payload.mirrorMode})`
            );
            broadcastRoomState(pin, msg.payload);
          }
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true, roomCode: pin }));
        } catch (err) {
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false }));
        }
      });
      return;
    }

    // GET /sync?pin=4829
    const urlObj = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const pin = urlObj.searchParams.get('pin') || '4829';
    const { room } = getOrCreateRoom(pin);
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, roomCode: pin, payload: room.lastState }));
    return;
  }

  // Serve uploaded photos/videos from iPhone Camera Roll
  if (req.url && req.url.startsWith('/media/')) {
    const id = req.url.replace('/media/', '').split('?')[0];
    const item = uploadedMedia.get(id);
    if (!item) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.setHeader('Content-Type', item.mimeType);
    res.writeHead(200);
    res.end(item.buffer);
    return;
  }

  // Receive base64 photo/video upload from iPhone Expo Go
  if (req.method === 'POST' && req.url === '/upload') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 35 * 1024 * 1024) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const mimeType = data.mimeType || 'image/jpeg';
        const base64Clean = String(data.base64 || '').replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Clean, 'base64');
        const id = `media-${Date.now()}`;
        uploadedMedia.set(id, { mimeType, buffer });
        const lanIp = getLocalLanIp();
        const publicUrl = `http://${lanIp}:${PORT}/media/${id}`;
        console.log(`[iPhone Upload] Saved Camera Roll media -> ${publicUrl}`);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, url: publicUrl }));
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

const wss = new WebSocketServer({ server, maxPayload: 35 * 1024 * 1024 });

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
  server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('==============================================================');
    console.log('  🚗 ParkCast Realtime Relay & Car Screen Receiver Ready!');
    console.log(`  • Relay Host IP (for iPhone):  ${lanIp}:${PORT}`);
    console.log(`  • Car Screen Receiver URL:     http://${lanIp}:${PORT}/car`);
    console.log('==============================================================');
    console.log('');
  });
}

module.exports = { server, wss, rooms };
