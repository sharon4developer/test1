#!/usr/bin/env node
/**
 * ParkCast Lightweight Realtime Pairing Relay Server
 *
 * Zero-database WebSocket relay that pairs the ParkCast iPhone app (running in Expo Go)
 * with any Car Browser / Head-Unit display on the local network using a 4-digit PIN code.
 */

const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PARKCAST_RELAY_PORT || 4848);

// Map of roomCode -> { clients: Set<WebSocket>, lastState: object | null }
const rooms = new Map();

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/health') {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        service: 'ParkCast Realtime Relay',
        status: 'ok',
        activeRooms: rooms.size,
        port: PORT,
      })
    );
    return;
  }

  res.writeHead(200);
  res.end(
    JSON.stringify({
      app: 'ParkCast Car Screen Relay',
      message: 'Connect via WebSocket to pair iPhone Expo Go controller with Car Screen Receiver.',
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
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[ParkCast Relay] Listening on ws://0.0.0.0:${PORT} (Health: http://127.0.0.1:${PORT}/health)`);
  });
}

module.exports = { server, wss, rooms };
