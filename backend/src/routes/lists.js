const express = require('express');
const prisma = require('../prismaClient');
const { authenticateToken } = require('../middleware/auth');
const { healMediaRecordIfMissingDetails } = require('./media');

const router = express.Router();

router.use(authenticateToken);

// Get all lists
router.get('/', async (req, res) => {
  try {
    const user = await prisma.settings.findUnique({ where: { id: req.user.id } });
    const tmdbApiKey = user?.tmdbApiKey;
    
    const lists = await prisma.customList.findMany({
      include: { items: { include: { media: true } } }
    });

    const { fetchTMDB } = require('../utils/tmdb');

    const healedLists = await Promise.all(lists.map(async (list) => {
      const plainList = JSON.parse(JSON.stringify(list));
      const items = await Promise.all(list.items.map(async (item) => {
        const plainItem = JSON.parse(JSON.stringify(item));
        const media = await healMediaRecordIfMissingDetails(item.media, tmdbApiKey);
        const plainMedia = JSON.parse(JSON.stringify(media));
        
        let backdropPath = null;
        if (tmdbApiKey) {
          try {
            const type = media.type === 'movie' ? 'movie' : 'tv';
            const data = await fetchTMDB(`/3/${type}/${media.tmdbId}`, tmdbApiKey);
            if (data) backdropPath = data.backdrop_path;
          } catch (err) {
            console.error(`Failed to fetch cached backdrop for list item ${media.tmdbId}:`, err.message);
          }
        }

        return { ...plainItem, media: { ...plainMedia, backdropPath } };
      }));
      return { ...plainList, items };
    }));

    res.json(healedLists);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch lists' });
  }
});

// Create a list
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const list = await prisma.customList.create({ data: { name } });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create list' });
  }
});

// Add item to list
router.post('/:listId/items', async (req, res) => {
  const { listId } = req.params;
  const { tmdbId, type, title, overview, releaseDate, posterPath } = req.body;
  
  if (!tmdbId || !type || !title) return res.status(400).json({ error: 'Missing media fields' });

  try {
    let media = await prisma.media.findFirst({ where: { tmdbId, type } });
    if (!media) {
      media = await prisma.media.create({
        data: { tmdbId, type, title, overview, releaseDate: releaseDate ? new Date(releaseDate) : null, posterPath }
      });
    }

    const listItem = await prisma.listItem.create({
      data: { listId: parseInt(listId), mediaId: media.id }
    });

    res.json(listItem);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add item to list' });
  }
});

// Remove item from list
router.delete('/:listId/items/:mediaId', async (req, res) => {
  const { listId, mediaId } = req.params;
  try {
    await prisma.listItem.deleteMany({
      where: { listId: parseInt(listId), mediaId: parseInt(mediaId) }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// Delete a list
router.delete('/:listId', async (req, res) => {
  const { listId } = req.params;
  try {
    const list = await prisma.customList.findUnique({
      where: { id: parseInt(listId) }
    });
    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }
    if (list.name === 'Watchlist') {
      return res.status(400).json({ error: 'Default Watchlist list cannot be deleted' });
    }
    await prisma.customList.delete({
      where: { id: parseInt(listId) }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete list' });
  }
});

module.exports = router;
