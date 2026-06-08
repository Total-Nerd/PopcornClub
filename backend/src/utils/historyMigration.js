const prisma = require('../prismaClient');
const { fetchTMDB } = require('./tmdb');

async function seedWatchHistoryLogs() {
  try {
    let settings = await prisma.settings.findFirst();
    if (settings && settings.hasRunHistoryMigration) {
      console.log('[Migration] WatchHistoryLog migration already completed. Skipping migration.');
      return;
    }

    const currentCount = await prisma.watchHistoryLog.count();
    const totalOldCount = (await prisma.watchHistory.count()) + (await prisma.episodeWatchHistory.count());

    if (currentCount > 0 && currentCount >= totalOldCount) {
      console.log('[Migration] WatchHistoryLog already has data. Skipping migration.');
      if (settings) {
        await prisma.settings.update({
          where: { id: settings.id },
          data: { hasRunHistoryMigration: true }
        });
      }
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
      isCompleted: true
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
      isCompleted: true
    }));

    if (tvData.length > 0) {
      await prisma.watchHistoryLog.createMany({
        data: tvData
      });
    }

    console.log(`[Migration] Completed! Migrated ${movieData.length} movies and ${tvData.length} episodes watch history logs.`);

    // Set flag in settings
    if (!settings) {
      await prisma.settings.create({
        data: { hasRunHistoryMigration: true }
      });
    } else {
      await prisma.settings.update({
        where: { id: settings.id },
        data: { hasRunHistoryMigration: true }
      });
    }
  } catch (error) {
    console.error('[Migration] Error migrating watch history to logs:', error);
  }
}

async function backfillMediaGenres() {
  try {
    const settings = await prisma.settings.findFirst();
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

    console.log(`[Backfill Genres] Completed backfilling genres for ${successCount}/${mediaItems.length} media items.`);
  } catch (error) {
    console.error('[Backfill Genres] Error backfilling media genres:', error);
  }
}

module.exports = { seedWatchHistoryLogs, backfillMediaGenres };
