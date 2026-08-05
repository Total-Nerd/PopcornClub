const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const plexStore = require('../utils/plexStore');
const { broadcastToUser } = require('../utils/wsManager');

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

module.exports = router;
