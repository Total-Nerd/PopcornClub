const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
const path = require('path');
const fs = require('fs');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const mediaRoutes = require('./routes/media');
const listsRoutes = require('./routes/lists');
const calendarRoutes = require('./routes/calendar');
const foldersRoutes = require('./routes/folders');
const statsRoutes = require('./routes/stats');
const requestsRoutes = require('./routes/requests');
const commentsRoutes = require('./routes/comments');
const reactionsRoutes = require('./routes/reactions');
const socialRoutes = require('./routes/social');
const { initFolderScanner } = require('./utils/folderScanner');
const { seedWatchHistoryLogs, backfillMediaGenres, cleanupDuplicateWatchLogs } = require('./utils/historyMigration');

// Basic route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

const watchTogetherRoutes = require('./routes/watchTogether');
const { authenticateToken } = require('./middleware/auth');

app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/lists', listsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/folders', foldersRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/requests', authenticateToken, requestsRoutes);
app.use('/api/watch-together', authenticateToken, watchTogetherRoutes);
app.use('/api/comments', authenticateToken, commentsRoutes);
app.use('/api/reactions', authenticateToken, reactionsRoutes);
app.use('/api/social', authenticateToken, socialRoutes);

const plexRoutes = require('./routes/plex');
const http = require('http');
const { initWebSocket } = require('./utils/wsManager');

app.use('/api/webhook/plex', plexRoutes);

// Create HTTP server
const server = http.createServer(app);

// Attach WebSocket server
initWebSocket(server);

// Start Server
server.listen(PORT, async () => {
  console.log(`TVTracker backend running on port ${PORT}`);
  try {
    await seedWatchHistoryLogs();
    await cleanupDuplicateWatchLogs();
    backfillMediaGenres().catch(err => console.error('Failed to backfill media genres:', err));
    
    const prisma = require('./prismaClient');
    
    // Ensure uploads folders exist
    const uploadsDir = path.join(__dirname, '../uploads');
    const avatarsDir = path.join(__dirname, '../uploads/avatars');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
    if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir);

    const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } });
    if (adminUser) {
      await prisma.customList.upsert({
        where: { userId_name: { userId: adminUser.id, name: 'Watchlist' } },
        update: {},
        create: { name: 'Watchlist', userId: adminUser.id }
      });
      console.log('Ensured default Watchlist exists for admin.');
    }
  } catch (err) {
    console.error('Failed to run watch history migration:', err);
  }
  initFolderScanner().catch(err => console.error('Failed to initialize folder scanner:', err));
});
