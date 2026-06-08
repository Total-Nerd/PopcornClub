const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/status', async (req, res) => {
  const userCount = await prisma.settings.count();
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

  const userCount = await prisma.settings.count();
  if (userCount > 0) {
    return res.status(400).json({ error: 'Setup already completed' });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await prisma.settings.create({
    data: {
      username,
      passwordHash,
      tmdbApiKey: process.env.TMDB_API_KEY || null
    }
  });

  const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'supersecretkey_change_in_production', { expiresIn: '7d' });
  res.json({ token, user: { username: user.username } });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await prisma.settings.findFirst({
    where: {
      username: {
        equals: username,
        mode: 'insensitive'
      }
    }
  });
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'supersecretkey_change_in_production', { expiresIn: '7d' });
  res.json({ token, user: { username: user.username } });
});

router.get('/me', authenticateToken, async (req, res) => {
  const user = await prisma.settings.findUnique({ where: { id: req.user.id } });
  res.json({ 
    username: user.username, 
    plexUser: user.plexUser, 
    tmdbApiKey: user.tmdbApiKey,
    traktUsername: user.traktUsername,
    traktClientId: user.traktClientId
  });
});

module.exports = router;
