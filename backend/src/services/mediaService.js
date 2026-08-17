const prisma = require('../prismaClient');
const { fetchTMDB } = require('../utils/tmdb');

async function getOrCreateMediaRecord({ tmdbId, type, title, overview, releaseDate, posterPath }) {
  if (!tmdbId) {
    throw new Error('tmdbId is required to get or create media record');
  }
  const parsedId = parseInt(tmdbId);
  
  let media = await prisma.media.findFirst({ where: { tmdbId: parsedId, type } });
  if (media) {
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

async function syncShowWatchHistory(mediaId, tmdbId, tmdbApiKey, userId) {
  if (!tmdbApiKey || !userId) return;
  try {
    const tmdbRes = await fetchTMDB(`/3/tv/${tmdbId}`, tmdbApiKey);
    const totalEpisodes = tmdbRes.number_of_episodes || 0;
    if (totalEpisodes === 0) return;

    const watchedEpisodesCount = await prisma.episodeWatchHistory.count({
      where: { userId, mediaId }
    });

    if (watchedEpisodesCount === totalEpisodes) {
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
      await prisma.watchHistory.deleteMany({
        where: { userId, mediaId }
      });
    }
  } catch (err) {
    console.error(`Failed to sync show watch history for mediaId ${mediaId}:`, err.message);
  }
}

async function enrichMediaItems(results, userId) {
  if (!results || results.length === 0) return [];
  const tmdbIds = results.map(item => item.id).filter(id => id !== undefined && id !== null);
  const localMediaList = await prisma.media.findMany({
    where: { tmdbId: { in: tmdbIds } },
    include: {
      collections: { where: { userId } },
      watchHistory: { where: { userId } },
      episodeWatchHistory: { where: { userId } },
      requests: { where: { userId, status: { in: ['pending', 'confirmed'] } } }
    }
  });
  
  const localMediaMap = {};
  for (const media of localMediaList) {
    localMediaMap[media.tmdbId] = {
      isCollected: media.collections.length > 0,
      isWatched: media.watchHistory.length > 0,
      isRequested: media.requests && media.requests.length > 0,
      localId: media.id
    };
  }
  
  return results.map(item => {
    const local = localMediaMap[item.id] || { isCollected: false, isWatched: false, isRequested: false, localId: null };
    return {
      ...item,
      isCollected: local.isCollected,
      isWatched: local.isWatched,
      isRequested: local.isRequested,
      localId: local.localId
    };
  });
}

module.exports = {
  getOrCreateMediaRecord,
  healMediaRecordIfMissingDetails,
  syncShowWatchHistory,
  enrichMediaItems
};
