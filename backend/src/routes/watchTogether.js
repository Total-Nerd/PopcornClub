const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const plexStore = require('../utils/plexStore');
const { broadcastToUser } = require('../utils/wsManager');
const { fetchTMDB } = require('../utils/tmdb');

async function getOrCreateMedia(tmdbId, type) {
  if (!tmdbId || !type) return null;
  const parsedId = parseInt(tmdbId, 10);
  let media = await prisma.media.findFirst({
    where: { tmdbId: parsedId, type }
  });
  if (!media) {
    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    const tmdbApiKey = systemSettings?.tmdbApiKey;
    let title = `${type} #${parsedId}`;
    
    if (tmdbApiKey) {
      try {
        const data = await fetchTMDB(`/3/${type}/${parsedId}`, tmdbApiKey);
        title = data.title || data.name || title;
      } catch (err) {}
    }
    
    media = await prisma.media.create({
      data: {
        tmdbId: parsedId,
        type,
        title,
      }
    });
  }
  return media.id;
}

// Helper to get or create WatchTogetherSession for user
async function getOrCreateSession(userId) {
  let session = await prisma.watchTogetherSession.findUnique({
    where: { userId }
  });
  if (!session) {
    session = await prisma.watchTogetherSession.create({
      data: {
        userId,
        enabled: false,
        participantIds: '[]'
      }
    });
  }
  return session;
}

// GET /api/watch-together - Fetch current Watch Together state
router.get('/', async (req, res) => {
  try {
    const sessionRecord = await getOrCreateSession(req.user.id);
    const participantIds = JSON.parse(sessionRecord.participantIds || '[]');

    const participants = await prisma.user.findMany({
      where: { id: { in: participantIds } },
      select: { id: true, username: true, name: true, avatarPath: true }
    });

    const activeSession = plexStore.getActiveSession(req.user.id);

    res.json({
      enabled: sessionRecord.enabled,
      participantIds,
      participants,
      activeSession
    });
  } catch (err) {
    console.error('Error fetching Watch Together session:', err);
    res.status(500).json({ error: 'Failed to fetch Watch Together session' });
  }
});

// POST /api/watch-together/toggle - Enable/Disable Watch Together Mode
router.post('/toggle', async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled boolean field is required' });
    }

    const sessionRecord = await getOrCreateSession(req.user.id);
    const updatedRecord = await prisma.watchTogetherSession.update({
      where: { userId: req.user.id },
      data: { enabled }
    });

    const participantIds = JSON.parse(updatedRecord.participantIds || '[]');

    // If enabling and host has an active session, duplicate session for participants from start
    if (enabled && participantIds.length > 0) {
      const activeSession = plexStore.getActiveSession(req.user.id);
      if (activeSession) {
        for (const pId of participantIds) {
          const duplicatedSession = {
            ...activeSession,
            viewOffset: 0,
            updatedAt: Date.now()
          };
          plexStore.setActiveSession(pId, duplicatedSession);
          broadcastToUser(pId, { type: 'plex-session', session: duplicatedSession });
        }
      }
    }

    res.json({ success: true, enabled: updatedRecord.enabled });
  } catch (err) {
    console.error('Error toggling Watch Together session:', err);
    res.status(500).json({ error: 'Failed to toggle Watch Together session' });
  }
});

// POST /api/watch-together/participants - Update party participants
router.post('/participants', async (req, res) => {
  try {
    const { participantIds } = req.body;
    if (!Array.isArray(participantIds)) {
      return res.status(400).json({ error: 'participantIds array is required' });
    }

    const sessionRecord = await getOrCreateSession(req.user.id);
    const oldParticipantIds = JSON.parse(sessionRecord.participantIds || '[]');
    const newParticipantIds = participantIds.filter(id => id !== req.user.id);

    // Identify newly added and removed participants
    const addedIds = newParticipantIds.filter(id => !oldParticipantIds.includes(id));
    const removedIds = oldParticipantIds.filter(id => !newParticipantIds.includes(id));

    const updatedRecord = await prisma.watchTogetherSession.update({
      where: { userId: req.user.id },
      data: { participantIds: JSON.stringify(newParticipantIds) }
    });

    const hostActiveSession = plexStore.getActiveSession(req.user.id);

    // 1. Newly Added Participants: If host is playing, start tracking from beginning (offset 0)
    if (updatedRecord.enabled && hostActiveSession && addedIds.length > 0) {
      for (const pId of addedIds) {
        const duplicatedSession = {
          ...hostActiveSession,
          viewOffset: 0,
          updatedAt: Date.now()
        };
        plexStore.setActiveSession(pId, duplicatedSession);
        broadcastToUser(pId, { type: 'plex-session', session: duplicatedSession });
      }
    }

    // 2. Removed Participants: Finalize/stop active session up to current point
    if (removedIds.length > 0) {
      for (const rId of removedIds) {
        const rSession = plexStore.getActiveSession(rId);
        if (rSession) {
          plexStore.clearActiveSession(rId);
          broadcastToUser(rId, { type: 'plex-session', session: null });
        }
      }
    }

    const participants = await prisma.user.findMany({
      where: { id: { in: newParticipantIds } },
      select: { id: true, username: true, name: true, avatarPath: true }
    });

    res.json({
      success: true,
      participantIds: newParticipantIds,
      participants
    });
  } catch (err) {
    console.error('Error updating Watch Together participants:', err);
    res.status(500).json({ error: 'Failed to update Watch Together participants' });
  }
});

// GET /api/watch-together/default/:mediaId - Fetch default participants for a media
router.get('/default/:mediaId', async (req, res) => {
  try {
    const tmdbId = req.params.mediaId;
    const { mediaType } = req.query;
    
    let internalMediaId = null;
    if (mediaType) {
      internalMediaId = await getOrCreateMedia(tmdbId, mediaType);
    } else {
      const parsedId = parseInt(tmdbId, 10);
      const media = await prisma.media.findFirst({ where: { tmdbId: parsedId } });
      internalMediaId = media?.id;
    }

    if (!internalMediaId) {
      return res.json({ participantIds: [], participants: [] });
    }

    const defaultWt = await prisma.defaultWatchTogether.findUnique({
      where: {
        userId_mediaId: { userId: req.user.id, mediaId: internalMediaId }
      }
    });

    const participantIds = defaultWt ? JSON.parse(defaultWt.participantIds || '[]') : [];

    const participants = await prisma.user.findMany({
      where: { id: { in: participantIds } },
      select: { id: true, username: true, name: true, avatarPath: true }
    });

    res.json({ participantIds, participants });
  } catch (err) {
    console.error('Error fetching default Watch Together session:', err);
    res.status(500).json({ error: 'Failed to fetch default Watch Together session' });
  }
});

// POST /api/watch-together/default/:mediaId - Update default participants for a media
router.post('/default/:mediaId', async (req, res) => {
  try {
    const tmdbId = req.params.mediaId;
    const { participantIds, mediaType } = req.body;
    
    if (!Array.isArray(participantIds)) {
      return res.status(400).json({ error: 'participantIds array is required' });
    }
    if (!mediaType) {
      return res.status(400).json({ error: 'mediaType is required' });
    }

    const internalMediaId = await getOrCreateMedia(tmdbId, mediaType);
    if (!internalMediaId) {
      return res.status(400).json({ error: 'Failed to resolve media' });
    }

    const newParticipantIds = participantIds.filter(id => id !== req.user.id);

    const updatedRecord = await prisma.defaultWatchTogether.upsert({
      where: {
        userId_mediaId: { userId: req.user.id, mediaId: internalMediaId }
      },
      update: {
        participantIds: JSON.stringify(newParticipantIds)
      },
      create: {
        userId: req.user.id,
        mediaId: internalMediaId,
        participantIds: JSON.stringify(newParticipantIds)
      }
    });

    const participants = await prisma.user.findMany({
      where: { id: { in: newParticipantIds } },
      select: { id: true, username: true, name: true, avatarPath: true }
    });

    res.json({
      success: true,
      participantIds: newParticipantIds,
      participants
    });
  } catch (err) {
    console.error('Error updating default Watch Together participants:', err);
    res.status(500).json({ error: 'Failed to update default Watch Together participants' });
  }
});

module.exports = router;
