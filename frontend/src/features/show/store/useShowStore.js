import { create } from 'zustand';
import api from '../../../api'; 

export const useShowStore = create((set, get) => ({
  showDetails: null,
  loadingDetails: true,
  activeSeason: null,
  seasonEpisodes: [],
  loadingSeason: false,
  expandedEpisodes: {},
  isSeasonDropdownOpen: false,

  setShowDetails: (details) => set({ showDetails: details }),
  setLoadingDetails: (loading) => set({ loadingDetails: loading }),
  setActiveSeason: (seasonNumber) => set({ activeSeason: seasonNumber }),
  setSeasonEpisodes: (episodes) => set({ seasonEpisodes: episodes }),
  setIsSeasonDropdownOpen: (isOpen) => set({ isSeasonDropdownOpen: isOpen }),
  setExpandedEpisodes: (expanded) => set({ expandedEpisodes: expanded }),

  toggleEpisodeExpand: (episodeId) => {
    set((state) => ({
      expandedEpisodes: {
        ...state.expandedEpisodes,
        [episodeId]: !state.expandedEpisodes[episodeId]
      }
    }));
  },

  fetchShowDetails: async (tmdbId, urlSeason) => {
    set({ loadingDetails: true });
    try {
      const res = await api.get(`/media/tv/${tmdbId}`);
      const data = res.data;
      
      let seasonToSelect = urlSeason ? parseInt(urlSeason, 10) : null;
      if (seasonToSelect === null || isNaN(seasonToSelect)) {
        const defaultSeason = data.seasons?.find(s => s.season_number > 0) || data.seasons?.[0];
        seasonToSelect = defaultSeason ? defaultSeason.season_number : 1;
      }

      set({ showDetails: data, activeSeason: seasonToSelect, loadingDetails: false });
      
      // Fetch episodes for the selected season
      get().fetchSeasonEpisodes(tmdbId, seasonToSelect);
    } catch (err) {
      console.error('Failed to fetch TV details:', err);
      set({ loadingDetails: false });
    }
  },

  fetchSeasonEpisodes: async (tmdbId, seasonNumber) => {
    set({ loadingSeason: true });
    try {
      const res = await api.get(`/media/tv/${tmdbId}/season/${seasonNumber}`);
      set({ seasonEpisodes: res.data.episodes || [], loadingSeason: false });
    } catch (err) {
      console.error('Failed to fetch season episodes:', err);
      set({ seasonEpisodes: [], loadingSeason: false });
    }
  },

  handleSelectSeason: (tmdbId, seasonNumber) => {
    set({ activeSeason: seasonNumber });
    get().fetchSeasonEpisodes(tmdbId, seasonNumber);

    // Update URL query parameters without reloading
    const newUrl = `${window.location.pathname}?season=${seasonNumber}`;
    window.history.replaceState({}, '', newUrl);
  }
}));
