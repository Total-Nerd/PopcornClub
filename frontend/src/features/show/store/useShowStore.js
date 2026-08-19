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

  // New states for refactor
  lists: [],
  listMemberships: {},
  activeTrailerKey: null,
  showRawModal: false,
  correctMode: false,
  correctingFiles: [],
  correctTitle: '',
  correctYear: '',
  correctId: '',
  modalError: '',
  correcting: false,
  rawData: null,

  setShowDetails: (detailsOrUpdater) => set((state) => ({
    showDetails: typeof detailsOrUpdater === 'function' ? detailsOrUpdater(state.showDetails) : detailsOrUpdater
  })),
  setLoadingDetails: (loading) => set({ loadingDetails: loading }),
  setActiveSeason: (seasonNumber) => set({ activeSeason: seasonNumber }),
  setSeasonEpisodes: (episodesOrUpdater) => set((state) => ({
    seasonEpisodes: typeof episodesOrUpdater === 'function' ? episodesOrUpdater(state.seasonEpisodes) : episodesOrUpdater
  })),
  setIsSeasonDropdownOpen: (isOpen) => set({ isSeasonDropdownOpen: isOpen }),
  setExpandedEpisodes: (expanded) => set({ expandedEpisodes: expanded }),

  setLists: (lists) => set({ lists }),
  setListMemberships: (memberships) => set({ listMemberships: memberships }),
  setActiveTrailerKey: (key) => set({ activeTrailerKey: key }),
  setShowRawModal: (show) => set({ showRawModal: show }),
  setCorrectMode: (mode) => set({ correctMode: mode }),
  setCorrectingFiles: (files) => set({ correctingFiles: files }),
  setCorrectTitle: (title) => set({ correctTitle: title }),
  setCorrectYear: (year) => set({ correctYear: year }),
  setCorrectId: (id) => set({ correctId: id }),
  setModalError: (error) => set({ modalError: error }),
  setCorrecting: (correcting) => set({ correcting }),
  setRawData: (data) => set({ rawData: data }),

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
  },

  fetchLists: async (tmdbId) => {
    try {
      const [res, sharedRes] = await Promise.all([
        api.get('/lists'),
        api.get('/lists/shared-with-me').catch(() => ({ data: [] }))
      ]);
      
      const ownLists = res.data;
      const collaborativeSharedLists = (sharedRes.data || []).filter(l => l.allowOthersToAdd);
      const combinedLists = [...ownLists, ...collaborativeSharedLists];
      
      const uniqueListsMap = new Map();
      combinedLists.forEach(l => uniqueListsMap.set(l.id, l));
      const uniqueLists = Array.from(uniqueListsMap.values());

      set({ lists: uniqueLists });

      const memberships = {};
      for (const list of uniqueLists) {
        const itemInList = (list.items || []).find(item => item.media && item.media.tmdbId === parseInt(tmdbId, 10));
        if (itemInList) {
          memberships[list.id] = { listItemId: itemInList.id, mediaId: itemInList.media.id };
        }
      }
      set({ listMemberships: memberships });
    } catch (err) {
      console.error('Failed to fetch lists:', err);
    }
  },

  handleToggleList: async (listId, tmdbId, showAlert) => {
    try {
      const state = get();
      const current = state.listMemberships[listId];
      if (current) {
        const mediaId = current.mediaId || state.showDetails?.localId || state.showDetails?.id;
        await api.delete(`/lists/${listId}/items/${mediaId}`);
        set((prevState) => {
          const updated = { ...prevState.listMemberships };
          delete updated[listId];
          return { listMemberships: updated };
        });
      } else {
        const payload = {
          tmdbId: parseInt(tmdbId, 10),
          type: 'tv',
          title: state.showDetails?.name,
          overview: state.showDetails?.overview,
          releaseDate: state.showDetails?.first_air_date,
          posterPath: state.showDetails?.poster_path
        };
        const res = await api.post(`/lists/${listId}/items`, payload);

        set((prevState) => ({
          listMemberships: {
            ...prevState.listMemberships,
            [listId]: { listItemId: res.data.id, mediaId: res.data.mediaId }
          }
        }));
      }
    } catch (err) {
      if (showAlert) showAlert(`Failed to toggle list: ${err.response?.data?.error || err.message}`, 'error');
    }
  },

  fetchRawData: async (tmdbId) => {
    try {
      const res = await api.get(`/media/raw/tv/${tmdbId}`);
      set({ rawData: res.data });
    } catch (err) {
      set({ modalError: err.response?.data?.error || 'Failed to fetch raw media data.' });
    }
  }
}));
