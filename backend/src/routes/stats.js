const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { fetchTMDB } = require('../utils/tmdb');

// Month & Day Formatting Utilities
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatDateLabel = (date, mode) => {
  const d = new Date(date);
  if (mode === 'day') {
    return `${monthNames[d.getMonth()]} ${d.getDate()}`;
  } else if (mode === 'month') {
    return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  }
  return d.toLocaleDateString();
};

// GET /api/stats/:username
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // 1. Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        name: true,
        avatarPath: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 2. Fetch TMDB API key from system settings
    const systemSettings = await prisma.systemSettings.findFirst();
    const apiKey = systemSettings?.tmdbApiKey || process.env.TMDB_API_KEY;

    // 2.1 Fetch all users for Watched Together mapping
    const allUsers = await prisma.user.findMany({ select: { id: true, username: true, name: true } });
    const userMap = {};
    allUsers.forEach(u => userMap[u.id] = u.username || u.name);

    const { range } = req.query; // 'week', 'month', 'year', 'all'
    const now = new Date();
    let startDate = null;
    if (range === 'week') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (range === 'month') startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (range === 'year' || !range) startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const logsWhere = { userId: user.id };
    if (startDate) {
      logsWhere.watchedAt = { gte: startDate };
    }

    // 3. Fetch watch history logs
    const logs = await prisma.watchHistoryLog.findMany({
      where: logsWhere,
      include: { media: true },
      orderBy: { watchedAt: 'asc' }
    });

    // 4. Summaries & Watched Together helper
    let movieCount = 0;
    let tvCount = 0;
    let movieSeconds = 0;
    let tvSeconds = 0;
    
    const watchedTogetherMap = {}; // userId -> seconds
    let watchedAloneSeconds = 0;

    const getDuration = (log) => {
      if (log.viewOffset && log.viewOffset > 0) return log.viewOffset;
      if (log.duration && log.duration > 0) return log.duration;
      return 0; // Return 0 if TMDB data was missing during import, as per user request to not guess.
    };

    // Fetch other users' logs in the same timeframe to correlate "Watched Together"
    // To avoid massive queries, we'll fetch logs from other users that match the mediaIds watched by this user.
    const userMediaWatchTimes = {};
    logs.forEach(log => {
      if (!userMediaWatchTimes[log.mediaId]) userMediaWatchTimes[log.mediaId] = [];
      userMediaWatchTimes[log.mediaId].push(log);
    });

    const otherUsersLogs = await prisma.watchHistoryLog.findMany({
      where: {
        userId: { not: user.id },
        mediaId: { in: Object.keys(userMediaWatchTimes).map(Number) },
        ...(startDate ? { watchedAt: { gte: startDate } } : {})
      }
    });

    otherUsersLogs.forEach(otherLog => {
      const uLogs = userMediaWatchTimes[otherLog.mediaId];
      if (uLogs) {
        // Watched within 2 hours
        const twoHours = 2 * 60 * 60 * 1000;
        const matching = uLogs.find(ul => Math.abs(ul.watchedAt.getTime() - otherLog.watchedAt.getTime()) <= twoHours);
        if (matching) {
          if (!matching.calculatedWith) matching.calculatedWith = new Set();
          matching.calculatedWith.add(otherLog.userId);
        }
      }
    });

    logs.forEach(log => {
      const dur = getDuration(log);
      if (log.type === 'movie') {
        movieCount++;
        movieSeconds += dur;
      } else {
        tvCount++;
        tvSeconds += dur;
      }

      if (log.calculatedWith && log.calculatedWith.size > 0) {
        log.calculatedWith.forEach(uid => {
          if (!watchedTogetherMap[uid]) watchedTogetherMap[uid] = 0;
          watchedTogetherMap[uid] += dur;
        });
      } else {
        watchedAloneSeconds += dur;
      }
    });

    const summary = {
      movieCount,
      episodeCount: tvCount,
      movieMinutes: Math.round(movieSeconds / 60),
      tvMinutes: Math.round(tvSeconds / 60),
      totalMinutes: Math.round((movieSeconds + tvSeconds) / 60)
    };

    const watchedTogether = {
      aloneMinutes: Math.round(watchedAloneSeconds / 60),
      with: Object.keys(watchedTogetherMap).map(uid => ({
        username: userMap[uid] || `User ${uid}`,
        minutes: Math.round(watchedTogetherMap[uid] / 60)
      })).sort((a, b) => b.minutes - a.minutes)
    };

    // 5. GitHub contribution graph data
    const activityByDate = {};
    const daysToMap = range === 'week' ? 7 : range === 'month' ? 30 : range === 'all' && logs.length > 0 ? Math.ceil((now - logs[0].watchedAt) / (1000 * 60 * 60 * 24)) : 365;
    
    for (let i = daysToMap; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      activityByDate[dateStr] = { tv: 0, movie: 0, total: 0 };
    }

    logs.forEach(log => {
      const dateStr = log.watchedAt.toISOString().split('T')[0];
      if (activityByDate[dateStr] !== undefined) {
        if (log.type === 'tv') activityByDate[dateStr].tv++;
        else activityByDate[dateStr].movie++;
        activityByDate[dateStr].total++;
      }
    });

    const activityArray = Object.keys(activityByDate).map(date => ({
      date, ...activityByDate[date]
    })).sort((a, b) => a.date.localeCompare(b.date));

    // 6. Line chart timeline data
    const timeline = [];
    if (range === 'week') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().split('T')[0];
        const dayLogs = logs.filter(l => l.watchedAt.toISOString().split('T')[0] === dateStr);
        timeline.push({ label: formatDateLabel(d, 'day'), shows: dayLogs.filter(l => l.type === 'tv').length, movies: dayLogs.filter(l => l.type === 'movie').length, total: dayLogs.length });
      }
    } else if (range === 'month') {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().split('T')[0];
        const dayLogs = logs.filter(l => l.watchedAt.toISOString().split('T')[0] === dateStr);
        timeline.push({ label: formatDateLabel(d, 'day'), shows: dayLogs.filter(l => l.type === 'tv').length, movies: dayLogs.filter(l => l.type === 'movie').length, total: dayLogs.length });
      }
    } else {
      let displayMonths = 12;
      if (range === 'all' && logs.length > 0) {
        const firstDate = logs[0].watchedAt;
        const totalMonths = (now.getFullYear() - firstDate.getFullYear()) * 12 + (now.getMonth() - firstDate.getMonth()) + 1;
        displayMonths = Math.min(totalMonths, 60);
      }
      for (let i = displayMonths - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = d.getMonth();
        const monthLogs = logs.filter(l => l.watchedAt.getFullYear() === year && l.watchedAt.getMonth() === month);
        timeline.push({ label: formatDateLabel(d, 'month'), shows: monthLogs.filter(l => l.type === 'tv').length, movies: monthLogs.filter(l => l.type === 'movie').length, total: monthLogs.length });
      }
    }

    // 7. Aggregate Top Shows & Movies
    const mediaAggregates = {};
    logs.forEach(log => {
      if (!mediaAggregates[log.mediaId]) {
        mediaAggregates[log.mediaId] = { media: log.media, count: 0, viewOffsetSum: 0 };
      }
      mediaAggregates[log.mediaId].count++;
      mediaAggregates[log.mediaId].viewOffsetSum += getDuration(log);
    });

    const tvAggregates = Object.values(mediaAggregates).filter(a => a.media.type === 'tv');
    const movieAggregates = Object.values(mediaAggregates).filter(a => a.media.type === 'movie');

    const topShowsByCount = [...tvAggregates].sort((a, b) => b.count - a.count).slice(0, 5).map(a => ({ id: a.media.id, tmdbId: a.media.tmdbId, title: a.media.title, posterPath: a.media.posterPath, backdropPath: a.media.backdropPath, count: a.count, minutes: Math.round(a.viewOffsetSum / 60) }));
    const topMoviesByCount = [...movieAggregates].sort((a, b) => b.count - a.count).slice(0, 5).map(a => ({ id: a.media.id, tmdbId: a.media.tmdbId, title: a.media.title, posterPath: a.media.posterPath, backdropPath: a.media.backdropPath, count: a.count, minutes: Math.round(a.viewOffsetSum / 60) }));
    const topShowsByMinutes = [...tvAggregates].sort((a, b) => b.viewOffsetSum - a.viewOffsetSum).slice(0, 5).map(a => ({ id: a.media.id, tmdbId: a.media.tmdbId, title: a.media.title, posterPath: a.media.posterPath, backdropPath: a.media.backdropPath, count: a.count, minutes: Math.round(a.viewOffsetSum / 60) }));
    const topMoviesByMinutes = [...movieAggregates].sort((a, b) => b.viewOffsetSum - a.viewOffsetSum).slice(0, 5).map(a => ({ id: a.media.id, tmdbId: a.media.tmdbId, title: a.media.title, posterPath: a.media.posterPath, backdropPath: a.media.backdropPath, count: a.count, minutes: Math.round(a.viewOffsetSum / 60) }));

    // 8. TMDB Meta Aggregations
    const actorAggregate = {};
    const networkAggregate = {};

    if (apiKey) {
      const topTvForCredits = [...tvAggregates].sort((a, b) => b.count - a.count).slice(0, 15);
      const topMovieForCredits = [...movieAggregates].sort((a, b) => b.count - a.count).slice(0, 15);

      const tvPromises = topTvForCredits.map(async (showAgg) => {
        const { tmdbId } = showAgg.media;
        const watchWeight = showAgg.count;
        try {
          const [showDetails, credits] = await Promise.all([
            fetchTMDB(`/3/tv/${tmdbId}`, apiKey).catch(() => null),
            fetchTMDB(`/3/tv/${tmdbId}/credits`, apiKey).catch(() => null)
          ]);
          
          if (showDetails?.networks) {
            showDetails.networks.forEach(net => {
              if (!networkAggregate[net.id]) networkAggregate[net.id] = { id: net.id, name: net.name, logoPath: net.logo_path, weight: 0 };
              networkAggregate[net.id].weight += watchWeight;
            });
          }
          if (credits?.cast) {
            credits.cast.slice(0, 10).forEach(c => {
              if (c.gender === 1 || c.gender === 2) {
                if (!actorAggregate[c.id]) actorAggregate[c.id] = { id: c.id, name: c.name, gender: c.gender, profilePath: c.profile_path, weight: 0 };
                actorAggregate[c.id].weight += watchWeight;
              }
            });
          }
        } catch (err) {}
      });

      const moviePromises = topMovieForCredits.map(async (movieAgg) => {
        const { tmdbId } = movieAgg.media;
        const watchWeight = movieAgg.count;
        try {
          const credits = await fetchTMDB(`/3/movie/${tmdbId}/credits`, apiKey).catch(() => null);
          if (credits?.cast) {
            credits.cast.slice(0, 10).forEach(c => {
              if (c.gender === 1 || c.gender === 2) {
                if (!actorAggregate[c.id]) actorAggregate[c.id] = { id: c.id, name: c.name, gender: c.gender, profilePath: c.profile_path, weight: 0 };
                actorAggregate[c.id].weight += watchWeight;
              }
            });
          }
        } catch (err) {}
      });

      await Promise.all([...tvPromises, ...moviePromises]);
    }

    const topMaleActors = Object.values(actorAggregate).filter(a => a.gender === 2).sort((a, b) => b.weight - a.weight).slice(0, 5);
    const topFemaleActors = Object.values(actorAggregate).filter(a => a.gender === 1).sort((a, b) => b.weight - a.weight).slice(0, 5);
    const topNetworks = Object.values(networkAggregate).sort((a, b) => b.weight - a.weight).slice(0, 5);

    // 9. Send payload
    res.json({
      user,
      summary,
      watchedTogether,
      activity: activityArray,
      timeline,
      topShowsByCount,
      topMoviesByCount,
      topShowsByMinutes,
      topMoviesByMinutes,
      topMaleActors,
      topFemaleActors,
      topNetworks,
      hasTMDB: !!apiKey
    });

  } catch (error) {
    console.error('Stats aggregation error:', error);
    res.status(500).json({ error: 'Failed to aggregate statistics.' });
  }
});

module.exports = router;
