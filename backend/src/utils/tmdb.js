const axios = require('axios');
const https = require('https');
const prisma = require('../prismaClient');

const httpsAgent = new https.Agent({ keepAlive: true });

/**
 * Fetch data from TMDB API with database caching.
 * @param {string} endpoint - The TMDB endpoint path (e.g. "/tv/1396", "/movie/157336/credits")
 * @param {string} apiKey - The user's TMDB API key
 * @param {object} params - Optional additional query parameters
 * @param {number} ttlMs - Time-to-live in milliseconds (defaults to 24 hours)
 */
async function fetchTMDB(endpoint, apiKey, params = {}, ttlMs = 24 * 60 * 60 * 1000) {
  if (!apiKey) {
    throw new Error('TMDB API Key is required');
  }

  // Construct a unique cache key based on endpoint and sorted query params
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  const cacheKey = `${endpoint}${sortedParams ? '?' + sortedParams : ''}`;

  try {
    // Check if we have a valid cached version in the database
    const cached = await prisma.tMDBCache.findUnique({ where: { key: cacheKey } });
    if (cached) {
      const age = Date.now() - new Date(cached.updatedAt).getTime();
      if (age < ttlMs) {
        return cached.data;
      }
    }

    // Otherwise, fetch fresh data from TMDB
    const url = `https://api.themoviedb.org${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    const response = await axios.get(url, {
      params: {
        api_key: apiKey,
        ...params
      },
      timeout: 10000, // 10 seconds timeout to prevent hanging requests
      httpsAgent
    });

    const data = response.data;

    // Save/update cache in database
    await prisma.tMDBCache.upsert({
      where: { key: cacheKey },
      update: { data, updatedAt: new Date() },
      create: { key: cacheKey, data, updatedAt: new Date() }
    });

    return data;
  } catch (error) {
    // Fail-safe: if the remote API fails (rate limits, timeouts) but we have stale cache, return it!
    console.error(`TMDB Cache Fetch Error for ${cacheKey}:`, error.message);
    const cached = await prisma.tMDBCache.findUnique({ where: { key: cacheKey } });
    if (cached) {
      console.log(`Falling back to stale cache for ${cacheKey}`);
      return cached.data;
    }
    throw error;
  }
}

function calculateAiredEpisodes(tmdbRes) {
  let airedEpisodes = 0;
  const totalEpisodes = tmdbRes.number_of_episodes || 0;
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

  return airedEpisodes;
}

module.exports = {
  fetchTMDB,
  calculateAiredEpisodes
};
