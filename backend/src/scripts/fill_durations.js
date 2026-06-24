const { PrismaClient } = require('@prisma/client');
const { fetchTMDB } = require('../utils/tmdb');
const { resolveDuration } = require('../utils/durationResolver');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting duration filler script...');
  
  // 1. Get TMDB API Key
  const settings = await prisma.systemSettings.findFirst();
  const apiKey = settings?.tmdbApiKey;
  if (!apiKey) {
    console.log('WARNING: No TMDB API Key found in settings. Relying purely on cached data and fallbacks.');
  }

  // 2. Fetch movie logs with duration = 0, and all TV logs
  console.log('Fetching watch history logs to process...');
  const logs = await prisma.watchHistoryLog.findMany({
    where: {
      OR: [
        { duration: 0 },
        { type: 'tv' }
      ]
    }
  });
  console.log(`Found ${logs.length} logs to check.`);
  if (logs.length === 0) {
    console.log('Nothing to do.');
    process.exit(0);
  }

  // 3. Get all corresponding media records
  const mediaIds = Array.from(new Set(logs.map(l => l.mediaId)));
  console.log(`Fetching ${mediaIds.length} media records...`);
  const mediaRecords = await prisma.media.findMany({
    where: { id: { in: mediaIds } }
  });
  
  const mediaMap = new Map();
  mediaRecords.forEach(m => mediaMap.set(m.id, m));

  // 4. Separate into movies and tv logs
  const movieLogsByMediaId = {};
  const tvLogsByMediaIdAndEp = {};

  logs.forEach(log => {
    const media = mediaMap.get(log.mediaId);
    if (!media) return;

    if (log.type === 'movie') {
      if (!movieLogsByMediaId[log.mediaId]) {
        movieLogsByMediaId[log.mediaId] = [];
      }
      movieLogsByMediaId[log.mediaId].push(log);
    } else if (log.type === 'tv') {
      const s = log.season || 1;
      const e = log.episode || 1;
      const key = `${log.mediaId}-s${s}e${e}`;
      if (!tvLogsByMediaIdAndEp[key]) {
        tvLogsByMediaIdAndEp[key] = [];
      }
      tvLogsByMediaIdAndEp[key].push(log);
    }
  });

  const uniqueMovieIds = Object.keys(movieLogsByMediaId).map(Number);
  const uniqueTvKeys = Object.keys(tvLogsByMediaIdAndEp);

  console.log(`Unique movies to check: ${uniqueMovieIds.length}`);
  console.log(`Unique TV episodes to check: ${uniqueTvKeys.length}`);

  // Helper to wait to avoid rate limit
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // === PROCESS MOVIES ===
  console.log('\n--- Processing Movies ---');
  let movieCount = 0;
  let movieUpdateCount = 0;
  for (const mediaId of uniqueMovieIds) {
    movieCount++;
    const media = mediaMap.get(mediaId);
    const movieLogs = movieLogsByMediaId[mediaId];
    if (!media) continue;

    let runtimeMinutes = null;
    try {
      runtimeMinutes = await resolveDuration({
        tmdbId: media.tmdbId,
        type: 'movie',
        apiKey
      });
    } catch (err) {
      console.error(`Error resolving movie duration for ${media.title} (${media.tmdbId}):`, err.message);
    }

    if (!runtimeMinutes || runtimeMinutes <= 0) {
      runtimeMinutes = 120; // Default fallback
    }

    const durationSec = runtimeMinutes * 60;

    // Update all logs for this movie
    for (const log of movieLogs) {
      const viewOffsetSec = log.isCompleted ? durationSec : Math.round(durationSec * 0.5);
      if (log.duration !== durationSec || log.viewOffset !== viewOffsetSec) {
        await prisma.watchHistoryLog.update({
          where: { id: log.id },
          data: {
            duration: durationSec,
            viewOffset: viewOffsetSec
          }
        });
        movieUpdateCount++;
      }
    }

    if (movieCount % 100 === 0) {
      console.log(`Processed ${movieCount}/${uniqueMovieIds.length} movies.`);
    }
  }
  console.log(`Finished processing movies. Made ${movieUpdateCount} updates.`);

  // === PROCESS TV EPISODES ===
  console.log('\n--- Processing TV Episodes ---');
  let tvUpdateCount = 0;

  // Group TV logs by season key: `${tmdbId}-s${season}`
  const tvLogsBySeasonKey = {};
  uniqueTvKeys.forEach(key => {
    const tvLogs = tvLogsByMediaIdAndEp[key];
    const log = tvLogs[0];
    const media = mediaMap.get(log.mediaId);
    if (!media) return;

    const season = log.season || 1;
    const seasonKey = `${media.tmdbId}-s${season}`;
    if (!tvLogsBySeasonKey[seasonKey]) {
      tvLogsBySeasonKey[seasonKey] = [];
    }
    tvLogsBySeasonKey[seasonKey].push(...tvLogs);
  });

  const uniqueSeasonKeys = Object.keys(tvLogsBySeasonKey);
  console.log(`Unique TV show-season combinations to check: ${uniqueSeasonKeys.length}`);

  let seasonCount = 0;
  for (const seasonKey of uniqueSeasonKeys) {
    seasonCount++;
    const seasonLogs = tvLogsBySeasonKey[seasonKey];
    const firstLog = seasonLogs[0];
    const media = mediaMap.get(firstLog.mediaId);
    if (!media) continue;

    const tmdbId = media.tmdbId;
    const season = firstLog.season || 1;

    // Prefetch and warm cache for this season to minimize TMDB API calls
    const seasonCacheKey = `/3/tv/${tmdbId}/season/${season}`;
    try {
      const cached = await prisma.tMDBCache.findUnique({ where: { key: seasonCacheKey } });
      if (!cached && apiKey) {
        console.log(`[Season ${seasonCount}/${uniqueSeasonKeys.length}] Warming cache for ${media.title} Season ${season} (TMDB ID: ${tmdbId}) from TMDB API...`);
        await fetchTMDB(seasonCacheKey, apiKey);
        await wait(100); // slight throttle
      }
    } catch (err) {
      console.error(`Error warming cache for season ${tmdbId} S${season}:`, err.message);
    }

    // Resolve details for each log within this season
    for (const log of seasonLogs) {
      const episode = log.episode || 1;
      let runtimeMinutes = null;

      try {
        runtimeMinutes = await resolveDuration({
          tmdbId,
          type: 'tv',
          season,
          episode,
          apiKey
        });
      } catch (err) {
        console.error(`Error resolving TV episode runtime for ${media.title} S${season}E${episode}:`, err.message);
      }

      if (!runtimeMinutes || runtimeMinutes <= 0) {
        runtimeMinutes = 45; // Default fallback
      }

      const durationSec = runtimeMinutes * 60;
      const viewOffsetSec = log.isCompleted ? durationSec : Math.round(durationSec * 0.5);

      if (log.duration !== durationSec || log.viewOffset !== viewOffsetSec) {
        await prisma.watchHistoryLog.update({
          where: { id: log.id },
          data: {
            duration: durationSec,
            viewOffset: viewOffsetSec
          }
        });
        tvUpdateCount++;
      }
    }

    if (seasonCount % 50 === 0) {
      console.log(`Processed ${seasonCount}/${uniqueSeasonKeys.length} seasons.`);
    }
  }
  console.log(`Finished processing TV episodes. Made ${tvUpdateCount} updates.`);

  console.log('\nAll watch history durations populated successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error in duration filler script:', err);
  process.exit(1);
});
