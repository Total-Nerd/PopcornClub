const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../prismaClient');
const { authenticateToken } = require('../middleware/auth');
const { sendInvitationEmail } = require('../utils/mailer');

const router = express.Router();

router.use(authenticateToken);

// Configure Multer for avatar file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/avatars'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'avatar-' + req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Only images (jpg, png, webp, gif) are allowed'));
  }
});

// Update Profile settings (name, email, avatar, password, plex/trakt details)
router.put('/profile', upload.single('avatar'), async (req, res) => {
  const { name, email, password, plexUser, traktUsername, traktClientId } = req.body;
  
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (plexUser !== undefined) updateData.plexUser = plexUser;
    if (req.user.role !== 'admin') {
      if (traktUsername !== undefined) updateData.traktUsername = traktUsername;
      if (traktClientId !== undefined) updateData.traktClientId = traktClientId;
    }
    
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(password, salt);
    }
    
    if (req.file) {
      // Delete existing avatar file if it exists
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (user && user.avatarPath) {
        const oldPath = path.join(__dirname, '../..', user.avatarPath);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (err) {
            console.error('Failed to delete old avatar:', err.message);
          }
        }
      }
      updateData.avatarPath = `/uploads/avatars/${req.file.filename}`;
    }
    
    try {
      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData
      });
      
      let systemSettings = null;
      if (req.user.role === 'admin') {
        const systemUpdate = {};
        if (traktUsername !== undefined) systemUpdate.traktUsername = traktUsername;
        if (traktClientId !== undefined) systemUpdate.traktClientId = traktClientId;

        if (Object.keys(systemUpdate).length > 0) {
          systemSettings = await prisma.systemSettings.upsert({
            where: { id: 1 },
            update: systemUpdate,
            create: { id: 1, ...systemUpdate }
          });
        }
      }

      if (!systemSettings && req.user.role === 'admin') {
        systemSettings = await prisma.systemSettings.findFirst();
      }
      
      res.json({
        success: true,
        user: {
          username: updatedUser.username,
          role: updatedUser.role,
          name: updatedUser.name,
          email: updatedUser.email,
          avatarPath: updatedUser.avatarPath,
          plexUser: updatedUser.plexUser,
          plexWebhookToken: updatedUser.plexWebhookToken,
          plexLastWebhookAt: updatedUser.plexLastWebhookAt,
          traktUsername: req.user.role === 'admin' ? (systemSettings?.traktUsername || '') : updatedUser.traktUsername,
          traktClientId: req.user.role === 'admin' ? (systemSettings?.traktClientId || '') : updatedUser.traktClientId
        }
      });
  } catch (err) {
    console.error('Failed to update profile:', err.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Update global system-wide configurations (Admin only)
router.put('/system', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can modify system settings' });
  }
  const { tmdbApiKey } = req.body;
  try {
    const updated = await prisma.systemSettings.upsert({
      where: { id: 1 },
      update: { tmdbApiKey },
      create: { id: 1, tmdbApiKey }
    });
    res.json({ success: true, tmdbApiKey: updated.tmdbApiKey });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update system settings' });
  }
});

// GET all users (Admin only)
router.get('/users', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        avatarPath: true,
        plexUser: true,
        plexWebhookToken: true,
        createdAt: true
      },
      orderBy: { username: 'asc' }
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST add a user (Admin only)
router.post('/users', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  const { username, name, email, role } = req.body;
  if (!username || !email) {
    return res.status(400).json({ error: 'Username and email are required' });
  }
  
  try {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: username, mode: 'insensitive' } },
          { email: { equals: email, mode: 'insensitive' } }
        ]
      }
    });
    if (existing) {
      if (existing.username.toLowerCase() === username.toLowerCase()) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    const plexWebhookToken = crypto.randomBytes(16).toString('hex');
    
    const newUser = await prisma.user.create({
      data: {
        username,
        name: name || null,
        email,
        passwordHash: "",
        role: role || 'user',
        plexWebhookToken
      }
    });

    // Create default Watchlist for new user
    await prisma.customList.create({
      data: {
        name: 'Watchlist',
        userId: newUser.id
      }
    });

    // Proactively propagate library collections to new user from existing LocalFiles
    try {
      const files = await prisma.localFile.findMany();
      const movieFiles = files.filter(f => f.type === 'movie');
      const tvFiles = files.filter(f => f.type === 'tv');

      const movieMediaIds = Array.from(new Set(movieFiles.map(f => f.mediaId)));
      for (const mId of movieMediaIds) {
        await prisma.collection.upsert({
          where: { userId_mediaId: { userId: newUser.id, mediaId: mId } },
          update: {},
          create: { userId: newUser.id, mediaId: mId }
        });
      }

      const tvMediaIds = Array.from(new Set(tvFiles.map(f => f.mediaId)));
      for (const mId of tvMediaIds) {
        await prisma.collection.upsert({
          where: { userId_mediaId: { userId: newUser.id, mediaId: mId } },
          update: {},
          create: { userId: newUser.id, mediaId: mId }
        });
      }

      for (const f of tvFiles) {
        if (f.season !== null && f.episode !== null) {
          await prisma.episodeCollection.upsert({
            where: {
              userId_mediaId_season_episode: {
                userId: newUser.id,
                mediaId: f.mediaId,
                season: f.season,
                episode: f.episode
              }
            },
            update: {},
            create: {
              userId: newUser.id,
              mediaId: f.mediaId,
              season: f.season,
              episode: f.episode
            }
          });
        }
      }
      console.log(`[User Creator] Propagated ${files.length} library collection items to new user: ${newUser.username}`);
    } catch (syncErr) {
      console.error('[User Creator] Failed to sync collections for new user:', syncErr.message);
    }

    // Construct registration link
    const domain = process.env.APP_DOMAIN || 'https://track.dooleysmith.uk';
    const inviteLink = `${domain}/login?email=${encodeURIComponent(email)}`;
    
    try {
      await sendInvitationEmail(email, name || username, inviteLink);
    } catch (mailErr) {
      console.error('Failed to dispatch invitation email:', mailErr.message);
    }
    
    res.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        plexWebhookToken: newUser.plexWebhookToken
      }
    });
  } catch (err) {
    console.error('Failed to create user:', err.message);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// DELETE remove a user (Admin only)
router.delete('/users/:id', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  const targetId = parseInt(req.params.id, 10);
  if (isNaN(targetId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own admin account' });
  }
  
  try {
    await prisma.user.delete({ where: { id: targetId } });
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete user:', err.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// PUT update a user (Admin only)
router.put('/users/:id', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  const targetId = parseInt(req.params.id, 10);
  if (isNaN(targetId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  const { name, email, role, plexUser } = req.body;

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (role !== undefined) updateData.role = role;
  if (plexUser !== undefined) updateData.plexUser = plexUser;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: targetId },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        avatarPath: true,
        plexUser: true,
        plexWebhookToken: true,
        createdAt: true
      }
    });
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error('Failed to update user:', err.message);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

module.exports = router;
