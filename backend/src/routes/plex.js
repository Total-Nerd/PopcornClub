const express = require('express');
const multer = require('multer');
const prisma = require('../prismaClient');
const { fetchTMDB } = require('../utils/tmdb');
const plexStore = require('../utils/plexStore');
const { resolveDuration } = require('../utils/durationResolver');

const router = express.Router();
const upload = multer(); // Plex sends multipart/form-data

// Process Plex Webhook payload for a specific User
async function handlePlexWebhook(payload, user, res) {
  if (!user) {
    console.log('[Plex Webhook] No user context provided. Ignoring.');
    return res.sendStatus(200);
  }

  const plexUser = payload.Account?.title;
  if (user.plexUser && user.plexUser !== plexUser) {
    console.log(`Ignoring Plex webhook for user ${plexUser} (Tracked for User ${user.username}: ${user.plexUser})`);
    return res.sendStatus(200);
  }

  // Update last webhook timestamp for user
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { plexLastWebhookAt: new Date() }
    });
  } catch (err) {
    console.error(`Failed to update plexLastWebhookAt for user ${user.id}:`, err.message);
  }

  const eventType = payload.event;
  const metadata = payload.Metadata;
  if (!metadata) {
    return res.sendStatus(200);
  }

  // Get TMDB API Key from SystemSettings
  const systemSettings = await prisma.systemSettings.findFirst();
  const tmdbApiKey = systemSettings?.tmdbApiKey;

  // 1. Manage Active Sessions (Play, Pause, Resume, Stop, Scrobble)
  if (
    eventType === 'media.play' ||
    eventType === 'media.pause' ||
    eventType === 'media.resume' ||
    eventType === 'media.stop' ||
    eventType === 'media.scrobble'
  ) {
    const ratingKey = metadata.ratingKey;

    if (eventType === 'media.stop' || eventType === 'media.scrobble') {
      const current = plexStore.getActiveSession(user.id);
      if (current && current.ratingKey === ratingKey) {
        plexStore.clearActiveSession(user.id);
        console.log(`[Plex Webhook] Playback session cleared for: ${metadata.title} (User: ${user.username})`);
      }
    } else {
      const isPlaying = eventType !== 'media.pause';
      
      // Find matching media to fetch posterPath from our local library
      let posterPath = null;
      let tmdbId = null;
      const mediaTitle = metadata.type === 'episode' ? (metadata.grandparentTitle || metadata.title) : metadata.title;
      
      try {
        const matchedMedia = await prisma.media.findFirst({
          where: {
            title: {
              equals: mediaTitle,
              mode: 'insensitive'
            }
          }
        });
        if (matchedMedia) {
          posterPath = matchedMedia.posterPath;
          tmdbId = matchedMedia.tmdbId;
        } else if (tmdbApiKey) {
          // Uncollected: Query TMDB search to match details dynamically
          const isTV = metadata.type === 'episode';
          const searchEndpoint = isTV ? '/3/search/tv' : '/3/search/movie';
          const searchResults = await fetchTMDB(searchEndpoint, tmdbApiKey, {
            query: mediaTitle
          });
          if (searchResults && searchResults.results && searchResults.results.length > 0) {
            const bestMatch = searchResults.results[0];
            tmdbId = bestMatch.id;
            posterPath = bestMatch.poster_path;
          }
        }
      } catch (err) {
        console.error(`[Plex Webhook - User: ${user.username}] Error matching local media poster or fetching TMDB details:`, err.message);
      }

      const session = {
        title: metadata.title,
        type: metadata.type, // 'movie' or 'episode'
        grandparentTitle: metadata.grandparentTitle || null, // TV Show name
        parentTitle: metadata.parentTitle || null, // Season name
        season: metadata.parentIndex || null,
        episode: metadata.index || null,
        viewOffset: metadata.viewOffset || 0, // offset in ms
        duration: metadata.duration || 0, // total duration in ms
        updatedAt: Date.now(),
        isPlaying,
        user: plexUser,
        ratingKey,
        posterPath,
        tmdbId
      };

      plexStore.setActiveSession(user.id, session);
      console.log(`[Plex Webhook] Active session set: ${metadata.title} (${isPlaying ? 'Playing' : 'Paused'}) for User ${user.username}`);
    }
  }

  // 2. Permanent Db Logging (Scrobble Watch History & Library Additions)
  if (eventType === 'media.scrobble' || eventType === 'media.stop' || eventType === 'library.new') {
    const type = metadata.type; // 'movie' or 'episode'
    const isMovie = type === 'movie';
    const isEpisode = type === 'episode';

    if (isMovie) {
      let tmdbId = null;
      if (metadata.Guid && Array.isArray(metadata.Guid)) {
        const tmdbEntry = metadata.Guid.find(g => g.id && g.id.startsWith('tmdb://'));
        if (tmdbEntry) {
          tmdbId = parseInt(tmdbEntry.id.replace('tmdb://', ''), 10);
        }
      }
      if (!tmdbId && metadata.guid) {
        if (metadata.guid.startsWith('com.plexapp.agents.themoviedb://')) {
          const match = metadata.guid.match(/themoviedb:\/\/(\d+)/);
          if (match) {
            tmdbId = parseInt(match[1], 10);
          }
        } else if (metadata.guid.startsWith('tmdb://')) {
          tmdbId = parseInt(metadata.guid.replace('tmdb://', ''), 10);
        }
      }
      if (!tmdbId) {
        const matchedMedia = await prisma.media.findFirst({
          where: {
            title: {
              equals: metadata.title,
              mode: 'insensitive'
            },
            type: 'movie'
          }
        });
        if (matchedMedia) {
          tmdbId = matchedMedia.tmdbId;
        }
      }
      if (!tmdbId && tmdbApiKey) {
        try {
          const searchResults = await fetchTMDB('/3/search/movie', tmdbApiKey, {
            query: metadata.title
          });
          if (searchResults && searchResults.results && searchResults.results.length > 0) {
            tmdbId = searchResults.results[0].id;
          }
        } catch (err) {
          console.error('[Plex Webhook] Error search-matching TMDB ID:', err.message);
        }
      }
      if (!tmdbId) {
        tmdbId = metadata.ratingKey ? parseInt(metadata.ratingKey) : Math.floor(Math.random() * 1000000);
      }

      let media = await prisma.media.findFirst({ where: { tmdbId, type: 'movie' } });
      if (!media) {
        media = await prisma.media.create({
          data: {
            tmdbId,
            type: 'movie',
            title: metadata.title,
            overview: metadata.summary || '',
            releaseDate: metadata.originallyAvailableAt ? new Date(metadata.originallyAvailableAt) : null,
          }
        });
      }

      if (eventType === 'media.scrobble' || eventType === 'media.stop') {
        const durationMs = metadata.duration || 0;
        const viewOffsetMs = metadata.viewOffset || (eventType === 'media.scrobble' ? durationMs : 0);
        const durationSec = Math.round(durationMs / 1000);
        const viewOffsetSec = Math.round(viewOffsetMs / 1000);
        const isCompleted = eventType === 'media.scrobble' || (durationMs > 0 && viewOffsetMs / durationMs >= 0.90);
        const isPartial = !isCompleted && viewOffsetMs > 10000;

        let shouldLog = true;
        if (eventType === 'media.stop' && isCompleted) {
          const recentLog = await prisma.watchHistoryLog.findFirst({
            where: {
              mediaId: media.id,
              type: 'movie',
              isCompleted: true,
              userId: user.id,
              watchedAt: { gte: new Date(Date.now() - 5 * 60000) }
            }
          });
          if (recentLog) {
            shouldLog = false;
            console.log(`[Plex Webhook] Ignoring duplicate media.stop for Movie ${metadata.title} (User: ${user.username})`);
          }
        }

        if (shouldLog) {
          let finalDurationSec = durationSec;
          if (finalDurationSec <= 0) {
            const runtime = await resolveDuration({
              tmdbId: media.tmdbId,
              type: 'movie',
              apiKey: tmdbApiKey
            });
            finalDurationSec = runtime * 60;
          }
          const finalViewOffsetSec = isCompleted ? finalDurationSec : (viewOffsetSec > finalDurationSec ? finalDurationSec : viewOffsetSec);

          const recentIncomplete = await prisma.watchHistoryLog.findFirst({
            where: {
              mediaId: media.id,
              type: 'movie',
              isCompleted: false,
              userId: user.id,
              watchedAt: { gte: new Date(Date.now() - 48 * 60 * 60000) }
            },
            orderBy: { watchedAt: 'desc' }
          });

          if (recentIncomplete) {
            await prisma.watchHistoryLog.update({
              where: { id: recentIncomplete.id },
              data: {
                viewOffset: finalViewOffsetSec,
                duration: finalDurationSec,
                isCompleted: isCompleted,
                watchedAt: new Date()
              }
            });
            console.log(`[Plex Webhook] Updated existing watch log for Movie ${metadata.title} (User: ${user.username}, completed: ${isCompleted})`);
          } else if (isCompleted || isPartial) {
            await prisma.watchHistoryLog.create({
              data: {
                mediaId: media.id,
                type: 'movie',
                duration: finalDurationSec,
                viewOffset: finalViewOffsetSec,
                isCompleted: isCompleted,
                userId: user.id,
                watchedAt: new Date()
              }
            });
            console.log(`[Plex Webhook] Logged new watch log for Movie ${metadata.title} (User: ${user.username}, completed: ${isCompleted})`);
          }

          if (isCompleted) {
            await prisma.watchHistory.create({
              data: { mediaId: media.id, userId: user.id }
            });
            console.log(`[Plex Webhook] Logged watch history for Movie ${metadata.title} (User: ${user.username})`);
          }
        }
      } else if (eventType === 'library.new') {
        await prisma.collection.upsert({
          where: { userId_mediaId: { userId: user.id, mediaId: media.id } },
          update: { collectedAt: new Date() },
          create: { mediaId: media.id, userId: user.id, collectedAt: new Date() }
        });
        console.log(`[Plex Webhook] Logged collection for Movie ${metadata.title} (User: ${user.username})`);
      }
    } else if (isEpisode) {
      // Resolve TV Show
      const showTitle = metadata.grandparentTitle;
      if (!showTitle) {
        console.log('[Plex Webhook] Episode webhook missing grandparentTitle (show title). Ignoring.');
        return res.sendStatus(200);
      }

      let media = await prisma.media.findFirst({
        where: { title: { equals: showTitle, mode: 'insensitive' }, type: 'tv' }
      });

      if (!media && tmdbApiKey) {
        try {
          const searchResults = await fetchTMDB('/3/search/tv', tmdbApiKey, { query: showTitle });
          if (searchResults?.results?.length > 0) {
            const bestMatch = searchResults.results[0];
            media = await prisma.media.create({
              data: {
                tmdbId: bestMatch.id,
                type: 'tv',
                title: bestMatch.name,
                overview: bestMatch.overview || '',
                releaseDate: bestMatch.first_air_date ? new Date(bestMatch.first_air_date) : null,
                posterPath: bestMatch.poster_path
              }
            });
          }
        } catch (err) {
          console.error('[Plex Webhook] Error fetching show metadata from TMDB:', err.message);
        }
      }

      if (media) {
        const season = metadata.parentIndex;
        const episode = metadata.index;
        if (season !== undefined && episode !== undefined) {
          if (eventType === 'media.scrobble' || eventType === 'media.stop') {
            const durationMs = metadata.duration || 0;
            const viewOffsetMs = metadata.viewOffset || (eventType === 'media.scrobble' ? durationMs : 0);
            const durationSec = Math.round(durationMs / 1000);
            const viewOffsetSec = Math.round(viewOffsetMs / 1000);
            const isCompleted = eventType === 'media.scrobble' || (durationMs > 0 && viewOffsetMs / durationMs >= 0.90);
            const isPartial = !isCompleted && viewOffsetMs > 10000;

            let shouldLog = true;
            if (eventType === 'media.stop' && isCompleted) {
              const recentLog = await prisma.watchHistoryLog.findFirst({
                where: {
                  mediaId: media.id,
                  type: 'tv',
                  season,
                  episode,
                  isCompleted: true,
                  userId: user.id,
                  watchedAt: { gte: new Date(Date.now() - 5 * 60000) }
                }
              });
              if (recentLog) {
                shouldLog = false;
                console.log(`[Plex Webhook] Ignoring duplicate media.stop for S${season}E${episode} of ${showTitle} (User: ${user.username})`);
              }
            }

            if (shouldLog) {
              let finalDurationSec = durationSec;
              if (finalDurationSec <= 0) {
                const runtime = await resolveDuration({
                  tmdbId: media.tmdbId,
                  type: 'tv',
                  season,
                  episode,
                  apiKey: tmdbApiKey
                });
                finalDurationSec = runtime * 60;
              }
              const finalViewOffsetSec = isCompleted ? finalDurationSec : (viewOffsetSec > finalDurationSec ? finalDurationSec : viewOffsetSec);

              const recentIncomplete = await prisma.watchHistoryLog.findFirst({
                where: {
                  mediaId: media.id,
                  type: 'tv',
                  season,
                  episode,
                  isCompleted: false,
                  userId: user.id,
                  watchedAt: { gte: new Date(Date.now() - 48 * 60 * 60000) }
                },
                orderBy: { watchedAt: 'desc' }
              });

              if (recentIncomplete) {
                await prisma.watchHistoryLog.update({
                  where: { id: recentIncomplete.id },
                  data: {
                    viewOffset: finalViewOffsetSec,
                    duration: finalDurationSec,
                    isCompleted: isCompleted,
                    watchedAt: new Date()
                  }
                });
                console.log(`[Plex Webhook] Updated existing watch log for Episode S${season}E${episode} of ${showTitle} (User: ${user.username}, completed: ${isCompleted})`);
              } else if (isCompleted || isPartial) {
                await prisma.watchHistoryLog.create({
                  data: {
                    mediaId: media.id,
                    type: 'tv',
                    season,
                    episode,
                    duration: finalDurationSec,
                    viewOffset: finalViewOffsetSec,
                    isCompleted: isCompleted,
                    userId: user.id,
                    watchedAt: new Date()
                  }
                });
                console.log(`[Plex Webhook] Logged new watch log for Episode S${season}E${episode} of ${showTitle} (User: ${user.username}, completed: ${isCompleted})`);
              }

              if (isCompleted) {
                await prisma.episodeWatchHistory.upsert({
                  where: { userId_mediaId_season_episode: { userId: user.id, mediaId: media.id, season, episode } },
                  update: { watchedAt: new Date() },
                  create: { mediaId: media.id, season, episode, userId: user.id, watchedAt: new Date() }
                });
                console.log(`[Plex Webhook] Logged watch history for Episode S${season}E${episode} of ${showTitle} (User: ${user.username})`);
                
                if (tmdbApiKey) {
                  const mediaRouter = require('./media');
                  await mediaRouter.syncShowWatchHistory(media.id, media.tmdbId, tmdbApiKey, user.id);
                }
              }
            }
          } else if (eventType === 'library.new') {
            await prisma.episodeCollection.upsert({
              where: { userId_mediaId_season_episode: { userId: user.id, mediaId: media.id, season, episode } },
              update: { collectedAt: new Date() },
              create: { mediaId: media.id, season, episode, userId: user.id, collectedAt: new Date() }
            });
            console.log(`[Plex Webhook] Logged collection for Episode S${season}E${episode} of ${showTitle} (User: ${user.username})`);
          }
        }
      }
    }
  }

  res.sendStatus(200);
}

// Token-based webhook (User specific)
router.post('/:token', upload.single('thumb'), async (req, res) => {
  try {
    const { token } = req.params;
    const payload = req.body.payload ? JSON.parse(req.body.payload) : req.body;
    
    if (!payload || !payload.Account || !payload.Metadata) {
      return res.sendStatus(200);
    }

    const user = await prisma.user.findUnique({ where: { plexWebhookToken: token } });
    if (!user) {
      console.log(`[Plex Webhook] Invalid webhook token: ${token}`);
      return res.sendStatus(404);
    }

    await handlePlexWebhook(payload, user, res);
  } catch (error) {
    console.error('Plex Token Webhook Error:', error);
    res.sendStatus(500);
  }
});

// Legacy / Fallback webhook URL (maps to default admin user)
router.post('/', upload.single('thumb'), async (req, res) => {
  try {
    const payload = req.body.payload ? JSON.parse(req.body.payload) : req.body;
    
    if (!payload || !payload.Account || !payload.Metadata) {
      return res.sendStatus(200);
    }

    const user = await prisma.user.findFirst({ where: { role: 'admin' } });
    if (!user) {
      console.log('[Plex Webhook] Legacy webhook called but no Admin user exists.');
      return res.sendStatus(404);
    }

    await handlePlexWebhook(payload, user, res);
  } catch (error) {
    console.error('Plex Webhook Error:', error);
    res.sendStatus(500);
  }
});

module.exports = router;
