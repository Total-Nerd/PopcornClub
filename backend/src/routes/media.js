const express = require('express');
const axios = require('axios');
const prisma = require('../prismaClient');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { fetchTMDB } = require('../utils/tmdb');
const { resolveDuration } = require('../utils/durationResolver');
const { getAiringDateTime } = require('../utils/airtime');
const { scanMediaItem } = require('../utils/folderScanner');

const router = express.Router();

router.use(authenticateToken);

// Thread-safe helper to fetch or create a Media record, handling concurrent insertions gracefully
async function getOrCreateMediaRecord({ tmdbId, type, title, overview, releaseDate, posterPath }) {
  if (!tmdbId) {
    throw new Error('tmdbId is required to get or create media record');
  }
  const parsedId = parseInt(tmdbId);
  
  let media = await prisma.media.findFirst({ where: { tmdbId: parsedId, type } });
  if (media) {
    // Self-heal/enrich existing record with any missing details if we have them now:
    const needsUpdate = (!media.posterPath && posterPath) ||
                        (!media.overview && overview) ||
                        (!media.releaseDate && releaseDate) ||
                        (media.title.startsWith(`${media.type} #`) && title && !title.startsWith(`${media.type} #`));
    
    if (needsUpdate) {
      try {
        media = await prisma.media.update({
          where: { id: media.id },
          data: {
            posterPath: media.posterPath || posterPath || null,
            overview: media.overview || overview || '',
            releaseDate: media.releaseDate || (releaseDate ? new Date(releaseDate) : null),
            title: media.title.startsWith(`${media.type} #`) && title ? title : media.title
          }
        });
      } catch (err) {
        console.error('Failed to update missing fields in getOrCreateMediaRecord:', err.message);
      }
    }
    return media;
  }

  try {
    media = await prisma.media.create({
      data: {
        tmdbId: parsedId,
        type,
        title: title || `${type} #${parsedId}`,
        overview: overview || '',
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        posterPath
      }
    });
    return media;
  } catch (err) {
    if (err.code === 'P2002') {
      console.log(`Media with tmdbId ${parsedId} was created concurrently. Fetching existing record.`);
      media = await prisma.media.findFirst({ where: { tmdbId: parsedId, type } });
      if (media) return media;
    }
    throw err;
  }
}

// Reusable helper to dynamically self-heal a media record by fetching missing data from TMDB (cached locally)
async function healMediaRecordIfMissingDetails(media, userApiKey, userId) {
  if (!media) return media;
  const needsUpdate = !media.posterPath || 
                      !media.overview || 
                      !media.releaseDate || 
                      !media.genres ||
                      (media.title && media.title.startsWith(`${media.type} #`));
  
  if (needsUpdate && userApiKey) {
    try {
      const type = media.type === 'movie' ? 'movie' : 'tv';
      const data = await fetchTMDB(`/3/${type}/${media.tmdbId}`, userApiKey);
      if (data) {
        const updated = await prisma.media.update({
          where: { id: media.id },
          data: {
            posterPath: media.posterPath || data.poster_path || null,
            backdropPath: media.backdropPath || data.backdrop_path || null,
            overview: media.overview || data.overview || '',
            releaseDate: media.releaseDate || (data.release_date || data.first_air_date ? new Date(data.release_date || data.first_air_date) : null),
            title: media.title && media.title.startsWith(`${media.type} #`) ? (data.title || data.name) : media.title,
            genres: media.genres || (data.genres ? data.genres.map(g => g.name).join(', ') : null)
          },
          include: {
            collections: { where: { userId } },
            watchHistory: { where: { userId } },
            episodeWatchHistory: { where: { userId } },
            episodeCollections: { where: { userId } }
          }
        });
        return updated;
      }
    } catch (err) {
      console.error(`Failed to self-heal media record ${media.tmdbId}:`, err.message);
    }
  }
  return media;
}

// Automatically update show-level watch history based on whether all episodes are watched
async function syncShowWatchHistory(mediaId, tmdbId, tmdbApiKey, userId) {
  if (!tmdbApiKey || !userId) return;
  try {
    const tmdbRes = await fetchTMDB(`/3/tv/${tmdbId}`, tmdbApiKey);
    const totalEpisodes = tmdbRes.number_of_episodes || 0;
    if (totalEpisodes === 0) return;

    // Get current watched episodes count for this user
    const watchedEpisodesCount = await prisma.episodeWatchHistory.count({
      where: { userId, mediaId }
    });

    if (watchedEpisodesCount === totalEpisodes) {
      // All episodes are watched! Create a WatchHistory record for the show if not already exists
      const existing = await prisma.watchHistory.findFirst({
        where: { userId, mediaId }
      });
      if (!existing) {
        await prisma.watchHistory.create({
          data: { userId, mediaId }
        });
        console.log(`Automatically marked TV Show (mediaId: ${mediaId}, tmdbId: ${tmdbId}) as watched for user ${userId}.`);
      }
    } else {
      // Not all episodes are watched. Delete show-level WatchHistory record if exists
      await prisma.watchHistory.deleteMany({
        where: { userId, mediaId }
      });
    }
  } catch (err) {
    console.error(`Failed to sync show watch history for mediaId ${mediaId}:`, err.message);
  }
}

// Attach helpers to router so they can be exported
router.getOrCreateMediaRecord = getOrCreateMediaRecord;
router.healMediaRecordIfMissingDetails = healMediaRecordIfMissingDetails;
router.syncShowWatchHistory = syncShowWatchHistory;


// Helper to enrich search/discover results with local collection/watch status
async function enrichMediaItems(results, userId) {
  if (!results || results.length === 0) return [];
  const tmdbIds = results.map(item => item.id);
  const localMediaList = await prisma.media.findMany({
    where: { tmdbId: { in: tmdbIds } },
    include: {
      collections: { where: { userId } },
      watchHistory: { where: { userId } },
      episodeWatchHistory: { where: { userId } }
    }
  });
  
  const localMediaMap = {};
  for (const media of localMediaList) {
    localMediaMap[media.tmdbId] = {
      isCollected: media.collections.length > 0,
      isWatched: media.watchHistory.length > 0,
      localId: media.id
    };
  }
  
  return results.map(item => {
    const local = localMediaMap[item.id] || { isCollected: false, isWatched: false, localId: null };
    return {
      ...item,
      isCollected: local.isCollected,
      isWatched: local.isWatched,
      localId: local.localId
    };
  });
}

// Discover TMDB
router.get('/discover', async (req, res) => {
  const type = req.query.type || 'all'; // all, movie, tv
  const filterForeign = req.query.includeForeign !== 'true';
  
  try {
    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    if (!systemSettings || !systemSettings.tmdbApiKey) {
      return res.status(400).json({ error: 'TMDB API Key is not configured' });
    }
    const apiKey = systemSettings.tmdbApiKey;

    let upcomingPromise, popularPromise, bestRatedPromise;

    const processResults = (data, mediaType, { isUpcoming = false } = {}) => {
      let results = data.results || [];
      if (filterForeign) {
        results = results.filter(item => item.original_language === 'en');
      }
      if (isUpcoming && mediaType === 'movie') {
        const minDate = new Date();
        minDate.setMonth(minDate.getMonth() - 6); // Allow movies up to 6 months old
        results = results.filter(item => {
          if (!item.release_date) return false;
          return new Date(item.release_date) >= minDate;
        });
      }
      return results.map(item => ({ ...item, media_type: mediaType }));
    };

    if (type === 'movie') {
      upcomingPromise = fetchTMDB('/3/movie/upcoming', apiKey)
        .then(data => processResults(data, 'movie', { isUpcoming: true }));
      popularPromise = fetchTMDB('/3/movie/popular', apiKey)
        .then(data => processResults(data, 'movie'));
      bestRatedPromise = fetchTMDB('/3/movie/top_rated', apiKey)
        .then(data => processResults(data, 'movie'));
    } else if (type === 'tv') {
      upcomingPromise = fetchTMDB('/3/tv/on_the_air', apiKey)
        .then(data => processResults(data, 'tv', { isUpcoming: true }));
      popularPromise = fetchTMDB('/3/tv/popular', apiKey)
        .then(data => processResults(data, 'tv'));
      bestRatedPromise = fetchTMDB('/3/tv/top_rated', apiKey)
        .then(data => processResults(data, 'tv'));
    } else {
      // all
      upcomingPromise = Promise.all([
        fetchTMDB('/3/movie/upcoming', apiKey).then(data => processResults(data, 'movie', { isUpcoming: true })),
        fetchTMDB('/3/tv/on_the_air', apiKey).then(data => processResults(data, 'tv', { isUpcoming: true }))
      ]).then(([movies, tv]) => {
        const combined = [...movies, ...tv];
        combined.sort((a, b) => {
          const dateA = new Date(a.release_date || a.first_air_date || 0);
          const dateB = new Date(b.release_date || b.first_air_date || 0);
          return dateB - dateA;
        });
        return combined.slice(0, 20);
      });

      popularPromise = Promise.all([
        fetchTMDB('/3/movie/popular', apiKey).then(data => processResults(data, 'movie')),
        fetchTMDB('/3/tv/popular', apiKey).then(data => processResults(data, 'tv'))
      ]).then(([movies, tv]) => {
        const combined = [...movies, ...tv];
        combined.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        return combined.slice(0, 20);
      });

      bestRatedPromise = Promise.all([
        fetchTMDB('/3/movie/top_rated', apiKey).then(data => processResults(data, 'movie')),
        fetchTMDB('/3/tv/top_rated', apiKey).then(data => processResults(data, 'tv'))
      ]).then(([movies, tv]) => {
        const combined = [...movies, ...tv];
        combined.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        return combined.slice(0, 20);
      });
    }

    const [upcoming, popular, bestRated] = await Promise.all([
      upcomingPromise,
      popularPromise,
      bestRatedPromise
    ]);

    const [enrichedUpcoming, enrichedPopular, enrichedBestRated] = await Promise.all([
      enrichMediaItems(upcoming, req.user.id),
      enrichMediaItems(popular, req.user.id),
      enrichMediaItems(bestRated, req.user.id)
    ]);

    res.json({
      upcoming: enrichedUpcoming,
      popular: enrichedPopular,
      bestRated: enrichedBestRated
    });

  } catch (error) {
    console.error('TMDB Discover Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch discover data from TMDB' });
  }
});

// Search TMDB
router.get('/search', async (req, res) => {
  const { query, type } = req.query;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  try {
    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    if (!systemSettings || !systemSettings.tmdbApiKey) {
      return res.status(400).json({ error: 'TMDB API Key is not configured' });
    }

    let results = [];
    const searchType = type || 'all';

    if (searchType === 'movie') {
      const response = await axios.get(`https://api.themoviedb.org/3/search/movie`, {
        params: {
          api_key: systemSettings.tmdbApiKey,
          query,
          page: 1,
          include_adult: false
        }
      });
      results = (response.data.results || []).map(item => ({ ...item, media_type: 'movie' }));
    } else if (searchType === 'tv') {
      const response = await axios.get(`https://api.themoviedb.org/3/search/tv`, {
        params: {
          api_key: systemSettings.tmdbApiKey,
          query,
          page: 1,
          include_adult: false
        }
      });
      results = (response.data.results || []).map(item => ({ ...item, media_type: 'tv' }));
    } else {
      const response = await axios.get(`https://api.themoviedb.org/3/search/multi`, {
        params: {
          api_key: systemSettings.tmdbApiKey,
          query,
          page: 1,
          include_adult: false
        }
      });
      results = (response.data.results || []).filter(item => item.media_type === 'movie' || item.media_type === 'tv');
    }
    
    const enrichedResults = await enrichMediaItems(results, req.user.id);
    res.json(enrichedResults);
  } catch (error) {
    console.error('TMDB Search Error:', error.message);
    res.status(500).json({ error: 'Failed to search TMDB' });
  }
});

// Import from Trakt TV (real API import)
router.post('/import-trakt', async (req, res) => {
  const { username, clientId, mode } = req.body;

  try {
    // Real Trakt Import API
    if (!username) {
      return res.status(400).json({ error: 'Trakt username is required' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    
    let traktApiKey = clientId;
    if (!traktApiKey) {
      if (user?.role === 'admin') {
        traktApiKey = systemSettings?.traktClientId;
      } else {
        traktApiKey = user?.traktClientId;
      }
    }
    if (!traktApiKey) {
      traktApiKey = process.env.TRAKT_CLIENT_ID || 'd83a151b72cccd41c88806283db87cc4f56f1837ff44821815b3e24e10b14643';
    }
    const headers = {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': traktApiKey,
      'User-Agent': 'TVTracker/1.0'
    };
    const tmdbApiKey = systemSettings?.tmdbApiKey;

    const getMediaData = async (tmdbId, type) => {
      if (!tmdbApiKey) return { title: `${type} #${tmdbId}` };
      try {
        const data = await fetchTMDB(`/3/${type}/${tmdbId}`, tmdbApiKey);
        return {
          title: data.title || data.name,
          overview: data.overview || '',
          releaseDate: data.release_date || data.first_air_date,
          posterPath: data.poster_path
        };
      } catch (err) {
        console.error(`Failed to fetch tmdb metadata:`, err.message);
        return { title: `${type} #${tmdbId}` };
      }
    };

    if (mode === 'collected') {
      // A. Fetch movies collection
      const movieCollRes = await axios.get(`https://api.trakt.tv/users/${username}/collection/movies`, { headers });
      for (const item of movieCollRes.data) {
        const tmdbId = item.movie.ids.tmdb;
        if (!tmdbId) continue;
        
        // Skip if already in collection
        const existingCollection = await prisma.collection.findFirst({
          where: { userId: req.user.id, media: { tmdbId, type: 'movie' } }
        });
        if (existingCollection) continue;

        let media = await prisma.media.findFirst({ where: { tmdbId, type: 'movie' } });
        if (!media) {
          const details = await getMediaData(tmdbId, 'movie');
          media = await getOrCreateMediaRecord({
            tmdbId,
            type: 'movie',
            ...details
          });
        }
        await prisma.collection.upsert({
          where: { userId_mediaId: { userId: req.user.id, mediaId: media.id } },
          update: { collectedAt: item.collected_at ? new Date(item.collected_at) : new Date() },
          create: { userId: req.user.id, mediaId: media.id, collectedAt: item.collected_at ? new Date(item.collected_at) : new Date() }
        });
      }

      // B. Fetch shows collection
      const showCollRes = await axios.get(`https://api.trakt.tv/users/${username}/collection/shows`, { headers });
      for (const item of showCollRes.data) {
        const tmdbId = item.show.ids.tmdb;
        if (!tmdbId) continue;

        // Skip if already in collection
        const existingCollection = await prisma.collection.findFirst({
          where: { userId: req.user.id, media: { tmdbId, type: 'tv' } }
        });
        if (existingCollection) continue;

        let media = await prisma.media.findFirst({ where: { tmdbId, type: 'tv' } });
        if (!media) {
          const details = await getMediaData(tmdbId, 'tv');
          media = await getOrCreateMediaRecord({
            tmdbId,
            type: 'tv',
            ...details
          });
        }
        await prisma.collection.upsert({
          where: { userId_mediaId: { userId: req.user.id, mediaId: media.id } },
          update: { collectedAt: new Date() },
          create: { userId: req.user.id, mediaId: media.id, collectedAt: new Date() }
        });

        for (const season of item.seasons) {
          for (const ep of season.episodes) {
            await prisma.episodeCollection.upsert({
              where: { userId_mediaId_season_episode: { userId: req.user.id, mediaId: media.id, season: season.number, episode: ep.number } },
              update: { collectedAt: ep.collected_at ? new Date(ep.collected_at) : new Date() },
              create: { userId: req.user.id, mediaId: media.id, season: season.number, episode: ep.number, collectedAt: ep.collected_at ? new Date(ep.collected_at) : new Date() }
            });
          }
        }
      }

      return res.json({ success: true, message: 'Successfully synced Trakt TV collections!' });

    } else if (mode === 'watched') {
      const allMedia = await prisma.media.findMany();
      const movieTmdbIds = new Set(allMedia.filter(m => m.type === 'movie').map(m => m.tmdbId));
      const tvTmdbIds = new Set(allMedia.filter(m => m.type === 'tv').map(m => m.tmdbId));

      // A. Fetch movies watched
      const movieWatchRes = await axios.get(`https://api.trakt.tv/users/${username}/watched/movies`, { headers });
      for (const item of movieWatchRes.data) {
        const tmdbId = item.movie.ids.tmdb;
        if (!tmdbId || !movieTmdbIds.has(tmdbId)) continue;

        const media = allMedia.find(m => m.tmdbId === tmdbId);
        if (!media) continue;

        const existingWatch = await prisma.watchHistory.findFirst({
          where: { userId: req.user.id, mediaId: media.id }
        });
        if (!existingWatch) {
          await prisma.watchHistory.create({
            data: { userId: req.user.id, mediaId: media.id, watchedAt: item.last_watched_at ? new Date(item.last_watched_at) : new Date() }
          });
        }

        const existingLog = await prisma.watchHistoryLog.findFirst({
          where: { userId: req.user.id, mediaId: media.id, type: 'movie', isCompleted: true }
        });
        if (!existingLog) {
          const runtime = await resolveDuration({
            tmdbId: media.tmdbId,
            type: 'movie',
            apiKey: tmdbApiKey
          });
          const durationSec = runtime * 60;
          await prisma.watchHistoryLog.create({
            data: {
              userId: req.user.id,
              mediaId: media.id,
              type: 'movie',
              watchedAt: item.last_watched_at ? new Date(item.last_watched_at) : new Date(),
              isCompleted: true,
              duration: durationSec,
              viewOffset: durationSec
            }
          });
        }
      }

      // B. Fetch shows watched
      const showWatchRes = await axios.get(`https://api.trakt.tv/users/${username}/watched/shows`, { headers });
      for (const item of showWatchRes.data) {
        const tmdbId = item.show.ids.tmdb;
        if (!tmdbId || !tvTmdbIds.has(tmdbId)) continue;

        const media = allMedia.find(m => m.tmdbId === tmdbId);
        if (!media) continue;

        for (const season of item.seasons) {
          for (const ep of season.episodes) {
            await prisma.episodeWatchHistory.upsert({
              where: { userId_mediaId_season_episode: { userId: req.user.id, mediaId: media.id, season: season.number, episode: ep.number } },
              update: { watchedAt: ep.last_watched_at ? new Date(ep.last_watched_at) : new Date() },
              create: { userId: req.user.id, mediaId: media.id, season: season.number, episode: ep.number, watchedAt: ep.last_watched_at ? new Date(ep.last_watched_at) : new Date() }
            });

            const existingLog = await prisma.watchHistoryLog.findFirst({
              where: { userId: req.user.id, mediaId: media.id, type: 'tv', season: season.number, episode: ep.number, isCompleted: true }
            });
            if (!existingLog) {
              const runtime = await resolveDuration({
                tmdbId: media.tmdbId,
                type: 'tv',
                season: season.number,
                episode: ep.number,
                apiKey: tmdbApiKey
              });
              const durationSec = runtime * 60;
              await prisma.watchHistoryLog.create({
                data: {
                  userId: req.user.id,
                  mediaId: media.id,
                  type: 'tv',
                  season: season.number,
                  episode: ep.number,
                  watchedAt: ep.last_watched_at ? new Date(ep.last_watched_at) : new Date(),
                  isCompleted: true,
                  duration: durationSec,
                  viewOffset: durationSec
                }
              });
            }
          }
        }
        if (tmdbApiKey) {
          await syncShowWatchHistory(media.id, media.tmdbId, tmdbApiKey, req.user.id);
        }
      }

      return res.json({ success: true, message: 'Successfully synced Trakt TV watch histories!' });
    } else {
      return res.status(400).json({ error: 'Invalid sync mode specified' });
    }
  } catch (error) {
    console.error('Trakt Import Error:', error.message);
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      const details = typeof data === 'string' ? data : JSON.stringify(data);
      console.error(`Trakt API responded with status ${status}:`, details);
      return res.status(status).json({
        error: `Trakt Import failed: Request failed with status code ${status}. ${status === 403 ? 'Please verify your Trakt Client ID (API Key) under Advanced API Settings.' : details}`
      });
    }
    res.status(500).json({ error: `Trakt Import failed: ${error.message}` });
  }
});

// GET media conflicts (mismatched titles/years, unresolved details, or orphaned files)
router.get('/conflicts', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const mediaList = await prisma.media.findMany({
      include: {
        localFiles: true,
        collections: true,
        watchHistoryLogs: true,
        listItems: true
      }
    });

    const conflicts = [];

    const getYear = (date) => {
      if (!date) return null;
      return new Date(date).getFullYear();
    };

    const cleanTitle = (str) => {
      return str.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
    };

    const parseFilenameSimple = (filePath) => {
      const filename = filePath.split(/[/\\]/).pop();
      const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
      
      const normalizedPath = filePath.replace(/\\/g, '/');
      
      // Try to extract TMDB ID from anywhere in the path/filename
      let tmdbId = null;
      const tmdbMatch = normalizedPath.match(/(?:tmdb|tmdbid)[-:\s]+(\d+)/i) || normalizedPath.match(/\b(?:tmdb|tmdbid)-(\d+)\b/i);
      if (tmdbMatch) {
        tmdbId = parseInt(tmdbMatch[1], 10);
      }

      const isTvPath = normalizedPath.includes('/tv/') || normalizedPath.startsWith('/tv/');

      if (isTvPath) {
        const parts = normalizedPath.split('/');
        const tvIndex = parts.indexOf('tv');
        let title = '';
        if (tvIndex !== -1 && parts.length > tvIndex + 1) {
          title = parts[tvIndex + 1];
        } else {
          title = nameWithoutExt;
        }

        let year = null;
        const yearMatch = title.match(/(?:\(|\[)(\d{4})(?:[\s,\]\)]|$)/);
        if (yearMatch) {
          year = parseInt(yearMatch[1], 10);
        }

        // Clean title of tmdb tags and year tags
        let cleanedTitle = title;
        cleanedTitle = cleanedTitle.replace(/[\(\[](?:tmdb|tmdbid)[-:\s]*\d+[\)\]]/gi, '');
        cleanedTitle = cleanedTitle.replace(/[\(\[]\d{4}[\)\]]/g, '');
        cleanedTitle = cleanTitle(cleanedTitle);

        let season = 1;
        let episode = 1;

        if (parts.length >= 2) {
          const parentFolder = parts[parts.length - 2];
          const seasonMatch = parentFolder.match(/season\s*(\d{1,2})/i);
          if (seasonMatch) {
            season = parseInt(seasonMatch[1], 10);
          }
        }

        const tvMatch1 = nameWithoutExt.match(/s(\d{1,2})e(\d{1,2})/i);
        const tvMatch2 = nameWithoutExt.match(/(\d{1,2})x(\d{1,2})/i);

        if (tvMatch1) {
          season = parseInt(tvMatch1[1], 10);
          episode = parseInt(tvMatch1[2], 10);
        } else if (tvMatch2) {
          season = parseInt(tvMatch2[1], 10);
          episode = parseInt(tvMatch2[2], 10);
        }

        if (!year) {
          const yearMatchFn = nameWithoutExt.match(/(?:\(|\[)(\d{4})(?:[\s,\]\)]|$)/);
          if (yearMatchFn) {
            year = parseInt(yearMatchFn[1], 10);
          }
        }

        return {
          type: 'tv',
          title: cleanedTitle,
          season,
          episode,
          year,
          tmdbId
        };
      }

      // Movie logic
      let title = nameWithoutExt;
      let year = null;
      const yearMatch = nameWithoutExt.match(/(?:\(|\[)(\d{4})(?:[\s,\]\)]|$)/);
      if (yearMatch) {
        year = parseInt(yearMatch[1], 10);
        title = nameWithoutExt.substring(0, nameWithoutExt.indexOf(yearMatch[0]));
      } else {
        const parts = normalizedPath.split('/');
        if (parts.length >= 2) {
          const folderName = parts[parts.length - 2];
          const folderYearMatch = folderName.match(/(?:\(|\[)(\d{4})(?:[\s,\]\)]|$)/);
          if (folderYearMatch) {
            year = parseInt(folderYearMatch[1], 10);
          }
        }
      }

      let cleanedTitle = title;
      cleanedTitle = cleanedTitle.replace(/[\(\[](?:tmdb|tmdbid)[-:\s]*\d+[\)\]]/gi, '');
      cleanedTitle = cleanedTitle.replace(/[\(\[]\d{4}[\)\]]/g, '');
      cleanedTitle = cleanTitle(cleanedTitle);

      return {
        type: 'movie',
        title: cleanedTitle,
        year,
        tmdbId
      };
    };

    for (const media of mediaList) {
      const mediaTitleClean = cleanTitle(media.title);
      const mediaYear = getYear(media.releaseDate);

      // Check 1: Missing metadata (no overview and no posterPath)
      if (!media.overview && !media.posterPath) {
        conflicts.push({
          mediaId: media.id,
          tmdbId: media.tmdbId,
          title: media.title,
          type: media.type,
          posterPath: media.posterPath,
          releaseDate: media.releaseDate,
          conflictType: 'missing_metadata',
          message: 'Missing overview and poster artwork (unresolved details)',
          files: media.localFiles.map(f => f.path)
        });
        continue;
      }

      // Check 2: No local files linked to collection or watch history
      // Bypassed if item is present on any custom lists (e.g. Watchlist)
      if (media.localFiles.length === 0 && media.listItems.length === 0) {
        conflicts.push({
          mediaId: media.id,
          tmdbId: media.tmdbId,
          title: media.title,
          type: media.type,
          posterPath: media.posterPath,
          releaseDate: media.releaseDate,
          conflictType: 'no_files',
          message: 'Orphaned media record (no local files linked on disk)',
          files: []
        });
        continue;
      }

      // Check file mismatches
      const yearMismatchedFiles = [];
      const titleMismatchedFiles = [];
      const yearValues = [];

      for (const file of media.localFiles) {
        if (file.manuallyCorrected) continue;
        const parsed = parseFilenameSimple(file.path);
        
        // Check 3: Year Mismatch
        if (parsed.year && mediaYear && parsed.year !== mediaYear) {
          yearMismatchedFiles.push(file.path);
          if (!yearValues.includes(parsed.year)) {
            yearValues.push(parsed.year);
          }
        }

        // Check 4: Title Mismatch
        const fileWords = parsed.title.split(/\s+/).filter(w => w.length > 2 && w !== 'the' && w !== 'and' && w !== 'for');
        const mediaWords = mediaTitleClean.split(/\s+/).filter(w => w.length > 2 && w !== 'the' && w !== 'and' && w !== 'for');
        
        const hasSubstring = parsed.title.includes(mediaTitleClean) || mediaTitleClean.includes(parsed.title);
        const overlaps = fileWords.some(w => mediaWords.includes(w));

        if (!hasSubstring && !overlaps && fileWords.length > 0 && mediaWords.length > 0) {
          titleMismatchedFiles.push(file.path);
        }
      }

      if (yearMismatchedFiles.length > 0) {
        conflicts.push({
          mediaId: media.id,
          tmdbId: media.tmdbId,
          title: media.title,
          type: media.type,
          posterPath: media.posterPath,
          releaseDate: media.releaseDate,
          conflictType: 'year_mismatch',
          message: `Year mismatch: File(s) have year ${yearValues.join(', ')}, TMDB has ${mediaYear}`,
          files: yearMismatchedFiles
        });
      }

      if (titleMismatchedFiles.length > 0) {
        conflicts.push({
          mediaId: media.id,
          tmdbId: media.tmdbId,
          title: media.title,
          type: media.type,
          posterPath: media.posterPath,
          releaseDate: media.releaseDate,
          conflictType: 'title_mismatch',
          message: `Title mismatch: Filename parsed titles do not match TMDB title "${media.title}"`,
          files: titleMismatchedFiles
        });
      }
    }

    // --- Missing Episodes Logic ---
    const ignoredRecords = await prisma.ignoredMissingEpisode.findMany({
      where: { userId: req.user.id }
    });
    const ignoredSet = new Set(ignoredRecords.map(r => `${r.mediaId}-${r.season}-${r.episode}`));

    const userEpCols = await prisma.episodeCollection.findMany({
      where: { userId: req.user.id },
      select: { mediaId: true, season: true, episode: true }
    });
    
    const collectedByMedia = {};
    for (const ec of userEpCols) {
      if (!collectedByMedia[ec.mediaId]) collectedByMedia[ec.mediaId] = [];
      collectedByMedia[ec.mediaId].push(`${ec.season}-${ec.episode}`);
    }

    const tvMediaList = mediaList.filter(m => m.type === 'tv' && collectedByMedia[m.id]);
    const settings = await prisma.systemSettings.findFirst();
    const apiKey = settings?.tmdbApiKey;

    if (apiKey) {
      for (const media of tvMediaList) {
        try {
          const tmdbData = await fetchTMDB(`/3/tv/${media.tmdbId}`, apiKey);
          if (!tmdbData || !tmdbData.seasons) continue;

          const collected = new Set(collectedByMedia[media.id]);
          
          for (const season of tmdbData.seasons) {
            if (season.season_number <= 0) continue; // Skip specials

            let expectedCount = season.episode_count;
            
            if (tmdbData.last_episode_to_air && tmdbData.last_episode_to_air.season_number === season.season_number) {
              expectedCount = tmdbData.last_episode_to_air.episode_number;
            } else if (tmdbData.next_episode_to_air && tmdbData.next_episode_to_air.season_number === season.season_number) {
              expectedCount = tmdbData.next_episode_to_air.episode_number - 1;
            } else if (tmdbData.last_episode_to_air && tmdbData.last_episode_to_air.season_number < season.season_number) {
              expectedCount = 0;
            }

            let seasonData = null;
            for (let ep = 1; ep <= expectedCount; ep++) {
              if (!collected.has(`${season.season_number}-${ep}`)) {
                if (!seasonData) {
                  seasonData = await fetchTMDB(`/3/tv/${media.tmdbId}/season/${season.season_number}`, apiKey).catch(() => null);
                }
                const epData = seasonData?.episodes?.find(e => e.episode_number === ep);
                const isIgnored = ignoredSet.has(`${media.id}-${season.season_number}-${ep}`);
                conflicts.push({
                  id: `missing-${media.id}-${season.season_number}-${ep}`,
                  conflictType: 'missing-episode',
                  mediaId: media.id,
                  tmdbId: media.tmdbId,
                  title: media.title,
                  posterPath: media.posterPath,
                  season: season.season_number,
                  episode: ep,
                  epName: epData ? epData.name : '',
                  epStillPath: epData ? epData.still_path : null,
                  epOverview: epData ? epData.overview : '',
                  ignored: isIgnored
                });
              }
            }
          }
        } catch (err) {
          console.error(`Failed to fetch TMDB for missing episodes check (tmdbId ${media.tmdbId}):`, err.message);
        }
      }
    }

    res.json(conflicts);
  } catch (error) {
    console.error('Failed to get media conflicts:', error);
    res.status(500).json({ error: 'Failed to get media conflicts' });
  }
});

// GET collected movies
router.get('/movies', async (req, res) => {
  try {
    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    const tmdbApiKey = systemSettings?.tmdbApiKey;
    const mediaList = await prisma.media.findMany({
      where: {
        type: 'movie',
        OR: [
          { collections: { some: { userId: req.user.id } } },
          { listItems: { some: { list: { userId: req.user.id } } } }
        ]
      },
      include: {
        collections: { where: { userId: req.user.id } },
        watchHistory: { where: { userId: req.user.id } }
      }
    });

    const movies = await Promise.all(mediaList.map(async (m) => {
      const healedMedia = await healMediaRecordIfMissingDetails(m, tmdbApiKey, req.user.id);
      const isWatched = healedMedia.watchHistory.length > 0;
      const collectionEntry = healedMedia.collections[0];
      
      let backdropPath = healedMedia.backdropPath;
      if (!backdropPath && tmdbApiKey) {
        try {
          const data = await fetchTMDB(`/3/movie/${m.tmdbId}`, tmdbApiKey);
          if (data && data.backdrop_path) {
            backdropPath = data.backdrop_path;
            await prisma.media.update({
              where: { id: healedMedia.id },
              data: { backdropPath }
            });
          }
        } catch (err) {
          console.error(`Failed to fetch cached backdrop for movie ${m.tmdbId}:`, err.message);
        }
      }

      return {
        ...healedMedia,
        collectedAt: collectionEntry ? collectionEntry.collectedAt : null,
        isCollected: healedMedia.collections.length > 0,
        isWatched,
        watchHistory: healedMedia.watchHistory,
        backdropPath
      };
    }));

    res.json(movies);
  } catch (error) {
    console.error('Failed to fetch movies:', error);
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

// GET collected shows
router.get('/shows', async (req, res) => {
  try {
    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    const tmdbApiKey = systemSettings?.tmdbApiKey;
    const mediaList = await prisma.media.findMany({
      where: {
        type: 'tv',
        OR: [
          { collections: { some: { userId: req.user.id } } },
          { listItems: { some: { list: { userId: req.user.id } } } }
        ]
      },
      include: {
        collections: { where: { userId: req.user.id } },
        episodeWatchHistory: { where: { userId: req.user.id } },
        episodeCollections: { where: { userId: req.user.id } }
      }
    });

    const shows = await Promise.all(mediaList.map(async (m) => {
      const healedMedia = await healMediaRecordIfMissingDetails(m, tmdbApiKey, req.user.id);
      let totalEpisodes = 0;
      let airedEpisodes = 0;
      let totalSeasons = 0;
      let backdropPath = healedMedia.backdropPath;

      if (tmdbApiKey) {
        try {
          const tmdbRes = await fetchTMDB(`/3/tv/${healedMedia.tmdbId}`, tmdbApiKey);
          totalEpisodes = tmdbRes.number_of_episodes || 0;
          totalSeasons = tmdbRes.number_of_seasons || 0;

          const nowStr = new Date().toISOString().substring(0, 10);
          const lastEp = tmdbRes.last_episode_to_air;

          if (lastEp && lastEp.season_number > 0 && Array.isArray(tmdbRes.seasons)) {
            const lastSeasonNum = lastEp.season_number;
            const lastEpNum = lastEp.episode_number;
            const lastEpAirDate = lastEp.air_date ? new Date(lastEp.air_date) : null;
            const isLastEpAired = !lastEpAirDate || lastEpAirDate <= new Date();

            if (isLastEpAired) {
              for (const season of tmdbRes.seasons) {
                if (!season.season_number || season.season_number === 0) continue;
                if (season.season_number < lastSeasonNum) {
                  airedEpisodes += (season.episode_count || 0);
                } else if (season.season_number === lastSeasonNum) {
                  airedEpisodes += lastEpNum;
                }
              }
            } else {
              for (const season of tmdbRes.seasons) {
                if (!season.season_number || season.season_number === 0) continue;
                if (season.season_number < lastSeasonNum) {
                  airedEpisodes += (season.episode_count || 0);
                }
              }
            }
          } else if (Array.isArray(tmdbRes.seasons)) {
            for (const season of tmdbRes.seasons) {
              if (!season.season_number || season.season_number === 0) continue;
              if (season.air_date && season.air_date <= nowStr) {
                airedEpisodes += (season.episode_count || 0);
              }
            }
          } else {
            airedEpisodes = totalEpisodes;
          }

          if (totalEpisodes > 0 && airedEpisodes > totalEpisodes) {
            airedEpisodes = totalEpisodes;
          }

          if (!backdropPath && tmdbRes.backdrop_path) {
            backdropPath = tmdbRes.backdrop_path;
            await prisma.media.update({
              where: { id: healedMedia.id },
              data: { backdropPath }
            });
          }
        } catch (err) {
          console.error(`Failed to fetch TMDB details for TV show ${healedMedia.tmdbId}:`, err.message);
          airedEpisodes = totalEpisodes;
        }
      } else {
        airedEpisodes = totalEpisodes;
      }

      const watchedCount = healedMedia.episodeWatchHistory.length;
      const collectedCount = healedMedia.episodeCollections.length;
      const collectionEntry = healedMedia.collections[0];

      return {
        ...healedMedia,
        collectedAt: collectionEntry ? collectionEntry.collectedAt : null,
        isCollected: healedMedia.collections.length > 0,
        watchedCount,
        collectedCount,
        totalEpisodes,
        airedEpisodes,
        totalSeasons,
        backdropPath
      };
    }));

    res.json(shows);
  } catch (error) {
    console.error('Failed to fetch shows:', error);
    res.status(500).json({ error: 'Failed to fetch shows' });
  }
});

// GET TV show details (TMDB details + local watched/collected status details)
router.get('/tv/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;
  const parsedId = parseInt(tmdbId);

  try {
    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    if (!systemSettings || !systemSettings.tmdbApiKey) {
      return res.status(400).json({ error: 'TMDB API Key is not configured' });
    }

    const [tmdbData, creditsData, externalIdsData, videosData] = await Promise.all([
      fetchTMDB(`/3/tv/${parsedId}`, systemSettings.tmdbApiKey),
      fetchTMDB(`/3/tv/${parsedId}/credits`, systemSettings.tmdbApiKey),
      fetchTMDB(`/3/tv/${parsedId}/external_ids`, systemSettings.tmdbApiKey),
      fetchTMDB(`/3/tv/${parsedId}/videos`, systemSettings.tmdbApiKey).catch(() => ({ results: [] }))
    ]);

    const media = await prisma.media.findFirst({
      where: { tmdbId: parsedId, type: 'tv' },
      include: {
        collections: { where: { userId: req.user.id } },
        episodeCollections: { where: { userId: req.user.id } },
        episodeWatchHistory: { where: { userId: req.user.id } }
      }
    });

    const isCollected = media ? media.collections.length > 0 : false;
    const collectedEpisodes = media ? media.episodeCollections.map(e => ({ season: e.season, episode: e.episode })) : [];
    const watchedEpisodes = media ? media.episodeWatchHistory.map(e => ({ season: e.season, episode: e.episode })) : [];

    res.json({
      ...tmdbData,
      poster_path: media?.posterPath || tmdbData.poster_path,
      backdrop_path: media?.backdropPath || tmdbData.backdrop_path,
      cast: creditsData.cast?.slice(0, 30) || [],
      videos: videosData.results || [],
      external_ids: externalIdsData || {},
      isCollected,
      collectedEpisodes,
      watchedEpisodes,
      localId: media?.id
    });
  } catch (error) {
    console.error('Failed to fetch TV details:', error.message);
    res.status(500).json({ error: 'Failed to fetch TV details' });
  }
});

// GET movie details
router.get('/movie/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;
  const parsedId = parseInt(tmdbId);

  try {
    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    if (!systemSettings || !systemSettings.tmdbApiKey) {
      return res.status(400).json({ error: 'TMDB API Key is not configured' });
    }

    const [tmdbData, creditsData, videosData] = await Promise.all([
      fetchTMDB(`/3/movie/${parsedId}`, systemSettings.tmdbApiKey),
      fetchTMDB(`/3/movie/${parsedId}/credits`, systemSettings.tmdbApiKey),
      fetchTMDB(`/3/movie/${parsedId}/videos`, systemSettings.tmdbApiKey).catch(() => ({ results: [] }))
    ]);

    const media = await prisma.media.findFirst({
      where: { tmdbId: parsedId, type: 'movie' },
      include: {
        collections: { where: { userId: req.user.id } },
        watchHistory: { where: { userId: req.user.id } }
      }
    });

    const isCollected = media ? media.collections.length > 0 : false;
    const isWatched = media ? media.watchHistory.length > 0 : false;

    res.json({
      ...tmdbData,
      poster_path: media?.posterPath || tmdbData.poster_path,
      backdrop_path: media?.backdropPath || tmdbData.backdrop_path,
      cast: creditsData.cast?.slice(0, 30) || [],
      videos: videosData.results || [],
      isCollected,
      isWatched,
      localId: media?.id
    });
  } catch (error) {
    console.error('Failed to fetch movie details:', error.message);
    res.status(500).json({ error: 'Failed to fetch movie details' });
  }
});

// GET TV season details (proxy season episodes merged with local watched/collected episode state)
router.get('/tv/:tmdbId/season/:seasonNumber', async (req, res) => {
  const { tmdbId, seasonNumber } = req.params;
  const parsedId = parseInt(tmdbId);
  const parsedSeason = parseInt(seasonNumber);

  try {
    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    if (!systemSettings || !systemSettings.tmdbApiKey) {
      return res.status(400).json({ error: 'TMDB API Key is not configured' });
    }

    const tmdbData = await fetchTMDB(`/3/tv/${parsedId}/season/${parsedSeason}`, systemSettings.tmdbApiKey);

    const media = await prisma.media.findFirst({
      where: { tmdbId: parsedId, type: 'tv' },
      include: {
        episodeCollections: { where: { userId: req.user.id, season: parsedSeason } },
        episodeWatchHistory: { where: { userId: req.user.id, season: parsedSeason } }
      }
    });

    const collectedEpisodes = media ? media.episodeCollections.map(e => e.episode) : [];
    const watchedEpisodes = media ? media.episodeWatchHistory.map(e => e.episode) : [];

    // Fetch origin_country from TV Show cache to calculate accurate local airtimes
    const tvCacheKey = `/3/tv/${parsedId}`;
    const tvCache = await prisma.tMDBCache.findUnique({
      where: { key: tvCacheKey }
    });
    const originCountries = tvCache?.data?.origin_country || [];

    const episodes = tmdbData.episodes.map(ep => {
      const airDateTime = getAiringDateTime(ep.air_date, originCountries, parsedId);
      return {
        ...ep,
        airDateTime,
        isCollected: collectedEpisodes.includes(ep.episode_number),
        isWatched: watchedEpisodes.includes(ep.episode_number)
      };
    });

    res.json({
      ...tmdbData,
      episodes
    });
  } catch (error) {
    console.error('Failed to fetch season details:', error.message);
    res.status(500).json({ error: 'Failed to fetch season details' });
  }
});

// GET TV episode details (merged with local watched/collected episode state and files)
router.get('/tv/:tmdbId/season/:seasonNumber/episode/:episodeNumber', async (req, res) => {
  const { tmdbId, seasonNumber, episodeNumber } = req.params;
  const parsedId = parseInt(tmdbId);
  const parsedSeason = parseInt(seasonNumber);
  const parsedEpisode = parseInt(episodeNumber);

  try {
    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    if (!systemSettings || !systemSettings.tmdbApiKey) {
      return res.status(400).json({ error: 'TMDB API Key is not configured' });
    }

    const tmdbData = await fetchTMDB(`/3/tv/${parsedId}/season/${parsedSeason}/episode/${parsedEpisode}`, systemSettings.tmdbApiKey, {
      append_to_response: 'credits,images'
    });

    const media = await prisma.media.findFirst({
      where: { tmdbId: parsedId, type: 'tv' },
      include: {
        episodeCollections: { where: { userId: req.user.id, season: parsedSeason, episode: parsedEpisode } },
        episodeWatchHistory: { where: { userId: req.user.id, season: parsedSeason, episode: parsedEpisode } },
        localFiles: { where: { season: parsedSeason, episode: parsedEpisode } }
      }
    });

    const isCollected = media ? media.episodeCollections.length > 0 : false;
    const isWatched = media ? media.episodeWatchHistory.length > 0 : false;
    
    // Check if any file exists on disk
    let localFile = null;
    if (media && media.localFiles.length > 0) {
      const fs = require('fs');
      const validFiles = media.localFiles.filter(f => fs.existsSync(f.path));
      if (validFiles.length > 0) {
        localFile = validFiles[0];
      }
    }

    // Fetch origin_country from TV Show cache to calculate accurate local airtimes
    const tvCacheKey = `/3/tv/${parsedId}`;
    const tvCache = await prisma.tMDBCache.findUnique({
      where: { key: tvCacheKey }
    });
    const originCountries = tvCache?.data?.origin_country || [];
    const airDateTime = getAiringDateTime(tmdbData.air_date, originCountries, parsedId);

    res.json({
      ...tmdbData,
      airDateTime,
      isCollected,
      isWatched,
      localFile
    });
  } catch (error) {
    console.error('Failed to fetch episode details:', error.message);
    res.status(500).json({ error: 'Failed to fetch episode details' });
  }
});

// Toggle episode watch status
router.post('/episode/watch', async (req, res) => {
  const { tmdbId, season, episode, watched, title, posterPath, watchedAt } = req.body;
  if (!tmdbId || season === undefined || episode === undefined) {
    return res.status(400).json({ error: 'Missing required episode fields' });
  }

  try {
    const media = await getOrCreateMediaRecord({ tmdbId, type: 'tv', title, posterPath });
    const systemSettings = await prisma.systemSettings.findFirst();

    if (watched) {
      const watchDate = watchedAt ? new Date(watchedAt) : new Date();
      const history = await prisma.episodeWatchHistory.upsert({
        where: { userId_mediaId_season_episode: { userId: req.user.id, mediaId: media.id, season, episode } },
        update: { watchedAt: watchDate },
        create: { userId: req.user.id, mediaId: media.id, season, episode, watchedAt: watchDate }
      });
      const runtime = await resolveDuration({
        tmdbId: media.tmdbId,
        type: 'tv',
        season,
        episode,
        apiKey: systemSettings?.tmdbApiKey
      });
      const durationSec = runtime * 60;
      await prisma.watchHistoryLog.create({
        data: {
          userId: req.user.id,
          mediaId: media.id,
          type: 'tv',
          season,
          episode,
          watchedAt: watchDate,
          isCompleted: true,
          duration: durationSec,
          viewOffset: durationSec
        }
      });
      if (systemSettings?.tmdbApiKey) {
        await syncShowWatchHistory(media.id, media.tmdbId, systemSettings.tmdbApiKey, req.user.id);
      }
      res.json({ success: true, history });
    } else {
      await prisma.episodeWatchHistory.deleteMany({
        where: { userId: req.user.id, mediaId: media.id, season, episode }
      });
      await prisma.watchHistoryLog.deleteMany({
        where: { userId: req.user.id, mediaId: media.id, season, episode }
      });
      if (systemSettings?.tmdbApiKey) {
        await syncShowWatchHistory(media.id, media.tmdbId, systemSettings.tmdbApiKey, req.user.id);
      }
      res.json({ success: true, removed: true });
    }
  } catch (error) {
    console.error('Failed to toggle episode watch:', error);
    res.status(500).json({ error: 'Failed to toggle episode watch status' });
  }
});

// Toggle episode collect status
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
      res.json(collection);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to collect media' });
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
        apiKey: systemSettings?.tmdbApiKey
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
router.post('/force-remove', async (req, res) => {
  const { tmdbId, type } = req.body;
  if (!tmdbId || !type) {
    return res.status(400).json({ error: 'Missing tmdbId or type' });
  }

  try {
    const parsedId = parseInt(tmdbId, 10);
    const media = await prisma.media.findFirst({
      where: { tmdbId: parsedId, type }
    });

    if (!media) {
      return res.status(404).json({ error: 'Media record not found in database.' });
    }

    // Explicitly delete collections, watch histories, list items, episode watch history, episode collections, local files, and watch history logs to be database-agnostic
    await prisma.collection.deleteMany({ where: { mediaId: media.id } });
    await prisma.watchHistory.deleteMany({ where: { mediaId: media.id } });
    await prisma.watchHistoryLog.deleteMany({ where: { mediaId: media.id } });
    await prisma.listItem.deleteMany({ where: { mediaId: media.id } });
    await prisma.episodeCollection.deleteMany({ where: { mediaId: media.id } });
    await prisma.episodeWatchHistory.deleteMany({ where: { mediaId: media.id } });
    await prisma.localFile.deleteMany({ where: { mediaId: media.id } });

    // Now delete the Media record
    await prisma.media.delete({ where: { id: media.id } });

    res.json({ success: true, message: 'Media record permanently deleted from database.' });
  } catch (error) {
    console.error('Failed to force remove media:', error);
    res.status(500).json({ error: `Failed to force remove media: ${error.message}` });
  }
});

const activeTimeouts = {};

// POST start active session
router.post('/active-session', async (req, res) => {
  const { tmdbId, type, title, overview, releaseDate, posterPath, season, episode, grandparentTitle, parentTitle } = req.body;
  if (!tmdbId || !type || !title) {
    return res.status(400).json({ error: 'Missing required media fields' });
  }

  try {
    const systemSettings = await prisma.systemSettings.findFirst();
    const runtime = await resolveDuration({
      tmdbId: parseInt(tmdbId),
      type: type === 'episode' ? 'tv' : type,
      season: type === 'episode' ? parseInt(season) : undefined,
      episode: type === 'episode' ? parseInt(episode) : undefined,
      apiKey: systemSettings?.tmdbApiKey
    });
    const durationSec = (runtime || (type === 'episode' ? 45 : 120)) * 60;
    const durationMs = durationSec * 1000;

    const session = {
      title,
      type: type === 'episode' ? 'episode' : 'movie',
      grandparentTitle: type === 'episode' ? grandparentTitle : null,
      parentTitle: type === 'episode' ? parentTitle : null,
      season: type === 'episode' ? parseInt(season) : null,
      episode: type === 'episode' ? parseInt(episode) : null,
      viewOffset: 0,
      duration: durationMs,
      updatedAt: Date.now(),
      isPlaying: true,
      isManual: true,
      ratingKey: `manual-${type}-${tmdbId}`,
      posterPath,
      tmdbId: parseInt(tmdbId)
    };

    const plexStore = require('../utils/plexStore');
    plexStore.setActiveSession(req.user.id, session);

    // Cancel existing timeout if any
    if (activeTimeouts[req.user.id]) {
      clearTimeout(activeTimeouts[req.user.id]);
      delete activeTimeouts[req.user.id];
    }

    // Start a timeout to auto-complete the watch history log
    activeTimeouts[req.user.id] = setTimeout(async () => {
      try {
        console.log(`[Manual Watch] Completing watch for ${title} for User: ${req.user.username}`);
        const media = await getOrCreateMediaRecord({ tmdbId: parseInt(tmdbId), type: type === 'episode' ? 'tv' : 'movie', title: grandparentTitle || title, posterPath, overview, releaseDate });

        if (type === 'episode') {
          await prisma.episodeWatchHistory.upsert({
            where: { userId_mediaId_season_episode: { userId: req.user.id, mediaId: media.id, season: parseInt(season), episode: parseInt(episode) } },
            update: { watchedAt: new Date() },
            create: { userId: req.user.id, mediaId: media.id, season: parseInt(season), episode: parseInt(episode), watchedAt: new Date() }
          });
          await prisma.watchHistoryLog.create({
            data: {
              userId: req.user.id,
              mediaId: media.id,
              type: 'tv',
              season: parseInt(season),
              episode: parseInt(episode),
              watchedAt: new Date(),
              isCompleted: true,
              duration: durationSec,
              viewOffset: durationSec
            }
          });
          if (systemSettings?.tmdbApiKey) {
            await syncShowWatchHistory(media.id, media.tmdbId, systemSettings.tmdbApiKey, req.user.id);
          }
        } else {
          await prisma.watchHistory.create({
            data: { userId: req.user.id, mediaId: media.id, watchedAt: new Date() }
          });
          await prisma.watchHistoryLog.create({
            data: {
              userId: req.user.id,
              mediaId: media.id,
              type: 'movie',
              watchedAt: new Date(),
              isCompleted: true,
              duration: durationSec,
              viewOffset: durationSec
            }
          });
        }

        plexStore.clearActiveSession(req.user.id);
        const { broadcastToUser } = require('../utils/wsManager');
        broadcastToUser(req.user.id, { type: 'plex-session', session: null });
        delete activeTimeouts[req.user.id];
      } catch (err) {
        console.error('[Manual Watch] Failed to complete manual watch timeout:', err);
      }
    }, durationMs);

    const { broadcastToUser } = require('../utils/wsManager');
    broadcastToUser(req.user.id, { type: 'plex-session', session });

    res.json({ success: true, session });
  } catch (error) {
    console.error('Failed to start active session:', error);
    res.status(500).json({ error: 'Failed to start active session' });
  }
});

// DELETE cancel active session
router.delete('/active-session', (req, res) => {
  try {
    const plexStore = require('../utils/plexStore');
    plexStore.clearActiveSession(req.user.id);

    if (activeTimeouts[req.user.id]) {
      clearTimeout(activeTimeouts[req.user.id]);
      delete activeTimeouts[req.user.id];
    }

    const { broadcastToUser } = require('../utils/wsManager');
    broadcastToUser(req.user.id, { type: 'plex-session', session: null });

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to clear active session:', error);
    res.status(500).json({ error: 'Failed to clear active session' });
  }
});

// GET active Plex playback session
router.get('/plex-session', (req, res) => {
  try {
    const plexStore = require('../utils/plexStore');
    res.json({ session: plexStore.getActiveSession(req.user.id) });
  } catch (error) {
    console.error('Failed to get Plex session:', error);
    res.status(500).json({ error: 'Failed to get Plex session' });
  }
});

// GET raw database details and associated files list
router.get('/raw/:type/:tmdbId', async (req, res) => {
  const { type, tmdbId } = req.params;
  const parsedId = parseInt(tmdbId);
  try {
    const media = await prisma.media.findFirst({
      where: { tmdbId: parsedId, type }
    });
    if (!media) {
      return res.status(404).json({ error: 'Media not found in local database.' });
    }
    const files = await prisma.localFile.findMany({
      where: { mediaId: media.id },
      orderBy: [
        { season: 'asc' },
        { episode: 'asc' },
        { path: 'asc' }
      ]
    });
    res.json({ media, files });
  } catch (error) {
    console.error('Failed to get raw media info:', error);
    res.status(500).json({ error: 'Failed to get raw media info.' });
  }
});

// POST targeted scan for a specific Movie, TV Show, or TV Season
router.post('/scan/:type/:tmdbId', async (req, res) => {
  const { type, tmdbId } = req.params;
  const season = req.query.season ? parseInt(req.query.season, 10) : null;
  const episode = req.query.episode ? parseInt(req.query.episode, 10) : null;
  const parsedId = parseInt(tmdbId, 10);

  try {
    const media = await prisma.media.findFirst({
      where: { tmdbId: parsedId, type }
    });

    if (!media) {
      return res.status(404).json({ error: 'Media not found in local database. Please collect it first.' });
    }

    const result = await scanMediaItem(media.id, { season, episode });

    res.json({
      success: true,
      message: `Scan complete. Found ${result.addedCount} new files.`,
      addedCount: result.addedCount,
      totalProcessed: result.totalProcessed,
      addedFiles: result.addedFiles
    });
  } catch (error) {
    console.error('Targeted media scan failed:', error);
    res.status(500).json({ error: `Failed to scan media: ${error.message}` });
  }
});

// POST correct match for a Movie or TV Show
router.post('/correct', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  const { oldTmdbId, type, newTmdbId, imdbId, title, releaseYear } = req.body;
  if (!oldTmdbId || !type) {
    return res.status(400).json({ error: 'Missing oldTmdbId or type' });
  }

  try {
    const systemSettings = await prisma.systemSettings.findFirst();
    if (!systemSettings || !systemSettings.tmdbApiKey) {
      return res.status(400).json({ error: 'TMDB API Key is not configured' });
    }
    const apiKey = systemSettings.tmdbApiKey;

    let targetTmdbId = newTmdbId ? parseInt(newTmdbId) : null;

    // 1. Resolve IMDb ID if provided
    if (!targetTmdbId && imdbId) {
      const cleanImdbId = imdbId.trim();
      const findRes = await fetchTMDB(`/3/find/${cleanImdbId}`, apiKey, { external_source: 'imdb_id' });
      const results = type === 'movie' ? findRes.movie_results : findRes.tv_results;
      if (results && results.length > 0) {
        targetTmdbId = results[0].id;
      } else {
        return res.status(404).json({ error: `Could not find any ${type === 'movie' ? 'movie' : 'TV show'} matching IMDb ID ${cleanImdbId}` });
      }
    }

    // 2. Resolve Title/Year search if targetTmdbId still not resolved
    if (!targetTmdbId && title) {
      const searchEndpoint = type === 'movie' ? '/3/search/movie' : '/3/search/tv';
      const searchParams = { query: title.trim() };
      if (releaseYear) {
        if (type === 'movie') searchParams.primary_release_year = releaseYear;
        else searchParams.first_air_date_year = releaseYear;
      }
      const searchRes = await fetchTMDB(searchEndpoint, apiKey, searchParams);
      if (searchRes.results && searchRes.results.length > 0) {
        targetTmdbId = searchRes.results[0].id;
      } else {
        return res.status(404).json({ error: `Could not find any ${type === 'movie' ? 'movie' : 'TV show'} matching "${title}"` });
      }
    }

    if (!targetTmdbId) {
      return res.status(400).json({ error: 'Could not resolve a target TMDB ID. Please provide TMDB ID, IMDb ID, or search details.' });
    }

    // 3. Find the old media record
    let oldMedia = await prisma.media.findUnique({
      where: { id: parseInt(oldTmdbId) }
    });
    if (!oldMedia) {
      oldMedia = await prisma.media.findFirst({
        where: { tmdbId: parseInt(oldTmdbId), type }
      });
    }
    if (!oldMedia) {
      return res.status(404).json({ error: 'Original media record not found in database.' });
    }

    // 4. Fetch the target media metadata from TMDB
    const detailsEndpoint = type === 'movie' ? `/3/movie/${targetTmdbId}` : `/3/tv/${targetTmdbId}`;
    const details = await fetchTMDB(detailsEndpoint, apiKey);
    if (!details) {
      return res.status(404).json({ error: `Failed to fetch metadata from TMDB for target ID ${targetTmdbId}` });
    }

    const newTitle = details.title || details.name;
    const newOverview = details.overview || '';
    const newReleaseDate = details.release_date || details.first_air_date ? new Date(details.release_date || details.first_air_date) : null;
    const newPosterPath = details.poster_path || null;

    // Check if a Media record with the new TMDB ID already exists
    let newMedia = await prisma.media.findFirst({
      where: { tmdbId: targetTmdbId, type }
    });

    if (newMedia) {
      const localFiles = await prisma.localFile.findMany({ where: { mediaId: oldMedia.id } });
      const validIds = [];
      for (const f of localFiles) {
        if (!fs.existsSync(f.path)) {
          console.log(`[Correct] File no longer exists on disk, skipping and deleting record: ${f.path}`);
          await prisma.localFile.delete({ where: { id: f.id } });
        } else {
          validIds.push(f.id);
        }
      }

      if (newMedia.id === oldMedia.id) {
        if (validIds.length > 0) {
          await prisma.localFile.updateMany({
            where: { id: { in: validIds } },
            data: { manuallyCorrected: true }
          });
        }
        return res.json({ success: true, message: 'Media match confirmed and all files marked as corrected.', media: newMedia });
      }

      // Merge: move oldMedia's LocalFiles to newMedia
      if (validIds.length > 0) {
        await prisma.localFile.updateMany({
          where: { id: { in: validIds } },
          data: { mediaId: newMedia.id, manuallyCorrected: true }
        });
      }

      // Move Collections
      const oldColls = await prisma.collection.findMany({ where: { mediaId: oldMedia.id } });
      for (const oldColl of oldColls) {
        const newColl = await prisma.collection.findFirst({
          where: { userId: oldColl.userId, mediaId: newMedia.id }
        });
        if (!newColl) {
          await prisma.collection.create({
            data: { userId: oldColl.userId, mediaId: newMedia.id, collectedAt: oldColl.collectedAt }
          });
        }
      }
      await prisma.collection.deleteMany({ where: { mediaId: oldMedia.id } });

      // Move WatchHistory
      const oldWatchHistories = await prisma.watchHistory.findMany({ where: { mediaId: oldMedia.id } });
      for (const wh of oldWatchHistories) {
        const exists = await prisma.watchHistory.findFirst({
          where: { userId: wh.userId, mediaId: newMedia.id, watchedAt: wh.watchedAt }
        });
        if (!exists) {
          await prisma.watchHistory.create({
            data: { userId: wh.userId, mediaId: newMedia.id, watchedAt: wh.watchedAt }
          });
        }
      }
      if (oldWatchHistories.length > 0) {
        await prisma.watchHistory.deleteMany({ where: { mediaId: oldMedia.id } });
      }

      // Move Custom List Items
      const oldListItems = await prisma.listItem.findMany({ where: { mediaId: oldMedia.id } });
      for (const li of oldListItems) {
        const existsInNew = await prisma.listItem.findUnique({
          where: { listId_mediaId: { listId: li.listId, mediaId: newMedia.id } }
        });
        if (!existsInNew) {
          await prisma.listItem.update({
            where: { id: li.id },
            data: { mediaId: newMedia.id }
          });
        } else {
          await prisma.listItem.delete({
            where: { id: li.id }
          });
        }
      }

      // For TV: move old media's episode collections, watched histories, and watch history logs (deduplicating to avoid constraint violations)
      if (type === 'tv') {
        const oldEpisodeCollections = await prisma.episodeCollection.findMany({ where: { mediaId: oldMedia.id } });
        for (const ec of oldEpisodeCollections) {
          const exists = await prisma.episodeCollection.findUnique({
            where: {
              userId_mediaId_season_episode: {
                userId: ec.userId,
                mediaId: newMedia.id,
                season: ec.season,
                episode: ec.episode
              }
            }
          });
          if (!exists) {
            await prisma.episodeCollection.update({
              where: { id: ec.id },
              data: { mediaId: newMedia.id }
            });
          } else {
            await prisma.episodeCollection.delete({ where: { id: ec.id } });
          }
        }

        const oldEpisodeWatchHistories = await prisma.episodeWatchHistory.findMany({ where: { mediaId: oldMedia.id } });
        for (const ewh of oldEpisodeWatchHistories) {
          const exists = await prisma.episodeWatchHistory.findUnique({
            where: {
              userId_mediaId_season_episode: {
                userId: ewh.userId,
                mediaId: newMedia.id,
                season: ewh.season,
                episode: ewh.episode
              }
            }
          });
          if (!exists) {
            await prisma.episodeWatchHistory.update({
              where: { id: ewh.id },
              data: { mediaId: newMedia.id }
            });
          } else {
            await prisma.episodeWatchHistory.delete({ where: { id: ewh.id } });
          }
        }

        await prisma.watchHistoryLog.updateMany({
          where: { mediaId: oldMedia.id },
          data: { mediaId: newMedia.id }
        });
      } else {
        // For Movie: update old media's watch history logs to point to new media id
        await prisma.watchHistoryLog.updateMany({
          where: { mediaId: oldMedia.id },
          data: { mediaId: newMedia.id }
        });
      }

      // Delete old media record
      await prisma.media.delete({ where: { id: oldMedia.id } });
      
      // Sync watch history for the new show
      if (type === 'tv') {
        await syncShowWatchHistory(newMedia.id, newMedia.tmdbId, apiKey, req.user.id);
      }
      
      await recreateCollectionsFromLocalFiles(newMedia.id, type, 1);
      
      return res.json({ success: true, message: `Successfully matched and merged files into existing show "${newTitle}".`, media: newMedia });
    } else {
      // Update existing record to new TMDB ID and new metadata
      const updatedMedia = await prisma.media.update({
        where: { id: oldMedia.id },
        data: {
          tmdbId: targetTmdbId,
          title: newTitle,
          overview: newOverview,
          releaseDate: newReleaseDate,
          posterPath: newPosterPath
        }
      });
      
      // Mark all files linked to this media as manually corrected
      const localFiles = await prisma.localFile.findMany({ where: { mediaId: oldMedia.id } });
      const validIds = [];
      for (const f of localFiles) {
        if (!fs.existsSync(f.path)) {
          console.log(`[Correct] File no longer exists on disk, skipping and deleting record: ${f.path}`);
          await prisma.localFile.delete({ where: { id: f.id } });
        } else {
          validIds.push(f.id);
        }
      }
      if (validIds.length > 0) {
        await prisma.localFile.updateMany({
          where: { id: { in: validIds } },
          data: { manuallyCorrected: true }
        });
      }

      // Keep existing episode collections, watch history, and logs so they follow the metadata correction

      await recreateCollectionsFromLocalFiles(updatedMedia.id, type, 1);

      return res.json({ success: true, message: `Successfully updated match to "${newTitle}".`, media: updatedMedia });
    }
  } catch (error) {
    console.error('Error during media correction:', error);
    res.status(500).json({ error: `Failed to correct media match: ${error.message}` });
  }
});

// POST correct match for a specific file path (re-linking/separating it from old media to new/different media)
router.post('/correct-file', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  const { fileId, fileIds, filePath, type, newTmdbId, imdbId, title, releaseYear } = req.body;
  if ((fileId === undefined && !filePath && (!fileIds || fileIds.length === 0)) || !type) {
    return res.status(400).json({ error: 'Missing fileId, fileIds, filePath or type' });
  }

  try {
    const systemSettings = await prisma.systemSettings.findFirst();
    if (!systemSettings || !systemSettings.tmdbApiKey) {
      return res.status(400).json({ error: 'TMDB API Key is not configured' });
    }
    const apiKey = systemSettings.tmdbApiKey;

    let targetTmdbId = newTmdbId ? parseInt(newTmdbId) : null;

    // 1. Resolve IMDb ID if provided
    if (!targetTmdbId && imdbId) {
      const cleanImdbId = imdbId.trim();
      const findRes = await fetchTMDB(`/3/find/${cleanImdbId}`, apiKey, { external_source: 'imdb_id' });
      const results = type === 'movie' ? findRes.movie_results : findRes.tv_results;
      if (results && results.length > 0) {
        targetTmdbId = results[0].id;
      } else {
        return res.status(404).json({ error: `Could not find any ${type === 'movie' ? 'movie' : 'TV show'} matching IMDb ID ${cleanImdbId}` });
      }
    }

    // 2. Resolve Title/Year search if targetTmdbId still not resolved
    if (!targetTmdbId && title) {
      const searchEndpoint = type === 'movie' ? '/3/search/movie' : '/3/search/tv';
      const searchParams = { query: title.trim() };
      if (releaseYear) {
        if (type === 'movie') searchParams.primary_release_year = releaseYear;
        else searchParams.first_air_date_year = releaseYear;
      }
      const searchRes = await fetchTMDB(searchEndpoint, apiKey, searchParams);
      if (searchRes.results && searchRes.results.length > 0) {
        targetTmdbId = searchRes.results[0].id;
      } else {
        return res.status(404).json({ error: `Could not find any ${type === 'movie' ? 'movie' : 'TV show'} matching "${title}"` });
      }
    }

    if (!targetTmdbId) {
      return res.status(400).json({ error: 'Could not resolve a target TMDB ID. Please provide TMDB ID, IMDb ID, or search details.' });
    }

    // 3. Find the specific local file records
    let filesToProcess = [];
    if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
      filesToProcess = await prisma.localFile.findMany({
        where: { id: { in: fileIds } },
        include: { media: true }
      });
    } else if (fileId !== undefined) {
      const file = await prisma.localFile.findUnique({
        where: { id: parseInt(fileId) },
        include: { media: true }
      });
      if (file) filesToProcess.push(file);
    } else if (filePath) {
      const file = await prisma.localFile.findUnique({
        where: { path: filePath },
        include: { media: true }
      });
      if (file) filesToProcess.push(file);
    }

    if (filesToProcess.length === 0) {
      return res.status(404).json({ error: 'Local file records not found in database.' });
    }

    // 4. Fetch the target media metadata from TMDB
    const detailsEndpoint = type === 'movie' ? `/3/movie/${targetTmdbId}` : `/3/tv/${targetTmdbId}`;
    const details = await fetchTMDB(detailsEndpoint, apiKey);
    if (!details) {
      return res.status(404).json({ error: `Failed to fetch metadata from TMDB for target ID ${targetTmdbId}` });
    }

    const newTitle = details.title || details.name;
    const newOverview = details.overview || '';
    const newReleaseDate = details.release_date || details.first_air_date ? new Date(details.release_date || details.first_air_date) : null;
    const newPosterPath = details.poster_path || null;

    // 5. Check if a Media record with the new TMDB ID already exists
    let targetMedia = await prisma.media.findFirst({
      where: { tmdbId: targetTmdbId, type }
    });

    if (!targetMedia) {
      targetMedia = await prisma.media.create({
        data: {
          tmdbId: targetTmdbId,
          type,
          title: newTitle,
          overview: newOverview,
          releaseDate: newReleaseDate,
          posterPath: newPosterPath
        }
      });
    }

    const oldMediaIdsTouched = new Set();
    const oldMediaRecordsTouched = [];

    // Process all files
    for (const file of filesToProcess) {
      if (!fs.existsSync(file.path)) {
        console.log(`[Correct File] File no longer exists on disk, skipping and deleting record: ${file.path}`);
        await prisma.localFile.delete({ where: { id: file.id } });
        continue;
      }

      const oldMediaId = file.mediaId;
      const oldMedia = file.media;
      
      if (!oldMediaIdsTouched.has(oldMediaId)) {
        oldMediaIdsTouched.add(oldMediaId);
        oldMediaRecordsTouched.push(oldMedia);
      }

      // Parse the file path using the scanner helper logic to extract season/episode if it is TV
      let season = null;
      let episode = null;
      if (type === 'tv') {
        const filename = file.path.split(/[/\\]/).pop();
        const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
        const normalizedPath = file.path.replace(/\\/g, '/');
        const parts = normalizedPath.split('/');
        
        season = 1;
        episode = 1;
        
        if (parts.length >= 2) {
          const parentFolder = parts[parts.length - 2];
          const seasonMatch = parentFolder.match(/season\s*(\d{1,2})/i);
          if (seasonMatch) {
            season = parseInt(seasonMatch[1], 10);
          }
        }

        const tvMatch1 = nameWithoutExt.match(/s(\d{1,2})e(\d{1,2})/i);
        const tvMatch2 = nameWithoutExt.match(/(\d{1,2})x(\d{1,2})/i);

        if (tvMatch1) {
          season = parseInt(tvMatch1[1], 10);
          episode = parseInt(tvMatch1[2], 10);
        } else if (tvMatch2) {
          season = parseInt(tvMatch2[1], 10);
          episode = parseInt(tvMatch2[2], 10);
        } else {
          const epMatch = nameWithoutExt.match(/(?:ep|episode|e)[. _-]*(\d{1,2})/i);
          if (epMatch) {
            episode = parseInt(epMatch[1], 10);
          } else {
            const numMatch = nameWithoutExt.match(/\b(\d{1,2})\b/);
            if (numMatch) {
              episode = parseInt(numMatch[1], 10);
            }
          }
        }
      }

      // 6. Update the file to point to the target media record
      await prisma.localFile.update({
        where: { id: file.id },
        data: {
          mediaId: targetMedia.id,
          season,
          episode,
          manuallyCorrected: true
        }
      });

      if (type === 'tv' && season !== null && episode !== null) {
        // Migrate specific EpisodeCollection if it exists for admin (userId 1)
        const oldEc = await prisma.episodeCollection.findUnique({
          where: {
            userId_mediaId_season_episode: {
              userId: 1,
              mediaId: oldMediaId,
              season,
              episode
            }
          }
        });
        if (oldEc) {
          const exists = await prisma.episodeCollection.findUnique({
            where: {
              userId_mediaId_season_episode: {
                userId: 1,
                mediaId: targetMedia.id,
                season,
                episode
              }
            }
          });
          if (!exists) {
            await prisma.episodeCollection.update({
              where: { id: oldEc.id },
              data: { mediaId: targetMedia.id }
            });
          } else {
            await prisma.episodeCollection.delete({ where: { id: oldEc.id } });
          }
        }

        // Migrate specific EpisodeWatchHistory if it exists for admin (userId 1)
        const oldEwh = await prisma.episodeWatchHistory.findUnique({
          where: {
            userId_mediaId_season_episode: {
              userId: 1,
              mediaId: oldMediaId,
              season,
              episode
            }
          }
        });
        if (oldEwh) {
          const exists = await prisma.episodeWatchHistory.findUnique({
            where: {
              userId_mediaId_season_episode: {
                userId: 1,
                mediaId: targetMedia.id,
                season,
                episode
              }
            }
          });
          if (!exists) {
            await prisma.episodeWatchHistory.update({
              where: { id: oldEwh.id },
              data: { mediaId: targetMedia.id }
            });
          } else {
            await prisma.episodeWatchHistory.delete({ where: { id: oldEwh.id } });
          }
        }

        // Migrate WatchHistoryLogs for this episode
        await prisma.watchHistoryLog.updateMany({
          where: {
            mediaId: oldMediaId,
            type: 'tv',
            season,
            episode
          },
          data: {
            mediaId: targetMedia.id
          }
        });
      }
    }

    // 7. Update collection statuses for both old and target media
    await recreateCollectionsFromLocalFiles(targetMedia.id, type, 1);
    if (type === 'tv') {
      await syncShowWatchHistory(targetMedia.id, targetMedia.tmdbId, apiKey, req.user.id);
    }

    for (const oldMedia of oldMediaRecordsTouched) {
      await recreateCollectionsFromLocalFiles(oldMedia.id, oldMedia.type, 1);
      if (oldMedia.type === 'tv') {
        await syncShowWatchHistory(oldMedia.id, oldMedia.tmdbId, apiKey, req.user.id);
      }

      // 8. Auto-cleanup: if old media has no local files left
      const remainingFiles = await prisma.localFile.count({ where: { mediaId: oldMedia.id } });
      if (remainingFiles === 0) {
        // Remove from collection
        await prisma.episodeCollection.deleteMany({ where: { mediaId: oldMedia.id } });
        await prisma.collection.deleteMany({ where: { mediaId: oldMedia.id } });

        // Delete media entirely if there is no watch history
        const remainingLogs = await prisma.watchHistoryLog.count({ where: { mediaId: oldMedia.id } });
        if (remainingLogs === 0) {
          await prisma.media.delete({ where: { id: oldMedia.id } });
          console.log(`[Correct File] Cleaned up empty orphaned media ID: ${oldMedia.id}`);
        }
      }
    }

    res.json({ success: true, message: `Successfully re-matched ${filesToProcess.length} file(s) to "${newTitle}".`, media: targetMedia });
  } catch (error) {
    console.error('Error during file correction:', error);
    res.status(500).json({ error: `Failed to correct file match: ${error.message}` });
  }
});

// GET complete watch history
router.get('/watch-history', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const type = req.query.type || 'all'; // 'all', 'movie', 'tv', 'episode'
    const includePartial = req.query.includePartial === true || req.query.includePartial === 'true';
    const search = req.query.search || '';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';
    const genre = req.query.genre || '';

    const skip = (page - 1) * limit;

    let targetUserId = req.user.id;
    if (req.user.role === 'admin' && req.query.userId && req.query.userId !== 'undefined' && req.query.userId !== 'null') {
      const parsedId = parseInt(req.query.userId, 10);
      if (!isNaN(parsedId) && parsedId > 0) {
        targetUserId = parsedId;
      }
    }
    const where = { userId: targetUserId };
    const mappedType = type === 'episode' ? 'tv' : type;
    if (mappedType !== 'all') {
      where.type = mappedType;
    }
    if (!includePartial) {
      where.isCompleted = true;
    }

    if (req.query.tmdbId && req.query.type) {
      const targetType = req.query.type === 'episode' ? 'tv' : req.query.type;
      const media = await prisma.media.findFirst({
        where: { tmdbId: parseInt(req.query.tmdbId), type: targetType }
      });
      if (media) {
        where.mediaId = media.id;
      } else {
        return res.json({ logs: [], total: 0 });
      }
    } else if (req.query.mediaId) {
      where.mediaId = parseInt(req.query.mediaId);
    }

    if (req.query.season) {
      where.season = parseInt(req.query.season);
    }
    if (req.query.episode) {
      where.episode = parseInt(req.query.episode);
    }

    if (startDate || endDate) {
      where.watchedAt = {};
      if (startDate) {
        where.watchedAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.watchedAt.lte = end;
      }
    }

    if ((search && !where.mediaId) || genre) {
      where.media = {};
      if (search && !where.mediaId) {
        where.media.title = {
          contains: search,
          mode: 'insensitive'
        };
      }
      if (genre) {
        where.media.genres = {
          contains: genre,
          mode: 'insensitive'
        };
      }
    }

    const [logs, total] = await Promise.all([
      prisma.watchHistoryLog.findMany({
        where,
        include: {
          media: {
            select: {
              title: true,
              posterPath: true,
              tmdbId: true,
              genres: true
            }
          }
        },
        orderBy: { watchedAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.watchHistoryLog.count({ where })
    ]);

    // Extract unique genres from all media for the dropdown
    const mediaWithGenres = await prisma.media.findMany({
      where: {
        genres: { not: null }
      },
      select: { genres: true }
    });

    const uniqueGenresSet = new Set();
    mediaWithGenres.forEach(m => {
      if (m.genres) {
        m.genres.split(',').forEach(g => {
          const clean = g.trim();
          if (clean) uniqueGenresSet.add(clean);
        });
      }
    });
    
    const uniqueGenres = Array.from(uniqueGenresSet).sort();
    
    const allUsers = await prisma.user.findMany({
      select: { id: true, username: true, name: true, avatarPath: true }
    });
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    const enrichedLogs = await Promise.all(logs.map(async (log) => {
      let coViewerIds = [];
      try {
        if (log.watchedWith) {
          coViewerIds = JSON.parse(log.watchedWith);
        } else if (log.watchedAt) {
          const coViewerLogs = await prisma.watchHistoryLog.findMany({
            where: {
              mediaId: log.mediaId,
              type: log.type,
              season: log.season,
              episode: log.episode,
              userId: { not: targetUserId },
              watchedAt: {
                gte: new Date(new Date(log.watchedAt).getTime() - 3 * 60000),
                lte: new Date(new Date(log.watchedAt).getTime() + 3 * 60000)
              }
            },
            select: { userId: true },
            take: 10
          });
          coViewerIds = Array.from(new Set(coViewerLogs.map(l => l.userId).filter(Boolean)));
        }
      } catch (e) {
        console.error('Co-viewer enrichment error for log:', log.id, e.message);
      }

      const watchedWithUsers = coViewerIds
        .map(id => userMap.get(id))
        .filter(Boolean);

      return {
        ...log,
        watchedWithUsers
      };
    }));

    let activeSession = null;
    if (page === 1) {
      const plexStore = require('../utils/plexStore');
      activeSession = plexStore.getActiveSession(targetUserId);
    }

    res.json({
      logs: enrichedLogs,
      genres: uniqueGenres,
      activeSession,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Failed to get watch history logs:', error);
    res.status(500).json({ error: 'Failed to get watch history logs' });
  }
});

// Remove the last watched history entry
router.post('/watch-history/remove-last', async (req, res) => {
  const { tmdbId, type, season, episode } = req.body;
  if (!tmdbId || !type) {
    return res.status(400).json({ error: 'Missing tmdbId or type' });
  }

  try {
    const mediaType = type === 'episode' ? 'tv' : type;
    const media = await prisma.media.findFirst({
      where: { tmdbId: parseInt(tmdbId), type: mediaType }
    });
    if (!media) return res.status(404).json({ error: 'Media not found' });

    const where = {
      userId: req.user.id,
      mediaId: media.id,
      type: mediaType
    };
    if (type === 'episode') {
      where.season = season;
      where.episode = episode;
    }

    const log = await prisma.watchHistoryLog.findFirst({
      where,
      orderBy: { watchedAt: 'desc' }
    });

    if (!log) {
      return res.status(404).json({ error: 'No watch history entry found to remove' });
    }

    // Delete from WatchHistoryLog
    await prisma.watchHistoryLog.delete({ where: { id: log.id } });

    let isWatched = false;

    // Synchronize deletion with old watch history tables
    if (log.type === 'movie') {
      // Find a matching WatchHistory record close to the log's watchedAt
      let match = await prisma.watchHistory.findFirst({
        where: {
          userId: req.user.id,
          mediaId: log.mediaId,
          watchedAt: {
            gte: new Date(log.watchedAt.getTime() - 60000),
            lte: new Date(log.watchedAt.getTime() + 60000)
          }
        }
      });
      if (!match) {
        const allHistories = await prisma.watchHistory.findMany({
          where: { userId: req.user.id, mediaId: log.mediaId }
        });
        if (allHistories.length > 0) {
          allHistories.sort((a, b) => Math.abs(a.watchedAt.getTime() - log.watchedAt.getTime()) - Math.abs(b.watchedAt.getTime() - log.watchedAt.getTime()));
          match = allHistories[0];
        }
      }
      if (match) {
        await prisma.watchHistory.delete({ where: { id: match.id } });
      }

      const remainingWatchCount = await prisma.watchHistory.count({
        where: { userId: req.user.id, mediaId: log.mediaId }
      });
      isWatched = remainingWatchCount > 0;
    } else if (log.type === 'tv') {
      const otherLogs = await prisma.watchHistoryLog.findFirst({
        where: {
          userId: req.user.id,
          mediaId: log.mediaId,
          type: 'tv',
          season: log.season,
          episode: log.episode,
          isCompleted: true
        }
      });
      if (!otherLogs) {
        await prisma.episodeWatchHistory.deleteMany({
          where: {
            userId: req.user.id,
            mediaId: log.mediaId,
            season: log.season,
            episode: log.episode
          }
        });
      } else {
        isWatched = true;
        const latestRemainingLog = await prisma.watchHistoryLog.findFirst({
          where: {
            userId: req.user.id,
            mediaId: log.mediaId,
            type: 'tv',
            season: log.season,
            episode: log.episode,
            isCompleted: true
          },
          orderBy: { watchedAt: 'desc' }
        });
        if (latestRemainingLog) {
          await prisma.episodeWatchHistory.updateMany({
            where: {
              userId: req.user.id,
              mediaId: log.mediaId,
              season: log.season,
              episode: log.episode
            },
            data: { watchedAt: latestRemainingLog.watchedAt }
          });
        }
      }

      const systemSettings = await prisma.systemSettings.findFirst();
      if (systemSettings?.tmdbApiKey) {
        await syncShowWatchHistory(media.id, media.tmdbId, systemSettings.tmdbApiKey, req.user.id);
      }
    }

    res.json({ success: true, isWatched });
  } catch (error) {
    console.error('Failed to remove last watch history entry:', error);
    res.status(500).json({ error: 'Failed to remove last watch history entry' });
  }
});

// DELETE a watch history entry
router.delete('/watch-history/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const log = await prisma.watchHistoryLog.findFirst({
      where: { id, userId: req.user.id }
    });
    if (!log) return res.status(404).json({ error: 'Watch history entry not found' });

    // Delete from WatchHistoryLog first
    await prisma.watchHistoryLog.delete({ where: { id } });

    let isWatched = false;

    // Synchronize deletion with old watch history tables
    if (log.type === 'movie') {
      // Find a matching WatchHistory record close to the log's watchedAt
      let match = await prisma.watchHistory.findFirst({
        where: {
          userId: req.user.id,
          mediaId: log.mediaId,
          watchedAt: {
            gte: new Date(log.watchedAt.getTime() - 60000),
            lte: new Date(log.watchedAt.getTime() + 60000)
          }
        }
      });
      // Fallback: find the one closest in time
      if (!match) {
        const allHistories = await prisma.watchHistory.findMany({
          where: { userId: req.user.id, mediaId: log.mediaId }
        });
        if (allHistories.length > 0) {
          allHistories.sort((a, b) => Math.abs(a.watchedAt.getTime() - log.watchedAt.getTime()) - Math.abs(b.watchedAt.getTime() - log.watchedAt.getTime()));
          match = allHistories[0];
        }
      }
      if (match) {
        await prisma.watchHistory.delete({ where: { id: match.id } });
        console.log(`[Sync Delete] Deleted matching WatchHistory record for movie ID ${log.mediaId}`);
      }

      const remainingWatchCount = await prisma.watchHistory.count({
        where: { userId: req.user.id, mediaId: log.mediaId }
      });
      isWatched = remainingWatchCount > 0;
    } else if (log.type === 'tv' && log.isCompleted) {
      // Check if there are other completed watch logs for this episode
      const otherLogs = await prisma.watchHistoryLog.findFirst({
        where: {
          userId: req.user.id,
          mediaId: log.mediaId,
          type: 'tv',
          season: log.season,
          episode: log.episode,
          isCompleted: true
        }
      });
      // If no other completed watch logs exist, delete from EpisodeWatchHistory
      if (!otherLogs) {
        await prisma.episodeWatchHistory.deleteMany({
          where: {
            userId: req.user.id,
            mediaId: log.mediaId,
            season: log.season,
            episode: log.episode
          }
        });
        console.log(`[Sync Delete] Deleted EpisodeWatchHistory record for S${log.season}E${log.episode} of show ID ${log.mediaId}`);
      } else {
        isWatched = true;
        const latestRemainingLog = await prisma.watchHistoryLog.findFirst({
          where: {
            userId: req.user.id,
            mediaId: log.mediaId,
            type: 'tv',
            season: log.season,
            episode: log.episode,
            isCompleted: true
          },
          orderBy: { watchedAt: 'desc' }
        });
        if (latestRemainingLog) {
          await prisma.episodeWatchHistory.updateMany({
            where: {
              userId: req.user.id,
              mediaId: log.mediaId,
              season: log.season,
              episode: log.episode
            },
            data: { watchedAt: latestRemainingLog.watchedAt }
          });
        }
      }

      const mediaRecord = await prisma.media.findUnique({ where: { id: log.mediaId } });
      const systemSettings = await prisma.systemSettings.findFirst();
      if (mediaRecord && systemSettings?.tmdbApiKey) {
        await syncShowWatchHistory(mediaRecord.id, mediaRecord.tmdbId, systemSettings.tmdbApiKey, req.user.id);
      }
    }

    res.json({ success: true, isWatched });
  } catch (error) {
    console.error('Failed to delete watch history log:', error);
    res.status(500).json({ error: 'Failed to delete watch history log' });
  }
});

// GET shareable users (all active users except current user)
router.get('/users/shareable', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { id: { not: req.user.id } },
      select: { id: true, username: true, name: true, avatarPath: true }
    });
    res.json({ users });
  } catch (err) {
    console.error('Error fetching shareable users:', err);
    res.status(500).json({ error: 'Failed to fetch shareable users' });
  }
});

// POST Bulk Share watch history entries to target users ("Watched Together")
router.post('/watch-history/share-bulk', async (req, res) => {
  const { logIds, targetUserIds } = req.body;
  if (!Array.isArray(logIds) || !Array.isArray(targetUserIds) || logIds.length === 0 || targetUserIds.length === 0) {
    return res.status(400).json({ error: 'logIds and targetUserIds arrays are required' });
  }

  try {
    const systemSettings = await prisma.systemSettings.findFirst();
    const tmdbApiKey = systemSettings?.tmdbApiKey;

    const logs = await prisma.watchHistoryLog.findMany({
      where: {
        id: { in: logIds },
        ...(req.user.role === 'admin' ? {} : { userId: req.user.id })
      },
      include: { media: true }
    });

    const affectedShows = new Set();

    for (const log of logs) {
      for (const targetUserId of targetUserIds) {
        if (targetUserId === req.user.id) continue;

        const existingLog = await prisma.watchHistoryLog.findFirst({
          where: {
            userId: targetUserId,
            mediaId: log.mediaId,
            type: log.type,
            season: log.season,
            episode: log.episode,
            watchedAt: log.watchedAt
          }
        });

        if (!existingLog) {
          await prisma.watchHistoryLog.create({
            data: {
              mediaId: log.mediaId,
              type: log.type,
              season: log.season,
              episode: log.episode,
              watchedAt: log.watchedAt,
              duration: log.duration,
              viewOffset: log.viewOffset,
              isCompleted: log.isCompleted,
              userId: targetUserId
            }
          });
        }

        if (log.isCompleted) {
          if (log.type === 'movie') {
            const existingMovie = await prisma.watchHistory.findFirst({
              where: { userId: targetUserId, mediaId: log.mediaId }
            });
            if (!existingMovie) {
              await prisma.watchHistory.create({
                data: {
                  mediaId: log.mediaId,
                  userId: targetUserId,
                  watchedAt: log.watchedAt
                }
              });
            }
          } else if (log.type === 'tv' && log.season !== null && log.episode !== null) {
            await prisma.episodeWatchHistory.upsert({
              where: {
                userId_mediaId_season_episode: {
                  userId: targetUserId,
                  mediaId: log.mediaId,
                  season: log.season,
                  episode: log.episode
                }
              },
              update: { watchedAt: log.watchedAt },
              create: {
                userId: targetUserId,
                mediaId: log.mediaId,
                season: log.season,
                episode: log.episode,
                watchedAt: log.watchedAt
              }
            });

            if (tmdbApiKey && log.media?.tmdbId) {
              affectedShows.add(`${targetUserId}:${log.mediaId}:${log.media.tmdbId}`);
            }
          }
        }
      }
    }

    for (const item of affectedShows) {
      const [uId, mId, tmdbId] = item.split(':');
      await syncShowWatchHistory(parseInt(mId, 10), parseInt(tmdbId, 10), tmdbApiKey, parseInt(uId, 10));
    }

    res.json({ message: 'Successfully shared watch entries', count: logs.length });
  } catch (err) {
    console.error('Error sharing watch history:', err);
    res.status(500).json({ error: 'Failed to share watch history entries' });
  }
});

// POST Bulk Unshare watch history entries from target users
router.post('/watch-history/unshare-bulk', async (req, res) => {
  const { logIds, targetUserIds } = req.body;
  if (!Array.isArray(logIds) || !Array.isArray(targetUserIds) || logIds.length === 0 || targetUserIds.length === 0) {
    return res.status(400).json({ error: 'logIds and targetUserIds arrays are required' });
  }

  try {
    const systemSettings = await prisma.systemSettings.findFirst();
    const tmdbApiKey = systemSettings?.tmdbApiKey;

    const logs = await prisma.watchHistoryLog.findMany({
      where: {
        id: { in: logIds },
        ...(req.user.role === 'admin' ? {} : { userId: req.user.id })
      },
      include: { media: true }
    });

    const affectedShows = new Set();

    for (const log of logs) {
      for (const targetUserId of targetUserIds) {
        if (targetUserId === req.user.id) continue;

        await prisma.watchHistoryLog.deleteMany({
          where: {
            userId: targetUserId,
            mediaId: log.mediaId,
            type: log.type,
            season: log.season,
            episode: log.episode
          }
        });

        if (log.type === 'movie') {
          await prisma.watchHistory.deleteMany({
            where: {
              userId: targetUserId,
              mediaId: log.mediaId
            }
          });
        } else if (log.type === 'tv' && log.season !== null && log.episode !== null) {
          await prisma.episodeWatchHistory.deleteMany({
            where: {
              userId: targetUserId,
              mediaId: log.mediaId,
              season: log.season,
              episode: log.episode
            }
          });

          if (tmdbApiKey && log.media?.tmdbId) {
            affectedShows.add(`${targetUserId}:${log.mediaId}:${log.media.tmdbId}`);
          }
        }
      }
    }

    for (const item of affectedShows) {
      const [uId, mId, tmdbId] = item.split(':');
      await syncShowWatchHistory(parseInt(mId, 10), parseInt(tmdbId, 10), tmdbApiKey, parseInt(uId, 10));
    }

    res.json({ message: 'Successfully unshared watch entries', count: logs.length });
  } catch (err) {
    console.error('Error unsharing watch history:', err);
    res.status(500).json({ error: 'Failed to unshare watch history entries' });
  }
});

// POST Bulk Delete watch history entries for current user
router.post('/watch-history/delete-bulk', async (req, res) => {
  const { logIds } = req.body;
  if (!Array.isArray(logIds) || logIds.length === 0) {
    return res.status(400).json({ error: 'logIds array is required' });
  }

  try {
    const systemSettings = await prisma.systemSettings.findFirst();
    const tmdbApiKey = systemSettings?.tmdbApiKey;

    const logs = await prisma.watchHistoryLog.findMany({
      where: {
        id: { in: logIds },
        ...(req.user.role === 'admin' ? {} : { userId: req.user.id })
      },
      include: { media: true }
    });

    const affectedShows = new Set();

    for (const log of logs) {
      await prisma.watchHistoryLog.delete({ where: { id: log.id } });

      if (log.type === 'movie') {
        const remainingLogs = await prisma.watchHistoryLog.count({
          where: { userId: log.userId, mediaId: log.mediaId, type: 'movie', isCompleted: true }
        });
        if (remainingLogs === 0) {
          await prisma.watchHistory.deleteMany({
            where: { userId: log.userId, mediaId: log.mediaId }
          });
        }
      } else if (log.type === 'tv' && log.season !== null && log.episode !== null) {
        const remainingLogs = await prisma.watchHistoryLog.count({
          where: {
            userId: log.userId,
            mediaId: log.mediaId,
            type: 'tv',
            season: log.season,
            episode: log.episode,
            isCompleted: true
          }
        });
        if (remainingLogs === 0) {
          await prisma.episodeWatchHistory.deleteMany({
            where: {
              userId: log.userId,
              mediaId: log.mediaId,
              season: log.season,
              episode: log.episode
            }
          });
        }
        if (tmdbApiKey && log.media?.tmdbId) {
          affectedShows.add(`${log.userId}:${log.mediaId}:${log.media.tmdbId}`);
        }
      }
    }

    for (const item of affectedShows) {
      const [uId, mId, tmdbId] = item.split(':');
      await syncShowWatchHistory(parseInt(mId, 10), parseInt(tmdbId, 10), tmdbApiKey, parseInt(uId, 10));
    }

    res.json({ message: 'Successfully deleted history logs', count: logs.length });
  } catch (err) {
    console.error('Error deleting bulk watch history:', err);
    res.status(500).json({ error: 'Failed to delete watch history logs' });
  }
});

// Get media details (local stats fallback)
router.get('/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;
  const media = await prisma.media.findFirst({
    where: { tmdbId: parseInt(tmdbId) },
    include: {
      collections: { where: { userId: req.user.id } },
      watchHistory: {
        where: { userId: req.user.id },
        orderBy: { watchedAt: 'desc' }
      }
    }
  });
  
  if (!media) return res.json(null);
  res.json(media);
});

async function recreateCollectionsFromLocalFiles(mediaId, type, userId = 1) {
  try {
    const files = await prisma.localFile.findMany({
      where: { mediaId }
    });

    if (files.length === 0) return;

    const allUsers = await prisma.user.findMany({ select: { id: true } });
    for (const u of allUsers) {
      // Ensure the main Collection entry exists
      await prisma.collection.upsert({
        where: { userId_mediaId: { userId: u.id, mediaId } },
        update: {},
        create: { userId: u.id, mediaId }
      });

      if (type === 'tv') {
        for (const file of files) {
          if (file.season !== null && file.episode !== null) {
            const endEp = file.endEpisode || file.episode;
            for (let ep = file.episode; ep <= endEp; ep++) {
              await prisma.episodeCollection.upsert({
                where: {
                  userId_mediaId_season_episode: {
                    userId: u.id,
                    mediaId,
                    season: file.season,
                    episode: ep
                  }
                },
                update: {},
                create: {
                  userId: u.id,
                  mediaId,
                  season: file.season,
                  episode: ep
                }
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to recreate collections:', error);
  }
}

// GET media alternative images
router.get('/:type/:tmdbId/images', async (req, res) => {
  const { type, tmdbId } = req.params;
  const parsedId = parseInt(tmdbId, 10);
  const tmdbType = type === 'movie' ? 'movie' : 'tv';

  try {
    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    if (!systemSettings || !systemSettings.tmdbApiKey) {
      return res.status(400).json({ error: 'TMDB API Key is not configured' });
    }

    const images = await fetchTMDB(`/3/${tmdbType}/${parsedId}/images`, systemSettings.tmdbApiKey);
    res.json(images);
  } catch (error) {
    console.error('Failed to fetch media images:', error.message);
    res.status(500).json({ error: 'Failed to fetch media images' });
  }
});

// PUT update media custom poster or backdrop
router.put('/:type/:tmdbId/images', async (req, res) => {
  const { type, tmdbId } = req.params;
  const parsedId = parseInt(tmdbId, 10);
  const { posterPath, backdropPath } = req.body;

  try {
    let media = await prisma.media.findFirst({
      where: { tmdbId: parsedId, type }
    });

    if (!media) {
      const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
      const tmdbApiKey = systemSettings?.tmdbApiKey;
      let title = `${type} #${parsedId}`;
      let overview = '';
      let releaseDate = null;
      let originalPoster = null;

      if (tmdbApiKey) {
        try {
          const data = await fetchTMDB(`/3/${type}/${parsedId}`, tmdbApiKey);
          title = data.title || data.name || title;
          overview = data.overview || '';
          releaseDate = data.release_date || data.first_air_date || null;
          originalPoster = data.poster_path || null;
        } catch (err) {
          console.error('Failed to fetch TMDB data for image update:', err.message);
        }
      }

      media = await prisma.media.create({
        data: {
          tmdbId: parsedId,
          type,
          title,
          overview,
          releaseDate: releaseDate ? new Date(releaseDate) : null,
          posterPath: originalPoster
        }
      });
    }

    const updateData = {};
    if (posterPath !== undefined) updateData.posterPath = posterPath;
    if (backdropPath !== undefined) updateData.backdropPath = backdropPath;

    const updatedMedia = await prisma.media.update({
      where: { id: media.id },
      data: updateData
    });

    res.json({ success: true, media: updatedMedia });
  } catch (error) {
    console.error('Failed to update media images:', error.message);
    res.status(500).json({ error: 'Failed to update media images' });
  }
});

// GET /api/media/person/:personId
router.get('/person/:personId', async (req, res) => {
  const { personId } = req.params;
  const parsedPersonId = parseInt(personId, 10);

  try {
    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    if (!systemSettings || !systemSettings.tmdbApiKey) {
      return res.status(400).json({ error: 'TMDB API Key is not configured' });
    }

    const apiKey = systemSettings.tmdbApiKey;
    const [personData, creditsData] = await Promise.all([
      fetchTMDB(`/3/person/${parsedPersonId}`, apiKey),
      fetchTMDB(`/3/person/${parsedPersonId}/combined_credits`, apiKey)
    ]);

    // Find other media in local collection that this person stars in
    let collectedMedia = [];
    if (creditsData.cast && Array.isArray(creditsData.cast)) {
      const tmdbIds = creditsData.cast.map(c => c.id);
      
      // Deduplicate TMDB IDs to keep database query efficient
      const uniqueTmdbIds = Array.from(new Set(tmdbIds));

      collectedMedia = await prisma.media.findMany({
        where: {
          tmdbId: { in: uniqueTmdbIds },
          OR: [
            { collections: { some: { userId: req.user.id } } },
            { episodeCollections: { some: { userId: req.user.id } } }
          ]
        }
      });
    }

    res.json({
      person: personData,
      credits: creditsData,
      collectedMedia
    });
  } catch (error) {
    console.error('Failed to fetch person details:', error.message);
    res.status(500).json({ error: 'Failed to fetch person details' });
  }
});

// --- Missing Episodes Management ---
router.post('/missing-episodes/ignore', async (req, res) => {
  const { mediaId, season, episode } = req.body;
  if (!mediaId || season === undefined || episode === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const existing = await prisma.ignoredMissingEpisode.findFirst({
      where: { userId: req.user.id, mediaId, season, episode }
    });
    
    if (!existing) {
      await prisma.ignoredMissingEpisode.create({
        data: {
          userId: req.user.id,
          mediaId,
          season,
          episode
        }
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to ignore missing episode:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/missing-episodes/unignore', async (req, res) => {
  const { mediaId, season, episode } = req.body;
  if (!mediaId || season === undefined || episode === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await prisma.ignoredMissingEpisode.deleteMany({
      where: { userId: req.user.id, mediaId, season, episode }
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to unignore missing episode:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
