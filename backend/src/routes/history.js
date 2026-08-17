const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken } = require('../middleware/auth');
const { syncShowWatchHistory } = require('../services/mediaService');

const router = express.Router();
router.use(authenticateToken);

router.get('/watch-history', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const type = req.query.type || 'all'; // 'all', 'movie', 'tv', 'episode'
    const includePartial = req.query.includePartial === true || req.query.includePartial === 'true';
    const search = req.query.search || '';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';
    const genre = req.query.genre || '';

    const skip = (page - 1) * limit;

    let targetUserId = req.user.id;
    if (req.user.role === 'admin' && req.query.userId && req.query.userId !== 'undefined' && req.query.userId !== 'null') {
      const parsedId = parseInt(req.query.userId, 10);
      if (!isNaN(parsedId) && parsedId > 0) {
        targetUserId = parsedId;
      }
    }
    const where = { userId: targetUserId };
    const mappedType = type === 'episode' ? 'tv' : type;
    if (mappedType !== 'all') {
      where.type = mappedType;
    }
    if (!includePartial) {
      where.isCompleted = true;
    }

    if (req.query.tmdbId && req.query.type) {
      const targetType = req.query.type === 'episode' ? 'tv' : req.query.type;
      const media = await prisma.media.findFirst({
        where: { tmdbId: parseInt(req.query.tmdbId), type: targetType }
      });
      if (media) {
        where.mediaId = media.id;
      } else {
        return res.json({ logs: [], total: 0 });
      }
    } else if (req.query.mediaId) {
      where.mediaId = parseInt(req.query.mediaId);
    }

    if (req.query.season) {
      where.season = parseInt(req.query.season);
    }
    if (req.query.episode) {
      where.episode = parseInt(req.query.episode);
    }

    if (startDate || endDate) {
      where.watchedAt = {};
      if (startDate) {
        where.watchedAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.watchedAt.lte = end;
      }
    }

    if ((search && !where.mediaId) || genre) {
      where.media = {};
      if (search && !where.mediaId) {
        where.media.title = {
          contains: search,
          mode: 'insensitive'
        };
      }
      if (genre) {
        where.media.genres = {
          contains: genre,
          mode: 'insensitive'
        };
      }
    }

    if (req.query.watchedWithUserIds) {
      const ids = req.query.watchedWithUserIds.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      if (ids.length > 0) {
        where.AND = ids.map(id => ({
          OR: [
            { watchedWith: { contains: `[${id}]` } },
            { watchedWith: { contains: `[${id},` } },
            { watchedWith: { contains: `,${id}]` } },
            { watchedWith: { contains: `,${id},` } },
            { watchedWith: { contains: `[${id} ` } },
            { watchedWith: { contains: ` ${id},` } },
            { watchedWith: { contains: ` ${id}]` } }
          ]
        }));
      }
    }

    const [logs, total] = await Promise.all([
      prisma.watchHistoryLog.findMany({
        where,
        include: {
          media: {
            select: {
              title: true,
              posterPath: true,
              tmdbId: true,
              genres: true
            }
          }
        },
        orderBy: { watchedAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.watchHistoryLog.count({ where })
    ]);

    // Extract unique genres from all media for the dropdown
    const mediaWithGenres = await prisma.media.findMany({
      where: {
        genres: { not: null }
      },
      select: { genres: true }
    });

    const uniqueGenresSet = new Set();
    mediaWithGenres.forEach(m => {
      if (m.genres) {
        m.genres.split(',').forEach(g => {
          const clean = g.trim();
          if (clean) uniqueGenresSet.add(clean);
        });
      }
    });
    
    const uniqueGenres = Array.from(uniqueGenresSet).sort();
    
    const allUsers = await prisma.user.findMany({
      select: { id: true, username: true, name: true, avatarPath: true }
    });
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    const enrichedLogs = await Promise.all(logs.map(async (log) => {
      let coViewerIds = [];
      try {
        if (log.watchedWith) {
          coViewerIds = JSON.parse(log.watchedWith);
        } else if (log.watchedAt) {
          const coViewerLogs = await prisma.watchHistoryLog.findMany({
            where: {
              mediaId: log.mediaId,
              type: log.type,
              season: log.season,
              episode: log.episode,
              userId: { not: targetUserId },
              watchedAt: {
                gte: new Date(new Date(log.watchedAt).getTime() - 3 * 60000),
                lte: new Date(new Date(log.watchedAt).getTime() + 3 * 60000)
              }
            },
            select: { userId: true },
            take: 10
          });
          coViewerIds = Array.from(new Set(coViewerLogs.map(l => l.userId).filter(Boolean)));
        }
      } catch (e) {
        console.error('Co-viewer enrichment error for log:', log.id, e.message);
      }

      const watchedWithUsers = coViewerIds
        .map(id => userMap.get(id))
        .filter(Boolean);

      return {
        ...log,
        watchedWithUsers
      };
    }));

    let activeSession = null;
    if (page === 1) {
      const plexStore = require('../utils/plexStore');
      activeSession = plexStore.getActiveSession(targetUserId);
    }

    res.json({
      logs: enrichedLogs,
      genres: uniqueGenres,
      activeSession,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Failed to get watch history logs:', error);
    res.status(500).json({ error: 'Failed to get watch history logs' });
  }
});

// Remove the last watched history entry
router.post('/watch-history/remove-last', async (req, res) => {
  const { tmdbId, type, season, episode } = req.body;
  if (!tmdbId || !type) {
    return res.status(400).json({ error: 'Missing tmdbId or type' });
  }

  try {
    const mediaType = type === 'episode' ? 'tv' : type;
    const media = await prisma.media.findFirst({
      where: { tmdbId: parseInt(tmdbId), type: mediaType }
    });
    if (!media) return res.status(404).json({ error: 'Media not found' });

    const where = {
      userId: req.user.id,
      mediaId: media.id,
      type: mediaType
    };
    if (type === 'episode') {
      where.season = season;
      where.episode = episode;
    }

    const log = await prisma.watchHistoryLog.findFirst({
      where,
      orderBy: { watchedAt: 'desc' }
    });

    if (!log) {
      return res.status(404).json({ error: 'No watch history entry found to remove' });
    }

    // Delete from WatchHistoryLog
    await prisma.watchHistoryLog.delete({ where: { id: log.id } });

    let isWatched = false;

    // Synchronize deletion with old watch history tables
    if (log.type === 'movie') {
      // Find a matching WatchHistory record close to the log's watchedAt
      let match = await prisma.watchHistory.findFirst({
        where: {
          userId: req.user.id,
          mediaId: log.mediaId,
          watchedAt: {
            gte: new Date(log.watchedAt.getTime() - 60000),
            lte: new Date(log.watchedAt.getTime() + 60000)
          }
        }
      });
      if (!match) {
        const allHistories = await prisma.watchHistory.findMany({
          where: { userId: req.user.id, mediaId: log.mediaId }
        });
        if (allHistories.length > 0) {
          allHistories.sort((a, b) => Math.abs(a.watchedAt.getTime() - log.watchedAt.getTime()) - Math.abs(b.watchedAt.getTime() - log.watchedAt.getTime()));
          match = allHistories[0];
        }
      }
      if (match) {
        await prisma.watchHistory.delete({ where: { id: match.id } });
      }

      const remainingWatchCount = await prisma.watchHistory.count({
        where: { userId: req.user.id, mediaId: log.mediaId }
      });
      isWatched = remainingWatchCount > 0;
    } else if (log.type === 'tv') {
      const otherLogs = await prisma.watchHistoryLog.findFirst({
        where: {
          userId: req.user.id,
          mediaId: log.mediaId,
          type: 'tv',
          season: log.season,
          episode: log.episode,
          isCompleted: true
        }
      });
      if (!otherLogs) {
        await prisma.episodeWatchHistory.deleteMany({
          where: {
            userId: req.user.id,
            mediaId: log.mediaId,
            season: log.season,
            episode: log.episode
          }
        });
      } else {
        isWatched = true;
        const latestRemainingLog = await prisma.watchHistoryLog.findFirst({
          where: {
            userId: req.user.id,
            mediaId: log.mediaId,
            type: 'tv',
            season: log.season,
            episode: log.episode,
            isCompleted: true
          },
          orderBy: { watchedAt: 'desc' }
        });
        if (latestRemainingLog) {
          await prisma.episodeWatchHistory.updateMany({
            where: {
              userId: req.user.id,
              mediaId: log.mediaId,
              season: log.season,
              episode: log.episode
            },
            data: { watchedAt: latestRemainingLog.watchedAt }
          });
        }
      }

      const systemSettings = await prisma.systemSettings.findFirst();
      if (systemSettings?.tmdbApiKey) {
        await syncShowWatchHistory(media.id, media.tmdbId, systemSettings.tmdbApiKey, req.user.id);
      }
    }

    res.json({ success: true, isWatched });
  } catch (error) {
    console.error('Failed to remove last watch history entry:', error);
    res.status(500).json({ error: 'Failed to remove last watch history entry' });
  }
});

// DELETE a watch history entry
router.delete('/watch-history/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const log = await prisma.watchHistoryLog.findFirst({
      where: {
        id,
        ...(req.user.role === 'admin' ? {} : { userId: req.user.id })
      }
    });
    if (!log) return res.status(404).json({ error: 'Watch history entry not found' });

    // Delete from WatchHistoryLog first
    await prisma.watchHistoryLog.delete({ where: { id } });

    let isWatched = false;

    // Synchronize deletion with old watch history tables
    if (log.type === 'movie') {
      // Find a matching WatchHistory record close to the log's watchedAt
      let match = await prisma.watchHistory.findFirst({
        where: {
          userId: log.userId,
          mediaId: log.mediaId,
          watchedAt: {
            gte: new Date(log.watchedAt.getTime() - 60000),
            lte: new Date(log.watchedAt.getTime() + 60000)
          }
        }
      });
      // Fallback: find the one closest in time
      if (!match) {
        const allHistories = await prisma.watchHistory.findMany({
          where: { userId: log.userId, mediaId: log.mediaId }
        });
        if (allHistories.length > 0) {
          allHistories.sort((a, b) => Math.abs(a.watchedAt.getTime() - log.watchedAt.getTime()) - Math.abs(b.watchedAt.getTime() - log.watchedAt.getTime()));
          match = allHistories[0];
        }
      }
      if (match) {
        await prisma.watchHistory.delete({ where: { id: match.id } });
        console.log(`[Sync Delete] Deleted matching WatchHistory record for movie ID ${log.mediaId}`);
      }

      const remainingWatchCount = await prisma.watchHistory.count({
        where: { userId: log.userId, mediaId: log.mediaId }
      });
      isWatched = remainingWatchCount > 0;
    } else if (log.type === 'tv' && log.isCompleted) {
      // Check if there are other completed watch logs for this episode
      const otherLogs = await prisma.watchHistoryLog.findFirst({
        where: {
          userId: log.userId,
          mediaId: log.mediaId,
          type: 'tv',
          season: log.season,
          episode: log.episode,
          isCompleted: true
        }
      });
      // If no other completed watch logs exist, delete from EpisodeWatchHistory
      if (!otherLogs) {
        await prisma.episodeWatchHistory.deleteMany({
          where: {
            userId: log.userId,
            mediaId: log.mediaId,
            season: log.season,
            episode: log.episode
          }
        });
        console.log(`[Sync Delete] Deleted EpisodeWatchHistory record for S${log.season}E${log.episode} of show ID ${log.mediaId}`);
      } else {
        isWatched = true;
        const latestRemainingLog = await prisma.watchHistoryLog.findFirst({
          where: {
            userId: log.userId,
            mediaId: log.mediaId,
            type: 'tv',
            season: log.season,
            episode: log.episode,
            isCompleted: true
          },
          orderBy: { watchedAt: 'desc' }
        });
        if (latestRemainingLog) {
          await prisma.episodeWatchHistory.updateMany({
            where: {
              userId: log.userId,
              mediaId: log.mediaId,
              season: log.season,
              episode: log.episode
            },
            data: { watchedAt: latestRemainingLog.watchedAt }
          });
        }
      }

      const mediaRecord = await prisma.media.findUnique({ where: { id: log.mediaId } });
      const systemSettings = await prisma.systemSettings.findFirst();
      if (mediaRecord && systemSettings?.tmdbApiKey) {
        await syncShowWatchHistory(mediaRecord.id, mediaRecord.tmdbId, systemSettings.tmdbApiKey, log.userId);
      }
    }

    res.json({ success: true, isWatched });
  } catch (error) {
    console.error('Failed to delete watch history log:', error);
    res.status(500).json({ error: 'Failed to delete watch history log' });
  }
});

// GET shareable users (all active users except current user)
router.get('/users/shareable', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { id: { not: req.user.id } },
      select: { id: true, username: true, name: true, avatarPath: true }
    });
    res.json({ users });
  } catch (err) {
    console.error('Error fetching shareable users:', err);
    res.status(500).json({ error: 'Failed to fetch shareable users' });
  }
});

// GET users that the current user has actually watched with
router.get('/users/co-viewers', async (req, res) => {
  try {
    let targetUserId = req.user.id;
    if (req.user.role === 'admin' && req.query.userId) {
      targetUserId = parseInt(req.query.userId, 10);
    }

    const logs = await prisma.watchHistoryLog.findMany({
      where: { userId: targetUserId, watchedWith: { not: null } },
      select: { watchedWith: true }
    });
    
    const userIds = new Set();
    logs.forEach(log => {
      try {
        const ids = JSON.parse(log.watchedWith);
        ids.forEach(id => userIds.add(id));
      } catch (e) {}
    });

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, username: true, name: true, avatarPath: true }
    });
    
    res.json({ users });
  } catch (err) {
    console.error('Error fetching co-viewers:', err);
    res.status(500).json({ error: 'Failed to fetch co-viewers' });
  }
});

// POST Bulk Share watch history entries to target users ("Watched Together")
router.post('/watch-history/share-bulk', async (req, res) => {
  const { logIds, targetUserIds } = req.body;
  if (!Array.isArray(logIds) || !Array.isArray(targetUserIds) || logIds.length === 0 || targetUserIds.length === 0) {
    return res.status(400).json({ error: 'logIds and targetUserIds arrays are required' });
  }

  try {
    const systemSettings = await prisma.systemSettings.findFirst();
    const tmdbApiKey = systemSettings?.tmdbApiKey;

    const logs = await prisma.watchHistoryLog.findMany({
      where: {
        id: { in: logIds },
        ...(req.user.role === 'admin' ? {} : { userId: req.user.id })
      },
      include: { media: true }
    });

    const affectedShows = new Set();

    for (const log of logs) {
      let sourceWatchedWith = [];
      try {
        if (log.watchedWith) sourceWatchedWith = JSON.parse(log.watchedWith);
      } catch (e) {}
      
      let sourceChanged = false;

      for (const targetUserId of targetUserIds) {
        if (targetUserId === req.user.id) continue;

        if (!sourceWatchedWith.includes(targetUserId)) {
          sourceWatchedWith.push(targetUserId);
          sourceChanged = true;
        }

        const existingLog = await prisma.watchHistoryLog.findFirst({
          where: {
            userId: targetUserId,
            mediaId: log.mediaId,
            type: log.type,
            season: log.season,
            episode: log.episode,
            watchedAt: log.watchedAt
          }
        });

        let targetWatchedWith = [];
        if (existingLog) {
          try {
            if (existingLog.watchedWith) targetWatchedWith = JSON.parse(existingLog.watchedWith);
          } catch (e) {}
        }
        
        if (!targetWatchedWith.includes(req.user.id)) {
          targetWatchedWith.push(req.user.id);
        }

        if (!existingLog) {
          await prisma.watchHistoryLog.create({
            data: {
              mediaId: log.mediaId,
              type: log.type,
              season: log.season,
              episode: log.episode,
              watchedAt: log.watchedAt,
              duration: log.duration,
              viewOffset: log.viewOffset,
              isCompleted: log.isCompleted,
              userId: targetUserId,
              watchedWith: JSON.stringify(targetWatchedWith)
            }
          });
        } else {
          await prisma.watchHistoryLog.update({
            where: { id: existingLog.id },
            data: { watchedWith: JSON.stringify(targetWatchedWith) }
          });
        }

        if (log.isCompleted) {
          if (log.type === 'movie') {
            const existingMovie = await prisma.watchHistory.findFirst({
              where: { userId: targetUserId, mediaId: log.mediaId }
            });
            if (!existingMovie) {
              await prisma.watchHistory.create({
                data: {
                  mediaId: log.mediaId,
                  userId: targetUserId,
                  watchedAt: log.watchedAt
                }
              });
            }
          } else if (log.type === 'tv' && log.season !== null && log.episode !== null) {
            await prisma.episodeWatchHistory.upsert({
              where: {
                userId_mediaId_season_episode: {
                  userId: targetUserId,
                  mediaId: log.mediaId,
                  season: log.season,
                  episode: log.episode
                }
              },
              update: { watchedAt: log.watchedAt },
              create: {
                userId: targetUserId,
                mediaId: log.mediaId,
                season: log.season,
                episode: log.episode,
                watchedAt: log.watchedAt
              }
            });

            if (tmdbApiKey && log.media?.tmdbId) {
              affectedShows.add(`${targetUserId}:${log.mediaId}:${log.media.tmdbId}`);
            }
          }
        }
      }
      
      if (sourceChanged) {
        await prisma.watchHistoryLog.update({
          where: { id: log.id },
          data: { watchedWith: JSON.stringify(sourceWatchedWith) }
        });
      }
    }

    for (const item of affectedShows) {
      const [uId, mId, tmdbId] = item.split(':');
      await syncShowWatchHistory(parseInt(mId, 10), parseInt(tmdbId, 10), tmdbApiKey, parseInt(uId, 10));
    }

    res.json({ message: 'Successfully shared watch entries', count: logs.length });
  } catch (err) {
    console.error('Error sharing watch history:', err);
    res.status(500).json({ error: 'Failed to share watch history entries' });
  }
});

// POST Bulk Unshare watch history entries from target users
router.post('/watch-history/unshare-bulk', async (req, res) => {
  const { logIds, targetUserIds } = req.body;
  if (!Array.isArray(logIds) || !Array.isArray(targetUserIds) || logIds.length === 0 || targetUserIds.length === 0) {
    return res.status(400).json({ error: 'logIds and targetUserIds arrays are required' });
  }

  try {
    const systemSettings = await prisma.systemSettings.findFirst();
    const tmdbApiKey = systemSettings?.tmdbApiKey;

    const logs = await prisma.watchHistoryLog.findMany({
      where: {
        id: { in: logIds },
        ...(req.user.role === 'admin' ? {} : { userId: req.user.id })
      },
      include: { media: true }
    });

    const affectedShows = new Set();

    for (const log of logs) {
      let sourceWatchedWith = [];
      try {
        if (log.watchedWith) sourceWatchedWith = JSON.parse(log.watchedWith);
      } catch (e) {}
      
      let sourceChanged = false;

      for (const targetUserId of targetUserIds) {
        if (targetUserId === req.user.id) continue;
        
        const index = sourceWatchedWith.indexOf(targetUserId);
        if (index !== -1) {
          sourceWatchedWith.splice(index, 1);
          sourceChanged = true;
        }

        await prisma.watchHistoryLog.deleteMany({
          where: {
            userId: targetUserId,
            mediaId: log.mediaId,
            type: log.type,
            season: log.season,
            episode: log.episode
          }
        });

        if (log.type === 'movie') {
          await prisma.watchHistory.deleteMany({
            where: {
              userId: targetUserId,
              mediaId: log.mediaId
            }
          });
        } else if (log.type === 'tv' && log.season !== null && log.episode !== null) {
          await prisma.episodeWatchHistory.deleteMany({
            where: {
              userId: targetUserId,
              mediaId: log.mediaId,
              season: log.season,
              episode: log.episode
            }
          });

          if (tmdbApiKey && log.media?.tmdbId) {
            affectedShows.add(`${targetUserId}:${log.mediaId}:${log.media.tmdbId}`);
          }
        }
      }
      
      if (sourceChanged) {
        await prisma.watchHistoryLog.update({
          where: { id: log.id },
          data: { watchedWith: JSON.stringify(sourceWatchedWith) }
        });
      }
    }

    for (const item of affectedShows) {
      const [uId, mId, tmdbId] = item.split(':');
      await syncShowWatchHistory(parseInt(mId, 10), parseInt(tmdbId, 10), tmdbApiKey, parseInt(uId, 10));
    }

    res.json({ message: 'Successfully unshared watch entries', count: logs.length });
  } catch (err) {
    console.error('Error unsharing watch history:', err);
    res.status(500).json({ error: 'Failed to unshare watch history entries' });
  }
});

// POST Bulk Delete watch history entries for current user
router.post('/watch-history/delete-bulk', async (req, res) => {
  const { logIds } = req.body;
  if (!Array.isArray(logIds) || logIds.length === 0) {
    return res.status(400).json({ error: 'logIds array is required' });
  }

  try {
    const systemSettings = await prisma.systemSettings.findFirst();
    const tmdbApiKey = systemSettings?.tmdbApiKey;

    const logs = await prisma.watchHistoryLog.findMany({
      where: {
        id: { in: logIds },
        ...(req.user.role === 'admin' ? {} : { userId: req.user.id })
      },
      include: { media: true }
    });

    const affectedShows = new Set();

    for (const log of logs) {
      await prisma.watchHistoryLog.delete({ where: { id: log.id } });

      if (log.type === 'movie') {
        const remainingLogs = await prisma.watchHistoryLog.count({
          where: { userId: log.userId, mediaId: log.mediaId, type: 'movie', isCompleted: true }
        });
        if (remainingLogs === 0) {
          await prisma.watchHistory.deleteMany({
            where: { userId: log.userId, mediaId: log.mediaId }
          });
        }
      } else if (log.type === 'tv' && log.season !== null && log.episode !== null) {
        const remainingLogs = await prisma.watchHistoryLog.count({
          where: {
            userId: log.userId,
            mediaId: log.mediaId,
            type: 'tv',
            season: log.season,
            episode: log.episode,
            isCompleted: true
          }
        });
        if (remainingLogs === 0) {
          await prisma.episodeWatchHistory.deleteMany({
            where: {
              userId: log.userId,
              mediaId: log.mediaId,
              season: log.season,
              episode: log.episode
            }
          });
        }
        if (tmdbApiKey && log.media?.tmdbId) {
          affectedShows.add(`${log.userId}:${log.mediaId}:${log.media.tmdbId}`);
        }
      }
    }

    for (const item of affectedShows) {
      const [uId, mId, tmdbId] = item.split(':');
      await syncShowWatchHistory(parseInt(mId, 10), parseInt(tmdbId, 10), tmdbApiKey, parseInt(uId, 10));
    }

    res.json({ message: 'Successfully deleted history logs', count: logs.length });
  } catch (err) {
    console.error('Error deleting bulk watch history:', err);
    res.status(500).json({ error: 'Failed to delete watch history logs' });
  }
});

module.exports = router;
