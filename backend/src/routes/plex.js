const express = require('express');
const multer = require('multer');
const prisma = require('../prismaClient');
const { fetchTMDB } = require('../utils/tmdb');
const plexStore = require('../utils/plexStore');
const { resolveDuration } = require('../utils/durationResolver');

const router = express.Router();
const upload = multer(); // Plex sends multipart/form-data

const recentPlexScrobbles = new Map();

function isDuplicateScrobble(key) {
  const now = Date.now();
  const lastTime = recentPlexScrobbles.get(key);
  if (lastTime && now - lastTime < 120000) { // 2 minute window
    return true;
  }
  recentPlexScrobbles.set(key, now);
  if (recentPlexScrobbles.size > 1000) {
    for (const [k, time] of recentPlexScrobbles.entries()) {
      if (now - time > 300000) recentPlexScrobbles.delete(k);
    }
  }
  return false;
}

// Process Plex Webhook payload for a specific User
async function handlePlexWebhook(payload, user, res, isReplicated = false) {
  if (!user) {
    console.log('[Plex Webhook] No user context provided. Ignoring.');
    return res.sendStatus(200);
  }

  const plexUser = payload.Account?.title;
  if (!isReplicated && (user.plexUser || user.username || user.name)) {
    const normalize = str => str ? str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
    const pNorm = normalize(plexUser);
    const targetPlexNorm = normalize(user.plexUser);
    const targetUserNorm = normalize(user.username);
    const targetNameNorm = normalize(user.name);

    const isMatch = (pNorm && pNorm === targetPlexNorm) ||
                    (targetUserNorm && pNorm === targetUserNorm) ||
                    (targetNameNorm && pNorm === targetNameNorm);

    if (!isMatch) {
      console.log(`[Plex Webhook] Ignoring webhook for Plex account "${plexUser}" (User ${user.username} expects "${user.plexUser}")`);
      return res.sendStatus(200);
    }
  }

  // Watch Together Mode Fan-Out Replication
  if (!isReplicated) {
    try {
      const wtSession = await prisma.watchTogetherSession.findUnique({
        where: { userId: user.id }
      });
      if (wtSession && wtSession.enabled) {
        const participantIds = JSON.parse(wtSession.participantIds || '[]');
        if (participantIds.length > 0) {
          const participants = await prisma.user.findMany({
            where: { id: { in: participantIds } }
          });
          const mockRes = { sendStatus: () => {} };
          for (const participant of participants) {
            console.log(`[Watch Together] Replicating Plex webhook event "${payload.event}" from host ${user.username} to ${participant.username}`);
            handlePlexWebhook(payload, participant, mockRes, true).catch(err => {
              console.error(`[Watch Together] Error replicating webhook for user ${participant.username}:`, err);
            });
          }
        }
      }
    } catch (wtErr) {
      console.error('[Watch Together] Fan-out replication error:', wtErr);
    }
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
        // Fallback duration, viewOffset, season, episode if missing from Plex webhook payload
        if (!metadata.duration && current.duration !== undefined) {
          metadata.duration = current.duration;
        }
        if (!metadata.viewOffset && current.viewOffset !== undefined) {
          const elapsed = current.isPlaying ? (Date.now() - current.updatedAt) : 0;
          metadata.viewOffset = current.viewOffset + elapsed;
        }
        if (metadata.parentIndex === undefined && current.season !== undefined) {
          metadata.parentIndex = current.season;
        }
        if (metadata.index === undefined && current.episode !== undefined) {
          metadata.index = current.episode;
        }
        if (!metadata.grandparentTitle && (current.grandparentTitle || current.mediaTitle)) {
          metadata.grandparentTitle = current.grandparentTitle || current.mediaTitle;
        }

        plexStore.clearActiveSession(user.id);
        const { broadcastToUser } = require('../utils/wsManager');
        broadcastToUser(user.id, { type: 'plex-session', session: null });
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
        mediaTitle,
        type: metadata.type === 'episode' ? 'episode' : 'movie',
        season: metadata.parentIndex,
        episode: metadata.index,
        ratingKey,
        duration: metadata.duration || 0,
        viewOffset: metadata.viewOffset || 0,
        isPlaying,
        updatedAt: Date.now(),
        posterPath,
        tmdbId
      };

      plexStore.setActiveSession(user.id, session);
      const { broadcastToUser } = require('../utils/wsManager');
      broadcastToUser(user.id, { type: 'plex-session', session });
    }
  }

  // 2. Scrobble / Watch History Tracking
  if (metadata.type === 'movie') {
    const tmdbId = metadata.tmdbId;
    let media = null;
    if (tmdbId) {
      media = await prisma.media.findFirst({ where: { tmdbId, type: 'movie' } });
    } else {
      media = await prisma.media.findFirst({
        where: {
          title: {
            equals: metadata.title,
            mode: 'insensitive'
          },
          type: 'movie'
        }
      });
    }

    if (!media && tmdbApiKey && metadata.title) {
      try {
        const searchResults = await fetchTMDB('/3/search/movie', tmdbApiKey, {
          query: metadata.title,
          year: metadata.year
        });
        if (searchResults && searchResults.results && searchResults.results.length > 0) {
          const bestMatch = searchResults.results[0];
          media = await prisma.media.create({
            data: {
              tmdbId: bestMatch.id,
              type: 'movie',
              title: bestMatch.title,
              overview: bestMatch.overview || '',
              releaseDate: bestMatch.release_date ? new Date(bestMatch.release_date) : null,
              posterPath: bestMatch.poster_path
            }
          });
        }
      } catch (err) {
        console.error('[Plex Webhook] Error fetching movie metadata from TMDB:', err.message);
      }
    }

    if (media) {
      if (eventType === 'media.scrobble' || eventType === 'media.stop') {
        const durationMs = metadata.duration || 0;
        const viewOffsetMs = metadata.viewOffset || (eventType === 'media.scrobble' ? durationMs : 0);
        const durationSec = Math.round(durationMs / 1000);
        const viewOffsetSec = Math.round(viewOffsetMs / 1000);
        const isCompleted = eventType === 'media.scrobble' || (durationMs > 0 && viewOffsetMs / durationMs >= 0.90);
        const isPartial = !isCompleted && durationMs > 0 && (viewOffsetMs / durationMs) > 0.10;

        let shouldLog = true;
        if (isCompleted) {
          const dedupeKey = `movie_${user.id}_${media.id}`;
          if (isDuplicateScrobble(dedupeKey)) {
            shouldLog = false;
            console.log(`[Plex Webhook] Ignoring concurrent/duplicate scrobble for Movie ${metadata.title} (User: ${user.username})`);
          } else {
            const recentLog = await prisma.watchHistoryLog.findFirst({
              where: {
                mediaId: media.id,
                type: 'movie',
                isCompleted: true,
                userId: user.id,
                watchedAt: { gte: new Date(Date.now() - 2 * 60000) }
              }
            });
            if (recentLog) {
              shouldLog = false;
              console.log(`[Plex Webhook] Ignoring duplicate watch log for Movie ${metadata.title} (User: ${user.username})`);
            }
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
              userId: user.id
            },
            orderBy: { watchedAt: 'desc' }
          });

          if (recentIncomplete) {
            const currentSessions = Array.isArray(recentIncomplete.sessions) ? recentIncomplete.sessions : [];
            const newSession = {
              startOffset: recentIncomplete.viewOffset,
              endOffset: finalViewOffsetSec,
              timestamp: new Date().toISOString()
            };

            await prisma.watchHistoryLog.update({
              where: { id: recentIncomplete.id },
              data: {
                viewOffset: finalViewOffsetSec,
                duration: finalDurationSec,
                isCompleted: isCompleted,
                watchedAt: new Date(),
                sessions: [...currentSessions, newSession]
              }
            });
            console.log(`[Plex Webhook] Updated existing watch log for Movie ${metadata.title} (User: ${user.username}, completed: ${isCompleted})`);
          } else if (isCompleted || isPartial) {
            const initialSession = {
              startOffset: 0,
              endOffset: finalViewOffsetSec,
              timestamp: new Date().toISOString()
            };

            await prisma.watchHistoryLog.create({
              data: {
                mediaId: media.id,
                type: 'movie',
                duration: finalDurationSec,
                viewOffset: finalViewOffsetSec,
                isCompleted: isCompleted,
                userId: user.id,
                watchedAt: new Date(),
                sessions: [initialSession]
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
        const { archiveRequestsOnCollect } = require('../utils/requestManager');
        await archiveRequestsOnCollect(media.id, 'movie');
        console.log(`[Plex Webhook] Logged collection for Movie ${metadata.title} (User: ${user.username})`);
      }
    }
  } else if (metadata.type === 'episode') {
      // Resolve TV Show
      const showTitle = metadata.grandparentTitle || metadata.title;
      if (!showTitle) {
        console.log('[Plex Webhook] Episode webhook missing show title. Ignoring.');
        return res.sendStatus(200);
      }

      let media = null;
      if (metadata.grandparentTitle) {
        media = await prisma.media.findFirst({
          where: { title: { equals: metadata.grandparentTitle, mode: 'insensitive' }, type: 'tv' }
        });
      }
      if (!media && showTitle) {
        media = await prisma.media.findFirst({
          where: { title: { equals: showTitle, mode: 'insensitive' }, type: 'tv' }
        });
      }

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
        const season = metadata.parentIndex !== undefined && metadata.parentIndex !== null ? parseInt(metadata.parentIndex, 10) : undefined;
        const episode = metadata.index !== undefined && metadata.index !== null ? parseInt(metadata.index, 10) : undefined;
        if (season !== undefined && episode !== undefined && !isNaN(season) && !isNaN(episode)) {
          if (eventType === 'media.scrobble' || eventType === 'media.stop') {
            const durationMs = metadata.duration || 0;
            const viewOffsetMs = metadata.viewOffset || (eventType === 'media.scrobble' ? durationMs : 0);
            const durationSec = Math.round(durationMs / 1000);
            const viewOffsetSec = Math.round(viewOffsetMs / 1000);
            const isCompleted = eventType === 'media.scrobble' || (durationMs > 0 && viewOffsetMs / durationMs >= 0.90);
            const isPartial = !isCompleted && durationMs > 0 && (viewOffsetMs / durationMs) > 0.10;

            let shouldLog = true;
            if (isCompleted) {
              const dedupeKey = `tv_${user.id}_${media.id}_${season}_${episode}`;
              if (isDuplicateScrobble(dedupeKey)) {
                shouldLog = false;
                console.log(`[Plex Webhook] Ignoring concurrent/duplicate scrobble for S${season}E${episode} of ${showTitle} (User: ${user.username})`);
              } else {
                const recentLog = await prisma.watchHistoryLog.findFirst({
                  where: {
                    mediaId: media.id,
                    type: 'tv',
                    season,
                    episode,
                    isCompleted: true,
                    userId: user.id,
                    watchedAt: { gte: new Date(Date.now() - 2 * 60000) }
                  }
                });
                if (recentLog) {
                  shouldLog = false;
                  console.log(`[Plex Webhook] Ignoring duplicate watch log for S${season}E${episode} of ${showTitle} (User: ${user.username})`);
                }
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
                  userId: user.id
                },
                orderBy: { watchedAt: 'desc' }
              });

              if (recentIncomplete) {
                const currentSessions = Array.isArray(recentIncomplete.sessions) ? recentIncomplete.sessions : [];
                const newSession = {
                  startOffset: recentIncomplete.viewOffset,
                  endOffset: finalViewOffsetSec,
                  timestamp: new Date().toISOString()
                };

                await prisma.watchHistoryLog.update({
                  where: { id: recentIncomplete.id },
                  data: {
                    viewOffset: finalViewOffsetSec,
                    duration: finalDurationSec,
                    isCompleted: isCompleted,
                    watchedAt: new Date(),
                    sessions: [...currentSessions, newSession]
                  }
                });
                console.log(`[Plex Webhook] Updated existing watch log for Episode S${season}E${episode} of ${showTitle} (User: ${user.username}, completed: ${isCompleted})`);
              } else if (isCompleted || isPartial) {
                const initialSession = {
                  startOffset: 0,
                  endOffset: finalViewOffsetSec,
                  timestamp: new Date().toISOString()
                };

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
                    watchedAt: new Date(),
                    sessions: [initialSession]
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
                  const mediaService = require('../services/mediaService');
                  await mediaService.syncShowWatchHistory(media.id, media.tmdbId, tmdbApiKey, user.id);
                }
              }
            }
          } else if (eventType === 'library.new') {
            await prisma.collection.upsert({
              where: { userId_mediaId: { userId: user.id, mediaId: media.id } },
              update: {},
              create: { userId: user.id, mediaId: media.id }
            });
            await prisma.episodeCollection.upsert({
              where: { userId_mediaId_season_episode: { userId: user.id, mediaId: media.id, season, episode } },
              update: { collectedAt: new Date() },
              create: { mediaId: media.id, season, episode, userId: user.id, collectedAt: new Date() }
            });
            const { archiveRequestsOnCollect } = require('../utils/requestManager');
            await archiveRequestsOnCollect(media.id, 'tv', season, episode);
            console.log(`[Plex Webhook] Logged collection for Episode S${season}E${episode} of ${showTitle} (User: ${user.username})`);
          }
        }
      }
    }

  res.sendStatus(200);
}

// Global webhook (Admin managed, works for all matching users)
router.post('/global/:token', upload.single('thumb'), async (req, res) => {
  try {
    const { token } = req.params;
    const payload = req.body.payload ? JSON.parse(req.body.payload) : req.body;
    
    if (!payload || !payload.Account || !payload.Metadata) {
      return res.sendStatus(200);
    }

    const systemSettings = await prisma.systemSettings.findFirst({
      where: { plexGlobalWebhookToken: token }
    });

    if (!systemSettings) {
      console.log(`[Plex Global Webhook] Invalid global webhook token: ${token}`);
      return res.sendStatus(404);
    }

    // Update global webhook last active timestamp
    await prisma.systemSettings.update({
      where: { id: systemSettings.id },
      data: { plexGlobalLastWebhookAt: new Date() }
    });

    const plexUser = payload.Account?.title;
    if (!plexUser) {
      console.log('[Plex Global Webhook] Missing Account.title in payload.');
      return res.sendStatus(200);
    }

    const allUsers = await prisma.user.findMany();
    const normalize = str => str ? str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
    const plexUserNorm = normalize(plexUser);

    let matchedUser = allUsers.find(u => {
      const pNorm = normalize(u.plexUser);
      const uNorm = normalize(u.username);
      const nNorm = normalize(u.name);
      return (
        (pNorm && pNorm === plexUserNorm) ||
        (uNorm && uNorm === plexUserNorm) ||
        (nNorm && nNorm === plexUserNorm)
      );
    });

    if (!matchedUser) {
      console.log(`[Plex Global Webhook] No user found for Plex account "${plexUser}". Auto-creating user...`);
      const crypto = require('crypto');
      const plexWebhookToken = crypto.randomBytes(16).toString('hex');

      let baseUsername = plexUser;
      let targetUsername = baseUsername;
      let counter = 1;
      while (allUsers.some(u => u.username.toLowerCase() === targetUsername.toLowerCase())) {
        targetUsername = `${baseUsername} ${counter++}`;
      }

      matchedUser = await prisma.user.create({
        data: {
          username: targetUsername,
          plexUser: plexUser,
          passwordHash: '',
          role: 'user',
          plexWebhookToken
        }
      });

      await prisma.customList.create({
        data: {
          name: 'Watchlist',
          userId: matchedUser.id
        }
      });

      console.log(`[Plex Global Webhook] Auto-created new user ID ${matchedUser.id} (${matchedUser.username}) for Plex account "${plexUser}".`);
    }

    await handlePlexWebhook(payload, matchedUser, res);
  } catch (error) {
    console.error('Plex Global Webhook Error:', error);
    res.sendStatus(500);
  }
});

// Token-based webhook (User specific)
router.post('/:token', upload.single('thumb'), async (req, res) => {
  try {
    const { token } = req.params;
    const rawPayload = req.body?.payload;
    let payload = null;
    if (rawPayload) {
      try { payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload; } catch (e) {}
    } else if (req.body) {
      payload = req.body;
    }
    
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
    const rawPayload = req.body?.payload;
    let payload = null;
    if (rawPayload) {
      try { payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload; } catch (e) {}
    } else if (req.body) {
      payload = req.body;
    }
    
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
