const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
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
    let overview = '';
    let releaseDate = null;
    let posterPath = null;
    
    if (tmdbApiKey) {
      try {
        const data = await fetchTMDB(`/3/${type}/${parsedId}`, tmdbApiKey);
        title = data.title || data.name || title;
        overview = data.overview || '';
        releaseDate = data.release_date || data.first_air_date || null;
        posterPath = data.poster_path || null;
      } catch (err) {}
    }
    
    media = await prisma.media.create({
      data: {
        tmdbId: parsedId,
        type,
        title,
        overview,
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        posterPath
      }
    });
  }
  return media.id;
}

// Add or remove a reaction
router.post('/', async (req, res) => {
  try {
    const { mediaId, mediaType, season, episode, emoji } = req.body;
    const userId = req.user.id;

    if (!mediaId || !mediaType || !emoji) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const localMediaId = await getOrCreateMedia(mediaId, mediaType);
    if (!localMediaId) return res.status(400).json({ error: 'Invalid media' });

    // Toggle logic: check if exists
    const existing = await prisma.reaction.findFirst({
      where: {
        userId,
        mediaId: localMediaId,
        season: season ? parseInt(season) : null,
        episode: episode ? parseInt(episode) : null,
        emoji,
      }
    });

    if (existing) {
      // Remove it
      await prisma.reaction.delete({ where: { id: existing.id } });
      return res.json({ action: 'removed', emoji });
    } else {
      // Add it
      const reaction = await prisma.reaction.create({
        data: {
          userId,
          mediaId: localMediaId,
          season: season ? parseInt(season) : null,
          episode: episode ? parseInt(episode) : null,
          emoji,
        }
      });
      return res.json({ action: 'added', reaction });
    }
  } catch (error) {
    console.error('Error toggling reaction:', error);
    res.status(500).json({ error: 'Failed to toggle reaction' });
  }
});

// Get reactions for media/episode
router.get('/media/:mediaId', async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { mediaType, season, episode } = req.query;

    const localMediaId = mediaType ? await getOrCreateMedia(mediaId, mediaType) : parseInt(mediaId);
    if (!localMediaId) return res.json({ counts: {}, userReacted: {} });

    const whereClause = {
      mediaId: localMediaId,
      season: season ? parseInt(season) : null,
      episode: episode ? parseInt(episode) : null,
    };

    const reactions = await prisma.reaction.findMany({
      where: whereClause,
    });

    // Group and count
    const counts = {};
    const userReacted = {};
    const userId = req.user.id;

    reactions.forEach(r => {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1;
      if (r.userId === userId) {
        userReacted[r.emoji] = true;
      }
    });

    res.json({ counts, userReacted });
  } catch (error) {
    console.error('Error fetching reactions:', error);
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
});

module.exports = router;
