const express = require('express');
const prisma = require('../prismaClient');
const { authenticateToken } = require('../middleware/auth');
const { moveAndRenameFile, evaluateTemplate } = require('../utils/renamer');
const { processSingleFile, scanSingleFolder } = require('../utils/folderScanner');
const { fetchTMDB } = require('../utils/tmdb');

const router = express.Router();
router.use(authenticateToken);

// Helper to enrich context with resolution, codec, genre, and episodeTitle
async function enrichContext(item, settings) {
  const context = {
    title: item.parsedTitle || '',
    year: item.parsedYear || '',
    season: item.parsedSeason || '',
    episode: item.parsedEpisode || '',
    tmdbId: item.tmdbId || '',
    type: item.parsedType || '',
    resolution: 'Unknown',
    videoCodec: 'Unknown',
    genre: 'Unknown',
    episodeTitle: 'Unknown'
  };

  const nameToParse = item.filename;

  // Extract resolution
  const resMatch = nameToParse.match(/\b(2160p|1080p|720p|4k|uhd|480p)\b/i);
  if (resMatch) {
    context.resolution = resMatch[1].toLowerCase();
    if (context.resolution === '4k' || context.resolution === 'uhd') {
       context.resolution = '2160p';
    }
  }

  // Extract video codec
  const codecMatch = nameToParse.match(/\b(h\.?264|x264|h\.?265|x265|hevc|av1)\b/i);
  if (codecMatch) {
    let rawCodec = codecMatch[1].toLowerCase().replace(/\./g, '');
    if (rawCodec === 'h264' || rawCodec === 'x264') context.videoCodec = 'x264';
    else if (rawCodec === 'h265' || rawCodec === 'x265' || rawCodec === 'hevc') context.videoCodec = 'HEVC';
    else if (rawCodec === 'av1') context.videoCodec = 'AV1';
    else context.videoCodec = codecMatch[1];
  }

  // Fetch from TMDB if tmdbId and apiKey are present
  if (item.tmdbId && settings && settings.tmdbApiKey) {
    try {
      if (item.parsedType === 'movie') {
        const tmdbData = await fetchTMDB(`/3/movie/${item.tmdbId}`, settings.tmdbApiKey);
        if (tmdbData && tmdbData.genres && tmdbData.genres.length > 0) {
          context.genre = tmdbData.genres[0].name;
        }
      } else if (item.parsedType === 'tv' && item.parsedSeason && item.parsedEpisode) {
        const tmdbData = await fetchTMDB(`/3/tv/${item.tmdbId}/season/${item.parsedSeason}/episode/${item.parsedEpisode}`, settings.tmdbApiKey);
        if (tmdbData && tmdbData.name) {
          context.episodeTitle = tmdbData.name;
        }
      }
    } catch (err) {
      console.warn(`[Downloads] Failed to fetch extended TMDB info for item ${item.id}:`, err.message);
    }
  }

  return { ...item, ...context };
}

// GET /api/downloads - List all pending staging items
router.get('/', async (req, res) => {
  try {
    const items = await prisma.stagingItem.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Enrich items with basic TMDB info for display
    const settings = await prisma.systemSettings.findFirst();
    if (settings && settings.tmdbApiKey) {
      await Promise.all(items.map(async (item) => {
        if (item.tmdbId) {
          try {
            const type = item.parsedType === 'movie' ? 'movie' : 'tv';
            const tmdbData = await fetchTMDB(`/3/${type}/${item.tmdbId}`, settings.tmdbApiKey);
            if (tmdbData) {
              item.tmdbTitle = tmdbData.title || tmdbData.name;
              item.tmdbPosterPath = tmdbData.poster_path;
            }
          } catch (err) {
            console.warn(`[Downloads] Failed to fetch TMDB display info for item ${item.id}:`, err.message);
          }
        }
      }));
    }

    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch staging items' });
  }
});

// PUT /api/downloads/:id - Update a staging item (manual correction)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { tmdbId, parsedType, parsedTitle, parsedYear, parsedSeason, parsedEpisode } = req.body;
  
  try {
    const item = await prisma.stagingItem.update({
      where: { id: parseInt(id, 10) },
      data: {
        tmdbId,
        parsedType,
        parsedTitle,
        parsedYear,
        parsedSeason,
        parsedEpisode
      }
    });
    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update staging item' });
  }
});

// DELETE /api/downloads/:id - Delete a staging item (ignore)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.stagingItem.delete({ where: { id: parseInt(id, 10) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete staging item' });
  }
});

// POST /api/downloads/:id/sort/preview - Preview the sort operation without moving
router.post('/:id/sort/preview', async (req, res) => {
  const { id } = req.params;
  try {
    const item = await prisma.stagingItem.findUnique({ where: { id: parseInt(id, 10) } });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.status !== 'pending') return res.status(400).json({ error: 'Item already processed' });

    const settings = await prisma.systemSettings.findFirst();
    const template = item.parsedType === 'tv' ? settings.tvNamingFormat : settings.movieNamingFormat;
    
    if (!template) {
      return res.status(400).json({ error: `Naming format for ${item.parsedType} is not configured in settings.` });
    }

    const context = await enrichContext(item, settings);
    const newPath = evaluateTemplate(template, context);

    res.json({ success: true, newPath, context });
  } catch (error) {
    console.error('[Downloads] Preview error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to generate preview' });
  }
});

// POST /api/downloads/:id/sort - Trigger sort and rename
router.post('/:id/sort', async (req, res) => {
  const { id } = req.params;
  const { context: providedContext } = req.body; // Allow passing context from preview

  try {
    const item = await prisma.stagingItem.findUnique({ where: { id: parseInt(id, 10) } });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.status !== 'pending') return res.status(400).json({ error: 'Item already processed' });

    const settings = await prisma.systemSettings.findFirst();
    const template = item.parsedType === 'tv' ? settings.tvNamingFormat : settings.movieNamingFormat;
    
    if (!template) {
      return res.status(400).json({ error: `Naming format for ${item.parsedType} is not configured in settings.` });
    }

    // Use provided context or re-fetch
    const context = providedContext || await enrichContext(item, settings);

    // Attempt to rename and move
    const newPath = await moveAndRenameFile(item.path, template, context);

    // Run the normal folder scanner on the new path to add it to Collections
    await processSingleFile(newPath, item.parsedType, settings.tmdbApiKey);

    // Update status to sorted
    await prisma.stagingItem.update({
      where: { id: item.id },
      data: { status: 'sorted' }
    });

    res.json({ success: true, newPath });
  } catch (error) {
    console.error('[Downloads] Sort error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to sort item' });
  }
});

// POST /api/downloads/scan - Trigger manual scan for downloads folders
router.post('/scan', async (req, res) => {
  try {
    const downloadFolders = await prisma.localFolder.findMany({
      where: { type: 'downloads' }
    });

    if (downloadFolders.length === 0) {
      return res.status(400).json({ error: 'No downloads folders configured' });
    }

    // Trigger asynchronous background scan for all download folders
    for (const folder of downloadFolders) {
      scanSingleFolder(folder).catch(err => console.error(`[Downloads] Error scanning folder ${folder.path}:`, err));
    }

    res.json({ success: true, message: 'Scan started in the background.' });
  } catch (error) {
    console.error('[Downloads] Scan error:', error.message);
    res.status(500).json({ error: 'Failed to trigger scan' });
  }
});

module.exports = router;
