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
const { execFile } = require('child_process');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PARKCAST_RELAY_PORT || 4848);
const rooms = new Map();
const MEDIA_DIR = path.join(os.tmpdir(), 'parkcast-media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });

// Map of mediaId -> { filePath, mimeType }
const uploadedMedia = new Map();

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
  </style>
</head>
<body>
  <div class="top-bar">
    <div class="status-group">
      <div class="dot" id="connDot"></div>
      <strong id="carTitle" style="font-size:16px">ParkCast Car Display</strong>
      <span class="pin-box" id="pinDisplay">Car Code: 4829</span>
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
        <div style="font-size:10px;color:#2563EB;font-weight:700">CarPlay</div>
      </div>
      <div>
        <div class="dock-icon" style="background:#2563EB">P</div>
        <div class="dock-icon" style="background:#10B981">NAV</div>
        <div class="dock-icon" style="background:#EF4444">YT</div>
      </div>
      <div style="width:28px;height:28px;border-radius:14px;border:2px solid #94A3B8"></div>
    </div>

    <div class="stage">
      <div class="hud-top">
        <div>
          <div class="hud-sub" id="hudCategory">NOW SHOWING</div>
          <div class="hud-title" id="hudTitle">Swiss Alps Scenic Drive</div>
        </div>
        <div class="badge" id="lastActionBadge">Connected to iPhone</div>
      </div>

      <div class="visualizer-fallback" id="visualizerFallback">
        <div style="background:#FFFFFF;border:1px solid #DBEAFE;border-radius:22px;padding:28px 36px;max-width:480px;box-shadow:0 12px 30px rgba(37,99,235,0.08)">
          <div style="color:#16A34A;font-size:12px;font-weight:800;letter-spacing:0.6px;margin-bottom:8px">● CONNECTED TO YOUR IPHONE</div>
          <h2 style="font-size:22px;margin-bottom:8px;color:#0F172A" id="stageCenterTitle">Ready to Play</h2>
          <p style="color:#475569;font-size:14px;line-height:1.5" id="stageCenterSub">Pick Watch YouTube, Phone Photos, Phone Videos, or Mirror Screen on your iPhone.</p>
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
          <div class="phone-frame" id="mirrorPhoneMock">
            <div style="display:flex;justify-content:space-between;font-size:12px;color:#475569;font-weight:700">
              <span>iPhone Live Mirror</span>
              <span style="color:#EF4444">● LIVE</span>
            </div>
            <div>
              <div style="font-size:17px;font-weight:800;margin-bottom:4px;text-align:center;color:#0F172A">Your iPhone Is Mirroring</div>
              <div style="font-size:12px;color:#64748B;text-align:center;margin-bottom:10px">Tap any shortcut in the Car Remote tab on your iPhone</div>
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
              Connected to iPhone
            </div>
          </div>
        </div>
      </div>

      <div class="cursor" id="remoteCursor" style="left:68%;top:36%">● Pointer</div>
    </div>
  </div>

  <div class="bottom-bar">
    <div id="playStatusText">Connected · Choose any video or photo on your iPhone</div>
    <button onclick="const v=document.getElementById('videoPlayer'); v.muted=false; v.play().catch(()=>{}); this.textContent='🔊 Sound On';"
      style="background:#2563EB;color:#fff;border:none;padding:8px 16px;border-radius:10px;font-weight:700;cursor:pointer">
      🔊 Turn Sound On
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-File-Name, X-Mime-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
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
      const lanIp = getLocalLanIp();
      if (isVideo) {
        console.log(`[iPhone Video Upload] Transcoding ${rawFilePath} to H.264 MP4...`);
        transcodeToBrowserMp4IfNeeded(rawFilePath, (finalPath, finalMime) => {
          uploadedMedia.set(id, { filePath: finalPath, mimeType: finalMime });
          const publicUrl = `http://${lanIp}:${PORT}/media/${id}`;
          console.log(`[iPhone Video Ready] Streaming at ${publicUrl}`);
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true, url: publicUrl }));
        });
      } else {
        uploadedMedia.set(id, { filePath: rawFilePath, mimeType: 'image/jpeg' });
        const publicUrl = `http://${lanIp}:${PORT}/media/${id}`;
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
        const lanIp = getLocalLanIp();

        if (isVideo) {
          transcodeToBrowserMp4IfNeeded(rawPath, (finalPath, finalMime) => {
            uploadedMedia.set(id, { filePath: finalPath, mimeType: finalMime });
            const publicUrl = `http://${lanIp}:${PORT}/media/${id}`;
            console.log(`[iPhone Video Upload] Saved & transcoded -> ${publicUrl}`);
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true, url: publicUrl }));
          });
        } else {
          uploadedMedia.set(id, { filePath: rawPath, mimeType });
          const publicUrl = `http://${lanIp}:${PORT}/media/${id}`;
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
