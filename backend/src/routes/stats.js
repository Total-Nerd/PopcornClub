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

    // 3. Fetch all watch history logs for this user
    const logs = await prisma.watchHistoryLog.findMany({
      where: { userId: user.id },
      include: {
        media: true
      },
      orderBy: { watchedAt: 'asc' }
    });

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // 4. Summaries helper
    const getSummaryForRange = (startDate) => {
      let filteredLogs = logs;
      if (startDate) {
        filteredLogs = logs.filter(l => l.watchedAt >= startDate);
      }

      let movieCount = 0;
      let tvCount = 0;
      let movieSeconds = 0;
      let tvSeconds = 0;

      filteredLogs.forEach(log => {
        if (log.type === 'movie') {
          movieCount++;
          movieSeconds += log.viewOffset;
        } else {
          tvCount++;
          tvSeconds += log.viewOffset;
        }
      });

      return {
        movieCount,
        episodeCount: tvCount,
        movieMinutes: Math.round(movieSeconds / 60),
        tvMinutes: Math.round(tvSeconds / 60),
        totalMinutes: Math.round((movieSeconds + tvSeconds) / 60)
      };
    };

    const summaries = {
      week: getSummaryForRange(oneWeekAgo),
      month: getSummaryForRange(oneMonthAgo),
      year: getSummaryForRange(oneYearAgo),
      all: getSummaryForRange(null)
    };

    // 5. GitHub contribution graph data (last 365 days)
    const activityByDate = {};
    for (let i = 365; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      activityByDate[dateStr] = { tv: 0, movie: 0, total: 0 };
    }

    logs.forEach(log => {
      const dateStr = log.watchedAt.toISOString().split('T')[0];
      if (activityByDate[dateStr] !== undefined) {
        if (log.type === 'tv') {
          activityByDate[dateStr].tv++;
        } else {
          activityByDate[dateStr].movie++;
        }
        activityByDate[dateStr].total++;
      }
    });

    // Convert map to array of { date, tv, movie, total }
    const activityArray = Object.keys(activityByDate).map(date => ({
      date,
      ...activityByDate[date]
    })).sort((a, b) => a.date.localeCompare(b.date));

    // 6. Line chart timeline data
    // 1 Week (daily)
    const weekTimeline = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const dayLogs = logs.filter(l => l.watchedAt.toISOString().split('T')[0] === dateStr);
      weekTimeline.push({
        label: formatDateLabel(d, 'day'),
        shows: dayLogs.filter(l => l.type === 'tv').length,
        movies: dayLogs.filter(l => l.type === 'movie').length,
        total: dayLogs.length
      });
    }

    // 1 Month (daily)
    const monthTimeline = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const dayLogs = logs.filter(l => l.watchedAt.toISOString().split('T')[0] === dateStr);
      monthTimeline.push({
        label: formatDateLabel(d, 'day'),
        shows: dayLogs.filter(l => l.type === 'tv').length,
        movies: dayLogs.filter(l => l.type === 'movie').length,
        total: dayLogs.length
      });
    }

    // 1 Year (monthly)
    const yearTimeline = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthLogs = logs.filter(l => l.watchedAt.getFullYear() === year && l.watchedAt.getMonth() === month);
      yearTimeline.push({
        label: formatDateLabel(d, 'month'),
        shows: monthLogs.filter(l => l.type === 'tv').length,
        movies: monthLogs.filter(l => l.type === 'movie').length,
        total: monthLogs.length
      });
    }

    // All Time (monthly)
    const allTimeline = [];
    if (logs.length > 0) {
      const firstDate = logs[0].watchedAt;
      const totalMonths = (now.getFullYear() - firstDate.getFullYear()) * 12 + (now.getMonth() - firstDate.getMonth()) + 1;
      // Cap at 60 months (5 years) to avoid huge charts, or group by month anyway
      const displayMonths = Math.min(totalMonths, 60);
      for (let i = displayMonths - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = d.getMonth();
        const monthLogs = logs.filter(l => l.watchedAt.getFullYear() === year && l.watchedAt.getMonth() === month);
        allTimeline.push({
          label: formatDateLabel(d, 'month'),
          shows: monthLogs.filter(l => l.type === 'tv').length,
          movies: monthLogs.filter(l => l.type === 'movie').length,
          total: monthLogs.length
        });
      }
    }

    const timelines = {
      week: weekTimeline,
      month: monthTimeline,
      year: yearTimeline,
      all: allTimeline
    };

    // 7. Aggregate Top Shows & Movies (by Count and Minutes)
    const mediaAggregates = {};
    logs.forEach(log => {
      if (!mediaAggregates[log.mediaId]) {
        mediaAggregates[log.mediaId] = {
          media: log.media,
          count: 0,
          viewOffsetSum: 0
        };
      }
      mediaAggregates[log.mediaId].count++;
      mediaAggregates[log.mediaId].viewOffsetSum += log.viewOffset;
    });

    const tvAggregates = Object.values(mediaAggregates).filter(a => a.media.type === 'tv');
    const movieAggregates = Object.values(mediaAggregates).filter(a => a.media.type === 'movie');

    // Top 5 Shows (by Play Count)
    const topShowsByCount = [...tvAggregates]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(a => ({
        id: a.media.id,
        tmdbId: a.media.tmdbId,
        title: a.media.title,
        posterPath: a.media.posterPath,
        backdropPath: a.media.backdropPath,
        count: a.count,
        minutes: Math.round(a.viewOffsetSum / 60)
      }));

    // Top 5 Movies (by Play Count)
    const topMoviesByCount = [...movieAggregates]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(a => ({
        id: a.media.id,
        tmdbId: a.media.tmdbId,
        title: a.media.title,
        posterPath: a.media.posterPath,
        backdropPath: a.media.backdropPath,
        count: a.count,
        minutes: Math.round(a.viewOffsetSum / 60)
      }));

    // Most Watched Show and Movie by Minutes
    const topShowsByMinutes = [...tvAggregates]
      .sort((a, b) => b.viewOffsetSum - a.viewOffsetSum)
      .slice(0, 5)
      .map(a => ({
        id: a.media.id,
        tmdbId: a.media.tmdbId,
        title: a.media.title,
        posterPath: a.media.posterPath,
        backdropPath: a.media.backdropPath,
        count: a.count,
        minutes: Math.round(a.viewOffsetSum / 60)
      }));

    const topMoviesByMinutes = [...movieAggregates]
      .sort((a, b) => b.viewOffsetSum - a.viewOffsetSum)
      .slice(0, 5)
      .map(a => ({
        id: a.media.id,
        tmdbId: a.media.tmdbId,
        title: a.media.title,
        posterPath: a.media.posterPath,
        backdropPath: a.media.backdropPath,
        count: a.count,
        minutes: Math.round(a.viewOffsetSum / 60)
      }));

    // 8. TMDB Meta Aggregations: Actors and Networks
    // Fetch actor & network metadata from top 15 shows/movies to construct cast & network counts
    const actorAggregate = {};
    const networkAggregate = {};

    if (apiKey) {
      const topTvForCredits = [...tvAggregates].sort((a, b) => b.count - a.count).slice(0, 15);
      const topMovieForCredits = [...movieAggregates].sort((a, b) => b.count - a.count).slice(0, 15);

      // Process TV Shows (Cast + Networks)
      for (const showAgg of topTvForCredits) {
        const { tmdbId, title } = showAgg.media;
        const watchWeight = showAgg.count; // Weight by episode play count

        // A. Resolve TV Show Networks
        try {
          const showDetails = await fetchTMDB(`/3/tv/${tmdbId}`, apiKey);
          if (showDetails && showDetails.networks) {
            showDetails.networks.forEach(net => {
              if (!networkAggregate[net.id]) {
                networkAggregate[net.id] = {
                  id: net.id,
                  name: net.name,
                  logoPath: net.logo_path,
                  weight: 0
                };
              }
              networkAggregate[net.id].weight += watchWeight;
            });
          }
        } catch (err) {
          console.warn(`[Stats] Failed to fetch TMDB details for TV show "${title}" (${tmdbId}):`, err.message);
        }

        // B. Resolve TV Show Credits (Actors)
        try {
          const credits = await fetchTMDB(`/3/tv/${tmdbId}/credits`, apiKey);
          if (credits && credits.cast) {
            // Process top 10 billed actors
            credits.cast.slice(0, 10).forEach(castMember => {
              const { id, name, gender, profile_path } = castMember;
              if (gender === 1 || gender === 2) { // 1 = Female, 2 = Male
                if (!actorAggregate[id]) {
                  actorAggregate[id] = {
                    id,
                    name,
                    gender,
                    profilePath: profile_path,
                    weight: 0
                  };
                }
                actorAggregate[id].weight += watchWeight;
              }
            });
          }
        } catch (err) {
          console.warn(`[Stats] Failed to fetch TMDB credits for TV show "${title}" (${tmdbId}):`, err.message);
        }
      }

      // Process Movies (Cast only)
      for (const movieAgg of topMovieForCredits) {
        const { tmdbId, title } = movieAgg.media;
        const watchWeight = movieAgg.count; // Weight by movie watch count

        try {
          const credits = await fetchTMDB(`/3/movie/${tmdbId}/credits`, apiKey);
          if (credits && credits.cast) {
            // Process top 10 billed actors
            credits.cast.slice(0, 10).forEach(castMember => {
              const { id, name, gender, profile_path } = castMember;
              if (gender === 1 || gender === 2) {
                if (!actorAggregate[id]) {
                  actorAggregate[id] = {
                    id,
                    name,
                    gender,
                    profilePath: profile_path,
                    weight: 0
                  };
                }
                actorAggregate[id].weight += watchWeight;
              }
            });
          }
        } catch (err) {
          console.warn(`[Stats] Failed to fetch TMDB credits for movie "${title}" (${tmdbId}):`, err.message);
        }
      }
    }

    // Sort and slice Top 5 Male Actors (gender = 2)
    const topMaleActors = Object.values(actorAggregate)
      .filter(a => a.gender === 2)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);

    // Sort and slice Top 5 Female Actors (gender = 1)
    const topFemaleActors = Object.values(actorAggregate)
      .filter(a => a.gender === 1)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);

    // Sort and slice Top 5 Networks
    const topNetworks = Object.values(networkAggregate)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);

    // 9. Send payload
    res.json({
      user,
      summaries,
      activity: activityArray,
      timelines,
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
