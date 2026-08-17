const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken } = require('../middleware/auth');
const { getAiringDateTime } = require('../utils/airtime');
const { healMediaRecordIfMissingDetails } = require('../services/mediaService');
const { fetchTMDB } = require('../utils/tmdb');

const router = express.Router();
router.use(authenticateToken);

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
        ],
        hiddenItems: { none: { userId: req.user.id, hideInLibrary: true } }
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
        ],
        hiddenItems: { none: { userId: req.user.id, hideInLibrary: true } }
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

// GET movie details

// GET TV season details (proxy season episodes merged with local watched/collected episode state)

// GET TV episode details (merged with local watched/collected episode state and files)

// Toggle episode watch status
module.exports = router;
