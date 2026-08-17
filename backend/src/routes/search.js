const express = require('express');
const axios = require('axios');
const prisma = require('../prismaClient');
const { authenticateToken } = require('../middleware/auth');
const { fetchTMDB } = require('../utils/tmdb');
const { enrichMediaItems } = require('../services/mediaService');

const router = express.Router();
router.use(authenticateToken);

router.get('/discover', async (req, res) => {
  const type = req.query.type || 'all'; // all, movie, tv
  const filterForeign = req.query.includeForeign !== 'true';
  
  try {
    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    if (!systemSettings || !systemSettings.tmdbApiKey) {
      return res.status(400).json({ error: 'TMDB API Key is not configured' });
    }
    const apiKey = systemSettings.tmdbApiKey;

    let upcomingPromise, popularPromise, bestRatedPromise;

    const processResults = (data, mediaType, { isUpcoming = false } = {}) => {
      let results = data.results || [];
      if (filterForeign) {
        results = results.filter(item => item.original_language === 'en');
      }
      if (isUpcoming && mediaType === 'movie') {
        const minDate = new Date();
        minDate.setMonth(minDate.getMonth() - 6); // Allow movies up to 6 months old
        results = results.filter(item => {
          if (!item.release_date) return false;
          return new Date(item.release_date) >= minDate;
        });
      }
      return results.map(item => ({ ...item, media_type: mediaType }));
    };

    if (type === 'movie') {
      upcomingPromise = fetchTMDB('/3/movie/upcoming', apiKey)
        .then(data => processResults(data, 'movie', { isUpcoming: true }));
      popularPromise = fetchTMDB('/3/movie/popular', apiKey)
        .then(data => processResults(data, 'movie'));
      bestRatedPromise = fetchTMDB('/3/movie/top_rated', apiKey)
        .then(data => processResults(data, 'movie'));
    } else if (type === 'tv') {
      upcomingPromise = fetchTMDB('/3/tv/on_the_air', apiKey)
        .then(data => processResults(data, 'tv', { isUpcoming: true }));
      popularPromise = fetchTMDB('/3/tv/popular', apiKey)
        .then(data => processResults(data, 'tv'));
      bestRatedPromise = fetchTMDB('/3/tv/top_rated', apiKey)
        .then(data => processResults(data, 'tv'));
    } else {
      // all
      upcomingPromise = Promise.all([
        fetchTMDB('/3/movie/upcoming', apiKey).then(data => processResults(data, 'movie', { isUpcoming: true })),
        fetchTMDB('/3/tv/on_the_air', apiKey).then(data => processResults(data, 'tv', { isUpcoming: true }))
      ]).then(([movies, tv]) => {
        const combined = [...movies, ...tv];
        combined.sort((a, b) => {
          const dateA = new Date(a.release_date || a.first_air_date || 0);
          const dateB = new Date(b.release_date || b.first_air_date || 0);
          return dateB - dateA;
        });
        return combined.slice(0, 20);
      });

      popularPromise = Promise.all([
        fetchTMDB('/3/movie/popular', apiKey).then(data => processResults(data, 'movie')),
        fetchTMDB('/3/tv/popular', apiKey).then(data => processResults(data, 'tv'))
      ]).then(([movies, tv]) => {
        const combined = [...movies, ...tv];
        combined.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        return combined.slice(0, 20);
      });

      bestRatedPromise = Promise.all([
        fetchTMDB('/3/movie/top_rated', apiKey).then(data => processResults(data, 'movie')),
        fetchTMDB('/3/tv/top_rated', apiKey).then(data => processResults(data, 'tv'))
      ]).then(([movies, tv]) => {
        const combined = [...movies, ...tv];
        combined.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        return combined.slice(0, 20);
      });
    }

    const [upcoming, popular, bestRated] = await Promise.all([
      upcomingPromise,
      popularPromise,
      bestRatedPromise
    ]);

    const [enrichedUpcoming, enrichedPopular, enrichedBestRated] = await Promise.all([
      enrichMediaItems(upcoming, req.user.id),
      enrichMediaItems(popular, req.user.id),
      enrichMediaItems(bestRated, req.user.id)
    ]);

    res.json({
      upcoming: enrichedUpcoming,
      popular: enrichedPopular,
      bestRated: enrichedBestRated
    });

  } catch (error) {
    console.error('TMDB Discover Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch discover data from TMDB' });
  }
});

// Search TMDB
router.get('/search', async (req, res) => {
  const { query, type } = req.query;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  try {
    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    if (!systemSettings || !systemSettings.tmdbApiKey) {
      return res.status(400).json({ error: 'TMDB API Key is not configured' });
    }

    let results = [];
    const searchType = type || 'all';

    if (searchType === 'movie') {
      const response = await axios.get(`https://api.themoviedb.org/3/search/movie`, {
        params: {
          api_key: systemSettings.tmdbApiKey,
          query,
          page: 1,
          include_adult: false
        }
      });
      results = (response.data.results || []).map(item => ({ ...item, media_type: 'movie' }));
    } else if (searchType === 'tv') {
      const response = await axios.get(`https://api.themoviedb.org/3/search/tv`, {
        params: {
          api_key: systemSettings.tmdbApiKey,
          query,
          page: 1,
          include_adult: false
        }
      });
      results = (response.data.results || []).map(item => ({ ...item, media_type: 'tv' }));
    } else {
      const response = await axios.get(`https://api.themoviedb.org/3/search/multi`, {
        params: {
          api_key: systemSettings.tmdbApiKey,
          query,
          page: 1,
          include_adult: false
        }
      });
      results = (response.data.results || []).filter(item => item.media_type === 'movie' || item.media_type === 'tv');
    }
    
    const enrichedResults = await enrichMediaItems(results, req.user.id);
    res.json(enrichedResults);
  } catch (error) {
    console.error('TMDB Search Error:', error.message);
    res.status(500).json({ error: 'Failed to search TMDB' });
  }
});


module.exports = router;
