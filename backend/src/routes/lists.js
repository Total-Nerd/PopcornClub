const express = require('express');
const prisma = require('../prismaClient');
const { authenticateToken } = require('../middleware/auth');
const { healMediaRecordIfMissingDetails } = require('./media');

const router = express.Router();

router.use(authenticateToken);

// Get all lists
router.get('/', async (req, res) => {
  try {
    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    const tmdbApiKey = systemSettings?.tmdbApiKey;
    
    const lists = await prisma.customList.findMany({
      where: { userId: req.user.id },
      include: { items: { include: { media: true } } }
    });

    const { fetchTMDB } = require('../utils/tmdb');

    const healedLists = await Promise.all(lists.map(async (list) => {
      const plainList = JSON.parse(JSON.stringify(list));
      const items = await Promise.all(list.items.map(async (item) => {
        const plainItem = JSON.parse(JSON.stringify(item));
        const media = await healMediaRecordIfMissingDetails(item.media, tmdbApiKey, req.user.id);
        const plainMedia = JSON.parse(JSON.stringify(media));
        
        let backdropPath = media.backdropPath;
        if (!backdropPath && tmdbApiKey) {
          try {
            const type = media.type === 'movie' ? 'movie' : 'tv';
            const data = await fetchTMDB(`/3/${type}/${media.tmdbId}`, tmdbApiKey);
            if (data && data.backdrop_path) {
              backdropPath = data.backdrop_path;
              await prisma.media.update({
                where: { id: media.id },
                data: { backdropPath }
              });
            }
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
  const { name, visibility = 'INVITE', defaultOrder = 'added', sharedWith = '[]' } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const list = await prisma.customList.create({
      data: { name, visibility, defaultOrder, sharedWith, userId: req.user.id }
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create list' });
  }
});

// Update a list
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, visibility, defaultOrder, sharedWith } = req.body;
  try {
    const list = await prisma.customList.findFirst({
      where: { id: parseInt(id), userId: req.user.id }
    });
    if (!list) return res.status(404).json({ error: 'List not found or unauthorized' });

    const updatedList = await prisma.customList.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(visibility !== undefined && { visibility }),
        ...(defaultOrder !== undefined && { defaultOrder }),
        ...(sharedWith !== undefined && { sharedWith })
      }
    });
    res.json(updatedList);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update list' });
  }
});

// Get a shared list by shareId
router.get('/shared/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;
    const list = await prisma.customList.findUnique({
      where: { shareId },
      include: { 
        items: { include: { media: true } }, 
        user: { select: { id: true, username: true } } 
      }
    });

    if (!list) return res.status(404).json({ error: 'List not found' });

    // Access control
    if (list.visibility === 'INVITE' || list.visibility === 'PRIVATE') {
      let sharedWithArr = [];
      try {
        sharedWithArr = JSON.parse(list.sharedWith || '[]');
      } catch (e) {
        sharedWithArr = [];
      }
      if (req.user.id !== list.userId && !sharedWithArr.includes(req.user.id)) {
        return res.status(403).json({ error: 'Unauthorized to view this list' });
      }
    }

    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    const tmdbApiKey = systemSettings?.tmdbApiKey;
    const { fetchTMDB } = require('../utils/tmdb');

    const plainList = JSON.parse(JSON.stringify(list));
    const items = await Promise.all(list.items.map(async (item) => {
      const plainItem = JSON.parse(JSON.stringify(item));
      const media = await healMediaRecordIfMissingDetails(item.media, tmdbApiKey, req.user.id);
      
      const collection = await prisma.collection.findFirst({ where: { userId: req.user.id, mediaId: media.id } });
      const watchHistory = await prisma.watchHistory.findFirst({ where: { userId: req.user.id, mediaId: media.id } });
      const request = await prisma.request.findFirst({ where: { userId: req.user.id, mediaId: media.id } });
      
      let backdropPath = media.backdropPath;
      if (!backdropPath && tmdbApiKey) {
        try {
          const type = media.type === 'movie' ? 'movie' : 'tv';
          const data = await fetchTMDB(`/3/${type}/${media.tmdbId}`, tmdbApiKey);
          if (data && data.backdrop_path) {
            backdropPath = data.backdrop_path;
            await prisma.media.update({
              where: { id: media.id },
              data: { backdropPath }
            });
          }
        } catch (err) {
          console.error(`Failed to fetch cached backdrop for list item ${media.tmdbId}:`, err.message);
        }
      }

      const plainMedia = JSON.parse(JSON.stringify(media));
      return { 
        ...plainItem, 
        media: { 
          ...plainMedia, 
          backdropPath,
          isCollected: !!collection,
          isWatched: !!watchHistory,
          isRequested: !!request
        } 
      };
    }));

    res.json({ ...plainList, items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch shared list' });
  }
});

// Add item to list
router.post('/:listId/items', async (req, res) => {
  const { listId } = req.params;
  const { tmdbId, type, title, overview, releaseDate, posterPath } = req.body;
  
  if (!tmdbId || !type || !title) return res.status(400).json({ error: 'Missing media fields' });

  try {
    const list = await prisma.customList.findFirst({
      where: { id: parseInt(listId), userId: req.user.id }
    });
    if (!list) return res.status(404).json({ error: 'List not found or unauthorized' });

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
    const list = await prisma.customList.findFirst({
      where: { id: parseInt(listId), userId: req.user.id }
    });
    if (!list) return res.status(404).json({ error: 'List not found or unauthorized' });

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
    const list = await prisma.customList.findFirst({
      where: { id: parseInt(listId), userId: req.user.id }
    });
    if (!list) {
      return res.status(404).json({ error: 'List not found or unauthorized' });
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
