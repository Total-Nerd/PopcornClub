const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../prismaClient');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/status', async (req, res) => {
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    return res.json({ setupRequired: true });
  }
  return res.json({ setupRequired: false });
});

router.post('/setup', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return res.status(400).json({ error: 'Setup already completed' });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const plexWebhookToken = crypto.randomBytes(16).toString('hex');

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: 'admin', // First user is automatically admin
      plexWebhookToken
    }
  });

  // Ensure default Watchlist exists for the admin user
  await prisma.customList.create({
    data: {
      name: 'Watchlist',
      userId: user.id
    }
  });

  // Initialize SystemSettings with TMDB API Key from environment if available
  try {
    const envApiKey = process.env.TMDB_API_KEY || null;
    let systemSettings = await prisma.systemSettings.findFirst();
    if (!systemSettings) {
      await prisma.systemSettings.create({
        data: { id: 1, tmdbApiKey: envApiKey }
      });
    } else if (!systemSettings.tmdbApiKey && envApiKey) {
      await prisma.systemSettings.update({
        where: { id: systemSettings.id },
        data: { tmdbApiKey: envApiKey }
      });
    }
  } catch (err) {
    console.error('[Auth /setup] Failed to init system settings:', err.message);
  }

  // Backfill any pre-existing scanned media items to admin's collection
  try {
    const allMedia = await prisma.media.findMany({ select: { id: true } });
    for (const m of allMedia) {
      await prisma.collection.upsert({
        where: { userId_mediaId: { userId: user.id, mediaId: m.id } },
        update: {},
        create: { userId: user.id, mediaId: m.id }
      });
    }
    const allTvFiles = await prisma.localFile.findMany({
      where: { type: 'tv', season: { not: null }, episode: { not: null } },
      select: { mediaId: true, season: true, episode: true, endEpisode: true }
    });
    for (const f of allTvFiles) {
      const endEp = f.endEpisode || f.episode;
      for (let ep = f.episode; ep <= endEp; ep++) {
        await prisma.episodeCollection.upsert({
          where: {
            userId_mediaId_season_episode: {
              userId: user.id,
              mediaId: f.mediaId,
              season: f.season,
              episode: ep
            }
          },
          update: {},
          create: {
            userId: user.id,
            mediaId: f.mediaId,
            season: f.season,
            episode: ep
          }
        });
      }
    }
  } catch (err) {
    console.error('[Auth /setup] Failed to backfill media collection for admin:', err.message);
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET || 'supersecretkey_change_in_production',
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      username: user.username,
      role: user.role,
      avatarPath: user.avatarPath,
      name: user.name
    }
  });
});

router.post('/pre-login', async (req, res) => {
  const { usernameOrEmail } = req.body;
  if (!usernameOrEmail) {
    return res.status(400).json({ error: 'Username or email is required' });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: usernameOrEmail, mode: 'insensitive' } },
        { email: { equals: usernameOrEmail, mode: 'insensitive' } }
      ]
    }
  });

  if (!user) {
    return res.status(400).json({ error: 'Account not found. Please check your credentials.' });
  }

  const hasPassword = !!user.passwordHash;
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    hasPassword
  });
});

router.post('/complete-setup', async (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) {
    return res.status(400).json({ error: 'User ID and password are required' });
  }

  const user = await prisma.user.findUnique({ where: { id: parseInt(userId, 10) } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user.passwordHash) {
    return res.status(400).json({ error: 'Password already configured. Please log in normally.' });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash }
  });

  const token = jwt.sign(
    { id: updatedUser.id, username: updatedUser.username, role: updatedUser.role },
    process.env.JWT_SECRET || 'supersecretkey_change_in_production',
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      username: updatedUser.username,
      role: updatedUser.role,
      avatarPath: updatedUser.avatarPath,
      name: updatedUser.name,
      email: updatedUser.email
    }
  });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username/email and password are required' });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: username, mode: 'insensitive' } },
        { email: { equals: username, mode: 'insensitive' } }
      ]
    }
  });
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });

  if (!user.passwordHash) {
    return res.status(400).json({ error: 'Password has not been set yet. Please enter your email to set one.' });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET || 'supersecretkey_change_in_production',
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      username: user.username,
      role: user.role,
      avatarPath: user.avatarPath,
      name: user.name,
      email: user.email,
      showSpoilers: user.showSpoilers
    }
  });
});

router.get('/me', authenticateToken, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const envApiKey = process.env.TMDB_API_KEY || null;
  let systemSettings = await prisma.systemSettings.findFirst();
  if (!systemSettings) {
    systemSettings = await prisma.systemSettings.create({
      data: { id: 1, tmdbApiKey: envApiKey }
    });
  } else if (!systemSettings.tmdbApiKey && envApiKey) {
    systemSettings = await prisma.systemSettings.update({
      where: { id: systemSettings.id },
      data: { tmdbApiKey: envApiKey }
    });
  }

  if (user.role === 'admin' && !systemSettings.plexGlobalWebhookToken) {
    const plexGlobalWebhookToken = crypto.randomBytes(16).toString('hex');
    systemSettings = await prisma.systemSettings.update({
      where: { id: systemSettings.id },
      data: { plexGlobalWebhookToken }
    });
  }

  const resData = { 
    id: user.id,
    username: user.username, 
    name: user.name,
    email: user.email,
    avatarPath: user.avatarPath,
    role: user.role,
    plexUser: user.plexUser, 
    plexWebhookToken: user.plexWebhookToken,
    plexLastWebhookAt: user.plexLastWebhookAt,
    tmdbApiKey: systemSettings?.tmdbApiKey || envApiKey || null,
    traktUsername: user.traktUsername,
    traktClientId: user.traktClientId,
    showSpoilers: user.showSpoilers
  };

  if (user.role === 'admin') {
    resData.traktUsername = systemSettings.traktUsername || '';
    resData.traktClientId = systemSettings.traktClientId || '';
    resData.plexGlobalWebhookToken = systemSettings.plexGlobalWebhookToken || '';
    resData.plexGlobalLastWebhookAt = systemSettings.plexGlobalLastWebhookAt || null;
  }

  res.json(resData);
});

module.exports = router;
