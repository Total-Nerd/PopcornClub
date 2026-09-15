const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken } = require('../middleware/auth');
const { getOrCreateMediaRecord } = require('../services/mediaService');

const router = express.Router();
router.use(authenticateToken);

router.post('/episode/collect', async (req, res) => {
  const { tmdbId, season, episode, collected, title, posterPath } = req.body;
  if (!tmdbId || season === undefined || episode === undefined) {
    return res.status(400).json({ error: 'Missing required episode fields' });
  }

  try {
    const media = await getOrCreateMediaRecord({ tmdbId, type: 'tv', title, posterPath });

    if (collected) {
      const coll = await prisma.episodeCollection.upsert({
        where: { userId_mediaId_season_episode: { userId: req.user.id, mediaId: media.id, season, episode } },
        update: { collectedAt: new Date() },
        create: { userId: req.user.id, mediaId: media.id, season, episode, collectedAt: new Date() }
      });
      const { archiveRequestsOnCollect } = require('../utils/requestManager');
      await archiveRequestsOnCollect(media.id, 'tv', season, episode);
      res.json({ success: true, collection: coll });
    } else {
      await prisma.episodeCollection.deleteMany({
        where: { userId: req.user.id, mediaId: media.id, season, episode }
      });
      res.json({ success: true, removed: true });
    }
  } catch (error) {
    console.error('Failed to toggle episode collection:', error);
    res.status(500).json({ error: 'Failed to toggle episode collection status' });
  }
});

// Mark Collected
router.post('/collect', async (req, res) => {
  const { tmdbId, type, title, overview, releaseDate, posterPath, collectedAt, remove } = req.body;
  if (!tmdbId || !type || !title) return res.status(400).json({ error: 'Missing required media fields' });

  try {
    const media = await getOrCreateMediaRecord({ tmdbId, type, title, overview, releaseDate, posterPath });

    if (remove) {
      await prisma.collection.deleteMany({ where: { userId: req.user.id, mediaId: media.id } });
      res.json({ removed: true });
    } else {
      const collection = await prisma.collection.upsert({
        where: { userId_mediaId: { userId: req.user.id, mediaId: media.id } },
        update: { collectedAt: collectedAt ? new Date(collectedAt) : new Date() },
        create: { userId: req.user.id, mediaId: media.id, collectedAt: collectedAt ? new Date(collectedAt) : new Date() }
      });
      const { archiveRequestsOnCollect } = require('../utils/requestManager');
      await archiveRequestsOnCollect(media.id, type);
      res.json(collection);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to collect media' });
  }
});

// Hide Media
router.post('/hide', async (req, res) => {
  const { tmdbId, type, title, overview, releaseDate, posterPath, hideInCalendar, hideInLibrary, unhide } = req.body;
  if (!tmdbId || !type || !title) return res.status(400).json({ error: 'Missing required media fields' });

  try {
    const media = await getOrCreateMediaRecord({ tmdbId, type, title, overview, releaseDate, posterPath });

    if (unhide) {
      await prisma.hiddenItem.deleteMany({ where: { userId: req.user.id, mediaId: media.id } });
      res.json({ unhidden: true });
    } else {
      const hiddenItem = await prisma.hiddenItem.upsert({
        where: { userId_mediaId: { userId: req.user.id, mediaId: media.id } },
        update: { 
          hideInCalendar: hideInCalendar !== undefined ? hideInCalendar : true,
          hideInLibrary: hideInLibrary !== undefined ? hideInLibrary : true
        },
        create: { 
          userId: req.user.id, 
          mediaId: media.id,
          hideInCalendar: hideInCalendar !== undefined ? hideInCalendar : true,
          hideInLibrary: hideInLibrary !== undefined ? hideInLibrary : true
        }
      });
      res.json(hiddenItem);
    }
  } catch (error) {
    console.error('Failed to toggle hide status:', error);
    res.status(500).json({ error: 'Failed to hide/unhide media' });
  }
});

// Get Hidden Items
router.get('/hidden-items', async (req, res) => {
  try {
    const hiddenItems = await prisma.hiddenItem.findMany({
      where: { userId: req.user.id },
      include: {
        media: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(hiddenItems);
  } catch (error) {
    console.error('Failed to fetch hidden items:', error);
    res.status(500).json({ error: 'Failed to fetch hidden items' });
  }
});

// Mark Watched
router.post('/watch', async (req, res) => {
  const { tmdbId, type, title, overview, releaseDate, posterPath, watchedAt, remove } = req.body;
  if (!tmdbId || !type || !title) return res.status(400).json({ error: 'Missing required media fields' });

  try {
    const media = await getOrCreateMediaRecord({ tmdbId, type, title, overview, releaseDate, posterPath });

    if (remove) {
      await prisma.watchHistory.deleteMany({ where: { userId: req.user.id, mediaId: media.id } });
      await prisma.watchHistoryLog.deleteMany({ where: { userId: req.user.id, mediaId: media.id } });
      res.json({ removed: true });
    } else {
      const history = await prisma.watchHistory.create({
        data: { userId: req.user.id, mediaId: media.id, watchedAt: watchedAt ? new Date(watchedAt) : new Date() }
      });
      const systemSettings = await prisma.systemSettings.findFirst();
      const runtime = await resolveDuration({
        tmdbId: media.tmdbId,
        type: type,
        apiKey: systemSettings?.tmdbApiKey || process.env.TMDB_API_KEY
      });
      const durationSec = runtime * 60;
      await prisma.watchHistoryLog.create({
        data: {
          userId: req.user.id,
          mediaId: media.id,
          type: type,
          watchedAt: watchedAt ? new Date(watchedAt) : new Date(),
          isCompleted: true,
          duration: durationSec,
          viewOffset: durationSec
        }
      });
      res.json(history);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to record watch history' });
  }
});

// POST force remove a Media record and all its associated data
module.exports = router;
