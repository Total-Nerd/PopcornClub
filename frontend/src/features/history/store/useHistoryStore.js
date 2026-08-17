import { create } from 'zustand';
import api from '../../../api';

export const useHistoryStore = create((set, get) => ({
  // Data State
  logs: [],
  availableGenres: [],
  loading: true,
  page: 1,
  totalPages: 1,
  totalCount: 0,
  usersList: [],
  selectedUserId: '',
  activeSession: null,

  // Selection & Share State
  selectedLogIds: [],
  activeShareLogIds: [],
  shareableUsers: [],
  coViewerUsers: [],
  isShareModalOpen: false,
  selectedTargetUserIds: [],
  isSubmittingShare: false,

  // Filters State
  isFilterOpen: false,
  type: 'all',
  searchQuery: '',
  debouncedSearch: '',
  startDate: '',
  endDate: '',
  selectedGenre: '',
  includePartial: true,
  mediaIdFilter: '',
  tmdbIdFilter: '',
  mediaTitle: '',
  seasonFilter: '',
  episodeFilter: '',
  watchedWithFilter: [],

  // Display Options
  showPosters: true,
  limit: 20,
  pageInput: '1',

  // Actions
  initFilters: (searchParams) => {
    const savedPartial = localStorage.getItem('history_include_partial');
    const savedPosters = localStorage.getItem('history_show_posters');
    const savedLimit = localStorage.getItem('history_limit');

    set({
      type: searchParams.get('type') || 'all',
      searchQuery: searchParams.get('search') || '',
      debouncedSearch: searchParams.get('search') || '',
      seasonFilter: searchParams.get('season') || '',
      episodeFilter: searchParams.get('episode') || '',
      mediaIdFilter: searchParams.get('mediaId') || '',
      tmdbIdFilter: searchParams.get('tmdbId') || '',
      mediaTitle: searchParams.get('title') || '',
      includePartial: savedPartial !== null ? JSON.parse(savedPartial) : true,
      showPosters: savedPosters !== null ? JSON.parse(savedPosters) : true,
      limit: savedLimit !== null ? parseInt(savedLimit, 10) : 20
    });
  },

  setFilter: (key, value) => {
    set({ [key]: value });
    if (key !== 'isFilterOpen' && key !== 'showPosters') {
      set({ page: 1, pageInput: '1' });
    }
    
    if (key === 'includePartial') {
      localStorage.setItem('history_include_partial', JSON.stringify(value));
    }
    if (key === 'showPosters') {
      localStorage.setItem('history_show_posters', JSON.stringify(value));
    }
    if (key === 'limit') {
      localStorage.setItem('history_limit', String(value));
    }
  },

  setFilters: (filters) => {
    set({ ...filters, page: 1, pageInput: '1' });
  },

  toggleFilterOpen: () => set(state => ({ isFilterOpen: !state.isFilterOpen })),

  setPageInput: (val) => set({ pageInput: val }),
  
  handlePageJumpSubmit: () => {
    const { pageInput, totalPages } = get();
    let targetPage = parseInt(pageInput, 10);
    if (isNaN(targetPage) || targetPage < 1) targetPage = 1;
    else if (targetPage > totalPages) targetPage = totalPages;
    set({ page: targetPage, pageInput: String(targetPage) });
  },

  resetFilters: (searchParamsSetter) => {
    set({
      type: 'all',
      searchQuery: '',
      debouncedSearch: '',
      startDate: '',
      endDate: '',
      selectedGenre: '',
      includePartial: true,
      mediaIdFilter: '',
      tmdbIdFilter: '',
      mediaTitle: '',
      seasonFilter: '',
      episodeFilter: '',
      selectedUserId: '',
      watchedWithFilter: [],
      page: 1,
      pageInput: '1'
    });
    if (searchParamsSetter) searchParamsSetter({});
  },

  // API Calls
  fetchShareableUsers: async () => {
    try {
      const res = await api.get('/media/users/shareable');
      set({ shareableUsers: Array.isArray(res.data) ? res.data : res.data?.users || [] });
    } catch (err) {
      console.error('Failed to load shareable users:', err);
    }
  },

  fetchCoViewers: async () => {
    try {
      const { selectedUserId } = get();
      const url = selectedUserId ? `/media/users/co-viewers?userId=${selectedUserId}` : '/media/users/co-viewers';
      const res = await api.get(url);
      set({ coViewerUsers: Array.isArray(res.data) ? res.data : res.data?.users || [] });
    } catch (err) {
      console.error('Failed to load co-viewers:', err);
    }
  },

  fetchUsers: async () => {
    try {
      const res = await api.get('/settings/users');
      set({ usersList: res.data });
    } catch (err) {
      console.error('Failed to load users for history filtering:', err);
    }
  },

  fetchLogs: async () => {
    const state = get();
    set({ loading: true });
    try {
      const res = await api.get('/media/watch-history', {
        params: {
          page: state.page,
          limit: state.limit,
          type: state.type,
          includePartial: state.includePartial,
          search: state.debouncedSearch,
          startDate: state.startDate,
          endDate: state.endDate,
          genre: state.selectedGenre,
          mediaId: state.mediaIdFilter || undefined,
          tmdbId: state.tmdbIdFilter || undefined,
          season: state.seasonFilter || undefined,
          episode: state.episodeFilter || undefined,
          userId: state.selectedUserId || undefined,
          watchedWithUserIds: state.watchedWithFilter.length > 0 ? state.watchedWithFilter.join(',') : undefined
        }
      });
      set({
        logs: res.data.logs,
        activeSession: res.data.activeSession || null,
        availableGenres: res.data.genres || [],
        totalPages: res.data.pagination.pages,
        totalCount: res.data.pagination.total
      });
    } catch (err) {
      console.error('Failed to fetch watch history logs:', err);
    } finally {
      set({ loading: false });
    }
  },

  // Log Actions
  toggleLogSelection: (id) => {
    set(state => {
      const isSelected = state.selectedLogIds.includes(id);
      return {
        selectedLogIds: isSelected 
          ? state.selectedLogIds.filter(x => x !== id) 
          : [...state.selectedLogIds, id]
      };
    });
  },

  selectAllLogs: () => {
    set(state => ({
      selectedLogIds: state.logs.map(l => l.id)
    }));
  },

  clearLogSelection: () => {
    set({ selectedLogIds: [] });
  },

  deleteLog: async (id) => {
    await api.delete(`/media/watch-history/${id}`);
    set(state => ({
      selectedLogIds: state.selectedLogIds.filter(item => item !== id)
    }));
    await get().fetchLogs();
  },

  bulkDeleteLogs: async () => {
    const { selectedLogIds } = get();
    await api.post('/media/watch-history/delete-bulk', { logIds: selectedLogIds });
    set({ selectedLogIds: [] });
    await get().fetchLogs();
  },

  // Share Actions
  openShareModal: (idsToShare) => {
    const { logs } = get();
    set({ activeShareLogIds: idsToShare });
    
    if (idsToShare.length === 1) {
      const log = logs.find(l => l.id === idsToShare[0]);
      if (log && log.watchedWithUsers) {
        set({ selectedTargetUserIds: log.watchedWithUsers.map(u => u.id) });
      } else {
        set({ selectedTargetUserIds: [] });
      }
    } else {
      set({ selectedTargetUserIds: [] });
    }
    
    set({ isShareModalOpen: true });
  },

  closeShareModal: () => {
    set({ isShareModalOpen: false, activeShareLogIds: [], selectedTargetUserIds: [] });
  },

  toggleTargetUser: (id) => {
    set(state => {
      const isSelected = state.selectedTargetUserIds.includes(id);
      return {
        selectedTargetUserIds: isSelected
          ? state.selectedTargetUserIds.filter(x => x !== id)
          : [...state.selectedTargetUserIds, id]
      };
    });
  },

  submitShare: async () => {
    const { selectedTargetUserIds, shareableUsers, activeShareLogIds } = get();
    set({ isSubmittingShare: true });
    
    try {
      const usersToAdd = selectedTargetUserIds;
      const usersToRemove = shareableUsers.filter(u => !selectedTargetUserIds.includes(u.id)).map(u => u.id);
      
      const promises = [];
      
      if (usersToAdd.length > 0) {
        promises.push(api.post('/media/watch-history/share-bulk', {
          logIds: activeShareLogIds,
          targetUserIds: usersToAdd
        }));
      }
      
      if (usersToRemove.length > 0) {
        promises.push(api.post('/media/watch-history/unshare-bulk', {
          logIds: activeShareLogIds,
          targetUserIds: usersToRemove
        }));
      }
      
      await Promise.all(promises);
      set({ isShareModalOpen: false, activeShareLogIds: [], selectedTargetUserIds: [] });
      await get().fetchLogs();
    } finally {
      set({ isSubmittingShare: false });
    }
  }
}));
