#!/usr/bin/env node
/**
 * ParkCast Realtime Pairing Relay & Standalone Car Screen Receiver Server
 *
 * - WebSocket Relay on ws://<LAN_IP>:4848
 * - Standalone Car Cinema Receiver Web Player on http://<LAN_IP>:4848/car
 *   (Open this URL in any car browser, tablet, or laptop to receive live YouTube,
 *    MP4/M3U8 video, and touchpad remote commands from your iPhone running Expo Go!)
 */

const http = require('http');
const os = require('os');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PARKCAST_RELAY_PORT || 4848);
const rooms = new Map();

function getLocalLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
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
    .main { flex: 1; display: flex; position: relative; overflow: hidden; background: #000; }
    .dock { width: 72px; background: #0F172A; border-right: 1px solid #1E293B; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 14px 0; z-index: 5; }
    .dock-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; color: #fff; margin-bottom: 10px; }
    .stage { flex: 1; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #000; }
    video, iframe { width: 100%; height: 100%; border: none; background: #000; }
    .fit-contain { object-fit: contain; }
    .fit-cover { object-fit: cover; }
    .fit-cinema { object-fit: cover; transform: scale(1.12); }
    .hud-top { position: absolute; top: 14px; left: 16px; right: 16px; display: flex; justify-content: space-between; align-items: center; background: rgba(11, 17, 32, 0.82); padding: 10px 16px; border-radius: 12px; border-left: 4px solid #38BDF8; pointer-events: none; z-index: 10; }
    .hud-title { font-size: 16px; font-weight: 800; color: #fff; }
    .hud-sub { font-size: 11px; color: #38BDF8; font-weight: 700; text-transform: uppercase; }
    .cursor { position: absolute; padding: 5px 9px; background: rgba(15, 23, 42, 0.9); border: 2px solid #38BDF8; border-radius: 14px; color: #E0F2FE; font-size: 10px; font-weight: 800; pointer-events: none; z-index: 20; transition: left 0.12s ease, top 0.12s ease; }
    .mirror-overlay { position: absolute; inset: 0; background: #090D16; display: none; flex-direction: column; align-items: center; justify-content: center; z-index: 15; padding: 24px; text-align: center; }
    .bottom-bar { background: #0B1120; border-top: 1px solid #1E293B; padding: 10px 18px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #94A3B8; }
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
        <div class="badge" id="lastActionBadge">Waiting for iPhone controller...</div>
      </div>

      <video id="videoPlayer" playsinline autoplay muted loop class="fit-contain"
        src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"></video>

      <iframe id="ytFrame" style="display:none" allow="autoplay; encrypted-media; fullscreen"></iframe>

      <div class="mirror-overlay" id="mirrorOverlay">
        <div style="background:#111827;border:2px solid #6366F1;border-radius:20px;padding:24px;max-width:480px;width:100%">
          <div style="color:#F43F5E;font-weight:800;font-size:12px;margin-bottom:6px">● LIVE IPHONE SCREEN BROADCAST (60FPS)</div>
          <h2 style="font-size:20px;margin-bottom:14px" id="mirrorTitle">iPhone Screen Mirror Active</h2>
          <p style="color:#94A3B8;font-size:13px;line-height:1.5">Controlled live from your iPhone ParkCast app.</p>
        </div>
      </div>

      <div class="cursor" id="remoteCursor" style="left:68%;top:36%">● REMOTE</div>
    </div>
  </div>

  <div class="bottom-bar">
    <div id="playStatusText">▶ Playing · Tap Unmute if your browser blocks autoplay sound</div>
    <button onclick="const v=document.getElementById('videoPlayer'); v.muted=false; v.play(); this.textContent='🔊 Car Audio Enabled';"
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
    const mirrorOverlay = document.getElementById('mirrorOverlay');
    let currentMediaUrl = '';
    let currentYtId = '';

    function extractYouTubeId(urlOrId) {
      if (!urlOrId) return null;
      const m = String(urlOrId).match(/(?:youtu\\.be\\/|youtube\\.com\\/(?:watch\\?v=|embed\\/|shorts\\/))([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
      if (/^[A-Za-z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
      return null;
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
            const s = msg.payload;
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

            if (s.mirrorMode === 'screen_broadcast') {
              mirrorOverlay.style.display = 'flex';
            } else {
              mirrorOverlay.style.display = 'none';
            }

            if (s.activeMedia) {
              document.getElementById('hudTitle').textContent = s.activeMedia.title;
              document.getElementById('hudCategory').textContent =
                (s.activeMedia.category || 'stream').toUpperCase() + ' · ' + (s.quality || '480p');

              const ytId = extractYouTubeId(s.activeMedia.youtubeId || s.activeMedia.streamUrl);
              const isDirectMp4 = String(s.activeMedia.streamUrl || '').endsWith('.mp4');

              if (ytId && !isDirectMp4) {
                videoEl.pause();
                videoEl.style.display = 'none';
                ytFrame.style.display = 'block';
                if (currentYtId !== ytId) {
                  currentYtId = ytId;
                  ytFrame.src = 'https://www.youtube.com/embed/' + ytId + '?autoplay=1&rel=0&playsinline=1';
                }
              } else if (s.activeMedia.streamUrl) {
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
        } catch (e) {}
      };

      ws.onclose = () => {
        document.getElementById('connDot').style.background = '#F59E0B';
        setTimeout(connectRelay, 2000);
      };
    }

    connectRelay();
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

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

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let currentRoom = '4829';

  const joinRoom = (code) => {
    const clean = String(code || '4829').trim();
    if (rooms.has(currentRoom)) {
      rooms.get(currentRoom).clients.delete(ws);
    }
    currentRoom = clean;
    if (!rooms.has(clean)) {
      rooms.set(clean, { clients: new Set(), lastState: null });
    }
    const room = rooms.get(clean);
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
        const room = rooms.get(currentRoom);
        if (!room) return;
        room.lastState = msg.payload;

        for (const client of room.clients) {
          if (client !== ws && client.readyState === 1) {
            client.send(
              JSON.stringify({
                type: 'state_update',
                roomCode: currentRoom,
                payload: msg.payload,
              })
            );
          }
        }
      }
    } catch {
      // Ignore malformed JSON frames
    }
  });

  ws.on('close', () => {
    if (rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      room.clients.delete(ws);
      if (room.clients.size === 0) {
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
