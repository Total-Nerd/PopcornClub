import { create } from 'zustand';
import api from '../../../api';

export const useStatsStore = create((set, get) => ({
  loading: true,
  error: null,
  stats: null,

  // Filters
  mediaTypeFilter: 'all', // 'all', 'shows', 'movies'
  timeRangeFilter: 'year', // 'week', 'month', 'year', 'all'
  watchedTogetherChartType: 'pie', // 'pie', 'bar'
  heatmapTooltip: null,

  setMediaTypeFilter: (filter) => set({ mediaTypeFilter: filter }),
  setTimeRangeFilter: (filter) => set({ timeRangeFilter: filter }),
  setWatchedTogetherChartType: (type) => set({ watchedTogetherChartType: type }),
  setHeatmapTooltip: (tooltip) => set({ heatmapTooltip: tooltip }),

  // Derived properties helpers
  getActiveSummary: () => {
    const { stats, mediaTypeFilter } = get();
    const currentSummary = stats?.summary || { movieCount: 0, episodeCount: 0, totalMinutes: 0, movieMinutes: 0, tvMinutes: 0 };
    
    let activePlayCount = 0;
    let activeMinutes = 0;
    if (mediaTypeFilter === 'all') {
      activePlayCount = currentSummary.movieCount + currentSummary.episodeCount;
      activeMinutes = currentSummary.totalMinutes;
    } else if (mediaTypeFilter === 'shows') {
      activePlayCount = currentSummary.episodeCount;
      activeMinutes = currentSummary.tvMinutes;
    } else {
      activePlayCount = currentSummary.movieCount;
      activeMinutes = currentSummary.movieMinutes;
    }

    return {
      currentSummary,
      activePlayCount,
      activeMinutes
    };
  },

  fetchStats: async (username) => {
    const { timeRangeFilter } = get();
    set({ loading: true, error: null });
    try {
      const res = await api.get(`/stats/${username}?range=${timeRangeFilter}`);
      set({ stats: res.data, loading: false });
    } catch (err) {
      console.error('Failed to fetch statistics:', err);
      set({ 
        error: err.response?.data?.error || 'Failed to load stats dashboard.',
        loading: false 
      });
    }
  }
}));
