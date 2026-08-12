const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { sendAdminRequestNotification, sendUserRequestUpdateNotification } = require('../utils/mailer');
const { fetchTMDB, calculateAiredEpisodes } = require('../utils/tmdb');

const prisma = new PrismaClient();

// GET /api/requests
// Fetch all requests
router.get('/', async (req, res) => {
  try {
    let requests = await prisma.request.findMany({
      include: {
        user: { select: { id: true, username: true, avatarPath: true } },
        media: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    const tmdbApiKey = systemSettings?.tmdbApiKey;

    // Enrich with collected counts for TV Shows/Seasons
    requests = await Promise.all(requests.map(async (reqItem) => {
      let collectedCount = 0;
      let totalEpisodes = '?';

      if (reqItem.media.type === 'tv' && reqItem.episode === null) {
        if (reqItem.season === null) {
          // Whole show requested
          collectedCount = await prisma.localFile.count({
            where: { mediaId: reqItem.media.id }
          });
          
          if (tmdbApiKey) {
            try {
              const tmdbRes = await fetchTMDB(`/3/tv/${reqItem.media.tmdbId}`, tmdbApiKey);
              totalEpisodes = calculateAiredEpisodes(tmdbRes);
            } catch (e) {
              console.error("Failed to fetch TMDB for request enrichment", e.message);
            }
          }
        } else {
          // Season requested
          collectedCount = await prisma.localFile.count({
            where: { mediaId: reqItem.media.id, season: reqItem.season }
          });
          
          if (tmdbApiKey) {
            try {
              const tmdbRes = await fetchTMDB(`/3/tv/${reqItem.media.tmdbId}`, tmdbApiKey);
              const seasonData = tmdbRes.seasons?.find(s => s.season_number === reqItem.season);
              if (seasonData) {
                totalEpisodes = seasonData.episode_count || '?';
              }
            } catch (e) {
              console.error("Failed to fetch TMDB for request enrichment", e.message);
            }
          }
        }
      }

      let imdbId = null;
      if (tmdbApiKey) {
        try {
          if (reqItem.media.type === 'movie') {
            const tmdbRes = await fetchTMDB(`/3/movie/${reqItem.media.tmdbId}`, tmdbApiKey);
            imdbId = tmdbRes.imdb_id;
          } else {
            const extRes = await fetchTMDB(`/3/tv/${reqItem.media.tmdbId}/external_ids`, tmdbApiKey);
            imdbId = extRes.imdb_id;
          }
        } catch (e) {
          console.error("Failed to fetch IMDB ID for request enrichment", e.message);
        }
      }

      return { ...reqItem, collectedCount, totalEpisodes, imdbId };
    }));

    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/requests
// Create a new request
router.post('/', async (req, res) => {
  const { tmdbId, type, title, season, episode } = req.body;
  const userId = req.user.id; // Assuming authentication middleware attaches user

  try {
    // 1. Check for global auto-reject
    const parsedTmdbId = parseInt(tmdbId, 10);
    const parsedSeason = season !== undefined ? parseInt(season, 10) : null;
    const parsedEpisode = episode !== undefined ? parseInt(episode, 10) : null;

    // Find the media if it exists
    let media = await prisma.media.findFirst({
      where: { tmdbId: parsedTmdbId, type }
    });

    if (media) {
      // Check if there's any request for this specific item with autoReject enabled
      const autoRejectedRequest = await prisma.request.findFirst({
        where: {
          mediaId: media.id,
          season: parsedSeason,
          episode: parsedEpisode,
          autoReject: true
        }
      });

      if (autoRejectedRequest) {
        return res.status(400).json({ 
          error: 'This request has been automatically rejected by an administrator.',
          reason: autoRejectedRequest.rejectReason 
        });
      }
    }

    // 2. Ensure media exists
    if (!media) {
      // Need to fetch details from TMDB to get poster/backdrop/etc.
      // We'll create a minimal media record for now, or fetch from TMDB cache.
      const API_KEY = process.env.TMDB_API_KEY;
      if (!API_KEY) {
          throw new Error("TMDB_API_KEY is not configured.");
      }
      
      const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${type}/${parsedTmdbId}?api_key=${API_KEY}`);
      const data = tmdbRes.data;
      
      media = await prisma.media.create({
        data: {
          tmdbId: parsedTmdbId,
          type,
          title: type === 'movie' ? data.title : data.name,
          overview: data.overview,
          releaseDate: data.release_date || data.first_air_date ? new Date(data.release_date || data.first_air_date) : null,
          posterPath: data.poster_path,
          backdropPath: data.backdrop_path,
          genres: data.genres ? data.genres.map(g => g.name).join(', ') : null,
        }
      });
    }

    // 3. Create the request
    // Check if the user already requested this
    const existingRequest = await prisma.request.findFirst({
      where: {
        userId,
        mediaId: media.id,
        season: parsedSeason,
        episode: parsedEpisode
      }
    });

    if (existingRequest) {
      if (existingRequest.status === 'rejected' && !existingRequest.autoReject) {
        const newStatus = req.user.role === 'admin' ? 'confirmed' : 'pending';
        
        // If an admin requests a previously rejected item, confirm it and confirm other pending requests
        if (newStatus === 'confirmed') {
          await prisma.request.updateMany({
            where: { mediaId: media.id, season: parsedSeason, episode: parsedEpisode, status: 'pending' },
            data: { status: 'confirmed' }
          });
        }

        const updatedRequest = await prisma.request.update({
          where: { id: existingRequest.id },
          data: { status: newStatus, rejectReason: null },
          include: {
            user: { select: { id: true, username: true, avatarPath: true } },
            media: true
          }
        });
        return res.status(200).json(updatedRequest);
      } else {
        return res.status(400).json({ error: 'You have already requested this item.' });
      }
    }

    // Determine initial status based on other users' requests for the same item
    const otherRequests = await prisma.request.findMany({
      where: {
        mediaId: media.id,
        season: parsedSeason,
        episode: parsedEpisode
      }
    });

    let initialStatus = 'pending';
    if (otherRequests.length > 0) {
      if (otherRequests.some(r => r.status === 'collected')) {
        initialStatus = 'collected';
      } else if (otherRequests.some(r => r.status === 'confirmed')) {
        initialStatus = 'confirmed';
      }
    }

    // Automatically confirm requests from admin users
    if (req.user.role === 'admin' && initialStatus === 'pending') {
      initialStatus = 'confirmed';
      
      // Retroactively confirm any pending requests for this item by other users
      if (otherRequests.some(r => r.status === 'pending')) {
        await prisma.request.updateMany({
          where: { mediaId: media.id, season: parsedSeason, episode: parsedEpisode, status: 'pending' },
          data: { status: 'confirmed' }
        });
      }
    }

    const newRequest = await prisma.request.create({
      data: {
        userId,
        mediaId: media.id,
        season: parsedSeason,
        episode: parsedEpisode,
        status: initialStatus
      },
      include: {
        user: { select: { id: true, username: true, avatarPath: true } },
        media: true
      }
    });

    if (req.user.role !== 'admin') {
      const admins = await prisma.user.findMany({ where: { role: 'admin', email: { not: null } } });
      if (admins.length > 0) {
        sendAdminRequestNotification(admins, newRequest.media, newRequest.user, parsedSeason, parsedEpisode).catch(err => {
          console.error('[Mailer] Background admin notification error:', err);
        });
      }
    }

    res.status(201).json(newRequest);

  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/requests/:id
// User cancels their own request, or admin deletes
router.delete('/:id', async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    const request = await prisma.request.findUnique({ 
      where: { id: requestId },
      include: { user: true, media: true }
    });
    
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.userId !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to cancel this request' });
    }

    await prisma.request.delete({ where: { id: requestId } });

    // If an admin cancelled someone else's request, send an email
    if (userRole === 'admin' && request.userId !== userId) {
      sendUserRequestUpdateNotification(
        request.user,
        request.media,
        'cancelled',
        null,
        request.season,
        request.episode
      ).catch(err => console.error('[Mailer] Background user cancel notification error:', err));
    }

    res.json({ message: 'Request cancelled successfully' });
  } catch (error) {
    console.error('Error deleting request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/requests/:id/status
// Admin updates request status
router.put('/:id/status', async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  const { status, rejectReason, autoReject } = req.body;
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators can update request status' });
  }

  try {
    const updatedRequest = await prisma.request.update({
      where: { id: requestId },
      data: {
        status,
        rejectReason: rejectReason || null,
        autoReject: autoReject || false
      },
      include: {
        user: { select: { id: true, username: true, email: true, avatarPath: true } },
        media: true
      }
    });
    // Send notification if status changed to one of the notable ones
    if (['confirmed', 'collected', 'rejected'].includes(status)) {
      sendUserRequestUpdateNotification(
        updatedRequest.user,
        updatedRequest.media,
        status,
        rejectReason || null,
        updatedRequest.season,
        updatedRequest.episode
      ).catch(err => console.error('[Mailer] Background user update notification error:', err));
    }

    res.json(updatedRequest);
  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
