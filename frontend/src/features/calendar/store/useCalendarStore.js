import { create } from 'zustand';
import api from '../../../api';
import { format, addMonths, subMonths, addWeeks, subWeeks, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns';
import { sortEvents, pad } from '../utils';
import { getEventsFromIndexedDB, upsertEventsToIndexedDB } from '../../../utils/pwaHelper';

export const useCalendarStore = create((set, get) => ({
  events: [],
  loading: true,
  isOfflineMode: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  updatingInBackground: false,

  currentDate: new Date(),
  viewMode: localStorage.getItem('calendar_view_mode') || 'week',
  selectedMobileDate: new Date(),
  expandedStacks: {},

  // Filters & Options
  hideCollected: localStorage.getItem('calendar_hide_collected') === 'true',
  hideWatched: localStorage.getItem('calendar_hide_watched') === 'true',
  mediaTypeFilter: localStorage.getItem('calendar_media_type_filter') || 'all',
  mobileSwipeMode: localStorage.getItem('calendar_mobile_swipe_mode') === 'true',
  showCopyButton: localStorage.getItem('calendar_show_copy_button') !== 'false',

  // Basic Setters
  setCurrentDate: (date) => set({ currentDate: date }),
  setViewMode: (mode) => {
    localStorage.setItem('calendar_view_mode', mode);
    set({ viewMode: mode });
  },
  setSelectedMobileDate: (date) => set({ selectedMobileDate: date }),
  setIsOfflineMode: (status) => set({ isOfflineMode: status }),
  toggleStackExpand: (id) => set(state => ({
    expandedStacks: { ...state.expandedStacks, [id]: !state.expandedStacks[id] }
  })),
  setHideCollected: (val) => {
    localStorage.setItem('calendar_hide_collected', val);
    set({ hideCollected: val });
  },
  setHideWatched: (val) => {
    localStorage.setItem('calendar_hide_watched', val);
    set({ hideWatched: val });
  },
  setMediaTypeFilter: (val) => {
    localStorage.setItem('calendar_media_type_filter', val);
    set({ mediaTypeFilter: val });
  },
  setMobileSwipeMode: (val) => {
    localStorage.setItem('calendar_mobile_swipe_mode', val);
    set({ mobileSwipeMode: val });
  },
  setShowCopyButton: (val) => {
    localStorage.setItem('calendar_show_copy_button', val);
    set({ showCopyButton: val });
  },

  // Navigation
  navigateDate: (direction) => {
    const { viewMode, currentDate } = get();
    if (viewMode === 'month') {
      set({ currentDate: direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1) });
    } else {
      set({ currentDate: direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1) });
    }
  },

  // Fetch Events
  fetchEvents: async () => {
    const { currentDate, viewMode } = get();
    
    let start, end;
    let gridStart, gridEnd;
    
    if (viewMode === 'month') {
      const startMonth = startOfMonth(currentDate);
      const endMonth = endOfMonth(currentDate);
      gridStart = startOfWeek(startMonth, { weekStartsOn: 1 });
      gridEnd = endOfWeek(endMonth, { weekStartsOn: 1 });

      start = format(gridStart, 'yyyy-MM-dd');
      end = format(gridEnd, 'yyyy-MM-dd');
    } else {
      gridStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      gridEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

      start = format(gridStart, 'yyyy-MM-dd');
      end = format(gridEnd, 'yyyy-MM-dd');
    }

    const startMinus1 = format(subDays(gridStart, 1), 'yyyy-MM-dd');
    const endPlus1 = format(addDays(gridEnd, 1), 'yyyy-MM-dd');

    let hasCache = false;
    try {
      const cached = await getEventsFromIndexedDB(startMinus1, endPlus1);
      if (cached && cached.length > 0) {
        set({ events: sortEvents(cached), loading: false, updatingInBackground: true });
        hasCache = true;
      }
    } catch (cacheErr) {
      console.warn('[PWA] Error reading calendar cache:', cacheErr);
    }

    if (!hasCache) {
      set({ loading: true, updatingInBackground: false });
    }

    try {
      const res = await api.get(`/calendar?start=${start}&end=${end}`);
      set({ events: sortEvents(res.data), isOfflineMode: false });
      await upsertEventsToIndexedDB(res.data);
    } catch (netErr) {
      console.warn('[PWA] Failed to fetch calendar from network, falling back to IndexedDB:', netErr);
      set({ isOfflineMode: true });
      if (!hasCache) {
        const cached = await getEventsFromIndexedDB(startMinus1, endPlus1);
        if (cached && cached.length > 0) {
          set({ events: sortEvents(cached) });
        } else {
          set({ events: [] });
        }
      }
    } finally {
      set({ loading: false, updatingInBackground: false });
    }
  },

  // Toggle Collection
  toggleCollect: async (ev) => {
    const isTV = ev.type === 'tv';
    const newVal = !ev.isCollected;

    try {
      if (isTV) {
        if (ev.isStacked) {
          await Promise.all(ev.originalEpisodes.map(subEv =>
            api.post('/media/episode/collect', {
              tmdbId: subEv.tmdbId,
              season: subEv.seasonNumber,
              episode: subEv.episodeNumber,
              collected: newVal,
              title: subEv.showTitle,
              posterPath: subEv.showPoster
            })
          ));
        } else {
          await api.post('/media/episode/collect', {
            tmdbId: ev.tmdbId,
            season: ev.seasonNumber,
            episode: ev.episodeNumber,
            collected: newVal,
            title: ev.showTitle,
            posterPath: ev.showPoster
          });
        }
      } else {
        await api.post('/media/collect', {
          tmdbId: ev.tmdbId,
          type: 'movie',
          title: ev.title,
          posterPath: ev.posterPath,
          remove: ev.isCollected
        });
      }

      // Update local state
      const subIds = ev.isStacked ? ev.originalEpisodes.map(sub => sub.id) : [ev.id];
      set(state => ({
        events: state.events.map(e => subIds.includes(e.id) ? { ...e, isCollected: newVal } : e)
      }));
      return { success: true, newVal, title: isTV ? ev.showTitle : ev.title };
    } catch (err) {
      console.error('Failed to toggle collection status:', err);
      return { success: false, error: err };
    }
  },

  // Update Watch Status directly (for Modal/Direct calls)
  updateWatchStatus: async (choice, watchedAt, activeWatchEvent) => {
    if (!activeWatchEvent) return { success: false };
    const ev = activeWatchEvent;
    const isTV = ev.type === 'tv';

    try {
      if (choice === 'watching-now') {
        const target = isTV && ev.isStacked ? ev.originalEpisodes[0] : ev;
        await api.post('/media/active-session', {
          tmdbId: target.tmdbId,
          type: isTV ? 'episode' : 'movie',
          title: isTV ? target.title || `Ep ${target.episodeNumber}` : target.title,
          overview: target.overview,
          releaseDate: isTV ? (target.airDateTime || target.airDate) : target.releaseDate,
          posterPath: isTV ? target.showPoster : target.posterPath,
          season: isTV ? target.seasonNumber : undefined,
          episode: isTV ? target.episodeNumber : undefined,
          grandparentTitle: isTV ? target.showTitle : undefined,
          parentTitle: isTV ? `Season ${target.seasonNumber}` : undefined
        });
        return { success: true, message: 'Started watching now', type: 'info' };
      } else if (choice === 'removed-last') {
        const subIds = ev.isStacked ? ev.originalEpisodes.map(sub => sub.id) : [ev.id];
        set(state => ({
          events: state.events.map(e => subIds.includes(e.id) ? { ...e, isWatched: watchedAt } : e)
        }));
        return { success: true, message: `Removed watch entry for "${isTV ? ev.showTitle : ev.title}"`, type: 'info' };
      } else {
        if (isTV) {
          if (ev.isStacked) {
            await Promise.all(ev.originalEpisodes.map(subEv =>
              api.post('/media/episode/watch', {
                tmdbId: subEv.tmdbId,
                season: subEv.seasonNumber,
                episode: subEv.episodeNumber,
                watched: true,
                title: subEv.showTitle,
                posterPath: subEv.showPoster,
                watchedAt
              })
            ));
          } else {
            await api.post('/media/episode/watch', {
              tmdbId: ev.tmdbId,
              season: ev.seasonNumber,
              episode: ev.episodeNumber,
              watched: true,
              title: ev.showTitle,
              posterPath: ev.showPoster,
              watchedAt
            });
          }
        } else {
          await api.post('/media/watch', {
            tmdbId: ev.tmdbId,
            type: 'movie',
            title: ev.title,
            posterPath: ev.posterPath,
            watchedAt
          });
        }

        const subIds = ev.isStacked ? ev.originalEpisodes.map(sub => sub.id) : [ev.id];
        set(state => ({
          events: state.events.map(e => subIds.includes(e.id) ? { ...e, isWatched: true } : e)
        }));
        return { success: true, message: `Watched "${isTV ? ev.showTitle : ev.title}"`, type: 'success' };
      }
    } catch (err) {
      console.error('Failed to log watch history:', err);
      return { success: false, message: 'Failed to update watch status', type: 'error' };
    }
  }
}));
