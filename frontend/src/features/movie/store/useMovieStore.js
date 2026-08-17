import { create } from 'zustand';
import api from '../../../api';

export const useMovieStore = create((set, get) => ({
  movieDetails: null,
  loadingDetails: true,

  // File Correction State
  showRawModal: false,
  rawData: null,
  loadingRaw: false,
  correctMode: false,
  correctingFile: null,
  correctTitle: '',
  correctYear: '',
  correctId: '',
  searchResults: [],
  searching: false,
  correcting: false,
  modalError: '',

  setMovieDetails: (detailsOrUpdater) => set((state) => {
    const nextDetails = typeof detailsOrUpdater === 'function'
      ? detailsOrUpdater(state.movieDetails)
      : detailsOrUpdater;
    return { movieDetails: nextDetails };
  }),
  setLoadingDetails: (loading) => set({ loadingDetails: loading }),

  // Setters for Correction State
  setShowRawModal: (isOpen) => set({ showRawModal: isOpen }),
  setRawData: (data) => set({ rawData: data }),
  setLoadingRaw: (loading) => set({ loadingRaw: loading }),
  setCorrectMode: (isCorrecting) => set({ correctMode: isCorrecting }),
  setCorrectingFile: (file) => set({ correctingFile: file }),
  setCorrectTitle: (title) => set({ correctTitle: title }),
  setCorrectYear: (year) => set({ correctYear: year }),
  setCorrectId: (id) => set({ correctId: id }),
  setSearchResults: (results) => set({ searchResults: results }),
  setSearching: (isSearching) => set({ searching: isSearching }),
  setCorrecting: (isCorrecting) => set({ correcting: isCorrecting }),
  setModalError: (error) => set({ modalError: error }),

  fetchMovieDetails: async (tmdbId) => {
    set({ loadingDetails: true });
    try {
      const res = await api.get(`/media/movie/${tmdbId}`);
      set({ movieDetails: res.data, loadingDetails: false });
    } catch (err) {
      console.error('Failed to fetch movie details:', err);
      set({ loadingDetails: false });
    }
  },

  fetchRawData: async (tmdbId) => {
    set({ loadingRaw: true, modalError: '' });
    try {
      const res = await api.get(`/media/raw/movie/${tmdbId}`);
      set({ rawData: res.data });
    } catch (err) {
      set({ modalError: err.response?.data?.error || 'Failed to fetch raw media data.' });
    } finally {
      set({ loadingRaw: false });
    }
  },

  handleSearchCorrection: async () => {
    const { correctTitle, correctYear } = get();
    if (!correctTitle) return;
    set({ searching: true, modalError: '' });
    try {
      const res = await api.get(`/media/search?query=${encodeURIComponent(correctTitle)}`);
      let results = res.data.filter(item => item.media_type === 'movie');
      if (correctYear) {
        results = results.filter(item => {
          const itemYear = (item.release_date || '').substring(0, 4);
          return itemYear === correctYear.trim();
        });
      }
      set({ searchResults: results });
    } catch (err) {
      set({ modalError: err.response?.data?.error || 'Search failed.' });
    } finally {
      set({ searching: false });
    }
  }
}));
