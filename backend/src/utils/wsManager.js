const WebSocket = require('ws');
const url = require('url');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');

let wss = null;
const activeConnections = new Map(); // userId -> Set of WebSocket clients

function initWebSocket(server) {
  wss = new WebSocket.Server({ noServer: true });

  server.on('upgrade', async (request, socket, head) => {
    const parsedUrl = url.parse(request.url, true);

    if (parsedUrl.pathname === '/api/ws') {
      const token = parsedUrl.query.token;
      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey_change_in_production');
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user) {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }

        request.user = user;
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } catch (err) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
      }
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, request) => {
    const userId = request.user.id;
    if (!activeConnections.has(userId)) {
      activeConnections.set(userId, new Set());
    }
    activeConnections.get(userId).add(ws);

    console.log(`[WebSocket] User ${userId} connected. Active user socket sets: ${activeConnections.size}`);

    // Send the current active session state immediately
    const plexStore = require('./plexStore');
    const currentSession = plexStore.getActiveSession(userId);
    ws.send(JSON.stringify({ type: 'plex-session', session: currentSession }));

    ws.on('close', () => {
      const userSockets = activeConnections.get(userId);
      if (userSockets) {
        userSockets.delete(ws);
        if (userSockets.size === 0) {
          activeConnections.delete(userId);
        }
      }
      console.log(`[WebSocket] User ${userId} disconnected.`);
    });
  });
}

function broadcastToUser(userId, data) {
  const userSockets = activeConnections.get(userId);
  if (userSockets && userSockets.size > 0) {
    const message = JSON.stringify(data);
    for (const ws of userSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }
}

module.exports = {
  initWebSocket,
  broadcastToUser
};
