const prisma = require('../prismaClient');
const { fetchTMDB } = require('./tmdb');

/**
 * Resolves the duration (in minutes) of a movie or TV episode using TMDB caching.
 * @param {object} params
 * @param {number} params.tmdbId - TMDB ID of the media item
 * @param {string} params.type - 'movie' or 'tv'
 * @param {number} [params.season] - Season number (for TV shows)
 * @param {number} [params.episode] - Episode number (for TV shows)
 * @param {string} [params.apiKey] - TMDB API key (optional, needed for live requests)
 * @returns {Promise<number>} Duration in minutes
 */
async function resolveDuration({ tmdbId, type, season, episode, apiKey }) {
  if (!tmdbId) return 0;

  if (type === 'movie') {
    const cacheKey = `/3/movie/${tmdbId}`;
    try {
      // 1. Check database cache
      const cached = await prisma.tMDBCache.findUnique({ where: { key: cacheKey } });
      if (cached && cached.data && typeof cached.data.runtime === 'number') {
        return cached.data.runtime;
      }
      // 2. Fetch fresh from TMDB API
      if (apiKey) {
        const data = await fetchTMDB(cacheKey, apiKey);
        if (data && typeof data.runtime === 'number') {
          return data.runtime;
        }
      }
    } catch (err) {
      console.error(`Error resolving movie runtime for TMDB ID ${tmdbId}:`, err.message);
    }
    return 120; // Movie fallback: 120 minutes
  }

  if (type === 'tv') {
    const s = season || 1;
    const ep = episode || 1;

    // 1. Try episode-level cache first
    const epCacheKey = `/3/tv/${tmdbId}/season/${s}/episode/${ep}`;
    try {
      const cachedEp = await prisma.tMDBCache.findUnique({ where: { key: epCacheKey } });
      if (cachedEp && cachedEp.data && typeof cachedEp.data.runtime === 'number' && cachedEp.data.runtime > 0) {
        return cachedEp.data.runtime;
      }
    } catch (err) {
      console.error(`Error checking episode cache for ${tmdbId} S${s}E${ep}:`, err.message);
    }

    // 2. Try season-level details (cache or fresh TMDB fetch)
    const seasonCacheKey = `/3/tv/${tmdbId}/season/${s}`;
    try {
      let seasonData = null;
      const cachedSeason = await prisma.tMDBCache.findUnique({ where: { key: seasonCacheKey } });
      
      if (cachedSeason) {
        seasonData = cachedSeason.data;
      } else if (apiKey) {
        seasonData = await fetchTMDB(seasonCacheKey, apiKey);
      }

      if (seasonData && Array.isArray(seasonData.episodes)) {
        const matchingEp = seasonData.episodes.find(e => e.episode_number === ep);
        if (matchingEp && typeof matchingEp.runtime === 'number' && matchingEp.runtime > 0) {
          return matchingEp.runtime;
        }
      }
    } catch (err) {
      console.error(`Error checking season cache/fetch for ${tmdbId} S${s}:`, err.message);
    }

    // 3. Try episode-level live fetch as fallback
    if (apiKey) {
      try {
        const data = await fetchTMDB(epCacheKey, apiKey);
        if (data && typeof data.runtime === 'number' && data.runtime > 0) {
          return data.runtime;
        }
      } catch (err) {
        console.error(`Error fetching episode details for ${tmdbId} S${s}E${ep}:`, err.message);
      }
    }

    // 4. Try show-level details fallback (average runtime)
    const showCacheKey = `/3/tv/${tmdbId}`;
    try {
      let showData = null;
      const cachedShow = await prisma.tMDBCache.findUnique({ where: { key: showCacheKey } });
      
      if (cachedShow) {
        showData = cachedShow.data;
      } else if (apiKey) {
        showData = await fetchTMDB(showCacheKey, apiKey);
      }

      if (showData && Array.isArray(showData.episode_run_time) && showData.episode_run_time.length > 0) {
        const sum = showData.episode_run_time.reduce((a, b) => a + b, 0);
        return Math.round(sum / showData.episode_run_time.length);
      }
    } catch (err) {
      console.error(`Error checking show average runtime for ${tmdbId}:`, err.message);
    }

    return 45; // TV episode fallback: 45 minutes
  }

  return 0;
}

module.exports = {
  resolveDuration
};
