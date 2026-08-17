const express = require('express');
const axios = require('axios');
const prisma = require('../prismaClient');
const { authenticateToken } = require('../middleware/auth');
const { fetchTMDB } = require('../utils/tmdb');
const { healMediaRecordIfMissingDetails } = require('../services/mediaService');

const { getAiringDateTime } = require('../utils/airtime');


const router = express.Router();

router.use(authenticateToken);

// Simple concurrency-limited Promise mapping helper
async function pMap(array, mapper, concurrency) {
  let index = 0;
  const results = new Array(array.length);
  
  async function worker() {
    while (index < array.length) {
      const current = index++;
      if (current >= array.length) break;
      results[current] = await mapper(array[current]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, array.length) }, worker);
  await Promise.all(workers);
  return results;
}

router.get('/', async (req, res) => {
  // Extract start and end dates (YYYY-MM-DD format)
  // If not provided, default to the start and end of the current month
  let { start, end } = req.query;
  
  if (!start || !end) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed
    
    // Default start: 1st of current month
    const startDate = new Date(year, month, 1);
    // Default end: last day of current month
    const endDate = new Date(year, month + 1, 0);
    
    start = startDate.toISOString().split('T')[0];
    end = endDate.toISOString().split('T')[0];
  }

  const startDateObj = new Date(start + 'T00:00:00Z');
  const endDateObj = new Date(end + 'T00:00:00Z');
  const queryStartObj = new Date(startDateObj.getTime() - 24 * 60 * 60 * 1000);
  const queryEndObj = new Date(endDateObj.getTime() + 24 * 60 * 60 * 1000);
  const queryStart = queryStartObj.toISOString().split('T')[0];
  const queryEnd = queryEndObj.toISOString().split('T')[0];

  try {
    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    if (!systemSettings || !systemSettings.tmdbApiKey) {
      return res.status(400).json({ error: 'TMDB API Key is not configured' });
    }

    // 1. Get all media from database that are either collected or in a list
    const mediaList = await prisma.media.findMany({
      where: {
        OR: [
          { collections: { some: { userId: req.user.id } } },
          { listItems: { some: { list: { userId: req.user.id } } } }
        ],
        hiddenItems: { none: { userId: req.user.id, hideInCalendar: true } }
      },
      include: {
        collections: { where: { userId: req.user.id } },
        watchHistory: { where: { userId: req.user.id } },
        episodeCollections: { where: { userId: req.user.id } },
        episodeWatchHistory: { where: { userId: req.user.id } }
      }
    });

    const events = [];

    // 2. Fetch calendar items for TV shows and Movies with concurrency limit of 3
    await pMap(mediaList, async (media) => {
      media = await healMediaRecordIfMissingDetails(media, systemSettings.tmdbApiKey, req.user.id);
      
      if (media.type === 'movie') {
        // For movies: check if release date is in range
        if (media.releaseDate) {
          const relStr = media.releaseDate.toISOString().split('T')[0];
          if (relStr >= start && relStr <= end) {
            events.push({
              id: `movie-${media.id}`,
              type: 'movie',
              mediaId: media.id,
              tmdbId: media.tmdbId,
              title: media.title,
              posterPath: media.posterPath,
              releaseDate: relStr,
              airDate: relStr, // Unified date field for calendar sorting
              overview: media.overview,
              isCollected: media.collections.length > 0,
              isWatched: media.watchHistory.length > 0
            });
          }
        }
      } else if (media.type === 'tv') {
        // For TV shows: fetch seasons list from TMDB (utilizing cached details)
        try {
          const tmdbShowData = await fetchTMDB(`/3/tv/${media.tmdbId}`, systemSettings.tmdbApiKey);
          const seasons = tmdbShowData.seasons || [];
          const originCountries = tmdbShowData.origin_country || [];
          
          // Identify relevant seasons:
          const relevantSeasons = seasons.filter(s => {
            if (s.season_number === 0) return false; // Skip specials generally
            if (!s.air_date) return true; // Keep if upcoming/unknown
            
            const airYear = new Date(s.air_date).getFullYear();
            const startYear = new Date(start).getFullYear();
            return airYear >= startYear - 3; // Season airing in last 3 years or later
          });

          // Fetch episode lists for seasons sequentially to prevent socket starvation
          for (const s of relevantSeasons) {
            try {
              const tmdbSeasonData = await fetchTMDB(
                `/3/tv/${media.tmdbId}/season/${s.season_number}`,
                systemSettings.tmdbApiKey
              );

              const episodes = tmdbSeasonData.episodes || [];
              
              episodes.forEach(ep => {
                if (ep.air_date && ep.air_date >= queryStart && ep.air_date <= queryEnd) {
                  // Check local watched / collected status
                  const isWatched = media.episodeWatchHistory.some(
                    h => h.season === s.season_number && h.episode === ep.episode_number
                  );
                  const isCollected = media.episodeCollections.some(
                    col => col.season === s.season_number && col.episode === ep.episode_number
                  );

                  const airDateTime = getAiringDateTime(ep.air_date, originCountries, media.tmdbId);

                  events.push({
                    id: `tv-${media.id}-s${s.season_number}e${ep.episode_number}`,
                    type: 'tv',
                    mediaId: media.id,
                    tmdbId: media.tmdbId,
                    showTitle: media.title,
                    showPoster: media.posterPath,
                    seasonNumber: s.season_number,
                    episodeNumber: ep.episode_number,
                    episodeTitle: ep.name,
                    airDate: ep.air_date,
                    airDateTime,
                    overview: ep.overview,
                    isWatched,
                    isCollected
                  });
                }
              });
            } catch (err) {
              console.error(`Failed to fetch season ${s.season_number} for show ${media.tmdbId}:`, err.message);
            }
          }
        } catch (err) {
          console.error(`Failed to fetch TV details for calendar ${media.tmdbId}:`, err.message);
        }
      }
    }, 3);

    // 3. Sort events chronologically by airDateTime or airDate
    events.sort((a, b) => {
      const timeA = a.airDateTime ? new Date(a.airDateTime) : new Date(a.airDate);
      const timeB = b.airDateTime ? new Date(b.airDateTime) : new Date(b.airDate);
      return timeA - timeB;
    });

    res.json(events);
  } catch (error) {
    console.error('Calendar Fetch Error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar data' });
  }
});

module.exports = router;
