const prisma = require('../prismaClient');
const { fetchTMDB } = require('./tmdb');

async function seedWatchHistoryLogs() {
  try {
    const currentCount = await prisma.watchHistoryLog.count();
    const totalOldCount = (await prisma.watchHistory.count()) + (await prisma.episodeWatchHistory.count());

    if (currentCount > 0 && currentCount >= totalOldCount) {
      console.log('[Migration] WatchHistoryLog already has data. Skipping migration.');
      return;
    }

    console.log('[Migration] Migrating existing watch history in bulk...');

    if (currentCount > 0) {
      await prisma.watchHistoryLog.deleteMany();
    }

    // 1. Migrate Movies (WatchHistory)
    const moviesHistory = await prisma.watchHistory.findMany();
    console.log(`[Migration] Found ${moviesHistory.length} movie watch history records.`);
    
    const movieData = moviesHistory.map(record => ({
      mediaId: record.mediaId,
      type: 'movie',
      watchedAt: record.watchedAt,
      duration: 0,
      viewOffset: 0,
      isCompleted: true,
      userId: record.userId || 1
    }));

    if (movieData.length > 0) {
      await prisma.watchHistoryLog.createMany({
        data: movieData
      });
    }

    // 2. Migrate TV Shows (EpisodeWatchHistory)
    const episodesHistory = await prisma.episodeWatchHistory.findMany();
    console.log(`[Migration] Found ${episodesHistory.length} episode watch history records.`);

    const tvData = episodesHistory.map(record => ({
      mediaId: record.mediaId,
      type: 'tv',
      season: record.season,
      episode: record.episode,
      watchedAt: record.watchedAt,
      duration: 0,
      viewOffset: 0,
      isCompleted: true,
      userId: record.userId || 1
    }));

    if (tvData.length > 0) {
      await prisma.watchHistoryLog.createMany({
        data: tvData
      });
    }

    console.log(`[Migration] Completed! Migrated ${movieData.length} movies and ${tvData.length} episodes watch history logs.`);
  } catch (error) {
    console.error('[Migration] Error migrating watch history to logs:', error);
  }
}

async function backfillMediaGenres() {
  try {
    const settings = await prisma.systemSettings.findFirst();
    if (!settings || !settings.tmdbApiKey) {
      console.log('[Backfill Genres] TMDB API Key not found. Skipping genres backfill.');
      return;
    }

    const mediaItems = await prisma.media.findMany({
      where: { genres: null }
    });

    if (mediaItems.length === 0) {
      console.log('[Backfill Genres] All media records have genres populated.');
      return;
    }

    console.log(`[Backfill Genres] Found ${mediaItems.length} media records missing genres. Starting batch backfill...`);

    let successCount = 0;
    const batchSize = 30;

    for (let i = 0; i < mediaItems.length; i += batchSize) {
      const batch = mediaItems.slice(i, i + batchSize);
      await Promise.all(batch.map(async (item) => {
        try {
          const typePath = item.type === 'movie' ? 'movie' : 'tv';
          const details = await fetchTMDB(`/3/${typePath}/${item.tmdbId}`, settings.tmdbApiKey);
          if (details && details.genres) {
            const genresString = details.genres.map(g => g.name).join(', ');
            await prisma.media.update({
              where: { id: item.id },
              data: { genres: genresString }
            });
            successCount++;
          }
        } catch (err) {
          // Silent catch to prevent one bad TMDB lookup from failing the whole batch
        }
      }));
    }
    console.log(`[Backfill Genres] Completed backfill for ${successCount} items.`);
  } catch (error) {
    console.error('[Backfill Genres] Error backfilling genres:', error);
  }
}

async function cleanupDuplicateWatchLogs() {
  try {
    const allLogs = await prisma.watchHistoryLog.findMany({
      where: { isCompleted: true },
      orderBy: [
        { userId: 'asc' },
        { mediaId: 'asc' },
        { type: 'asc' },
        { season: 'asc' },
        { episode: 'asc' },
        { watchedAt: 'asc' }
      ]
    });

    const idsToDelete = [];
    for (let i = 0; i < allLogs.length - 1; i++) {
      const cur = allLogs[i];
      const next = allLogs[i + 1];
      if (
        cur.userId === next.userId &&
        cur.mediaId === next.mediaId &&
        cur.type === next.type &&
        cur.season === next.season &&
        cur.episode === next.episode
      ) {
        const diffMs = Math.abs(new Date(next.watchedAt).getTime() - new Date(cur.watchedAt).getTime());
        if (diffMs < 60000) { // within 60 seconds
          idsToDelete.push(next.id);
          i++; // skip next since it's flagged as duplicate
        }
      }
    }

    if (idsToDelete.length > 0) {
      const res = await prisma.watchHistoryLog.deleteMany({
        where: { id: { in: idsToDelete } }
      });
      console.log(`[Migration] Cleaned up ${res.count} duplicate watch history log entries.`);
    }
  } catch (error) {
    console.error('[Migration] Error cleaning up duplicate watch history logs:', error);
  }
}

module.exports = { seedWatchHistoryLogs, backfillMediaGenres, cleanupDuplicateWatchLogs };
