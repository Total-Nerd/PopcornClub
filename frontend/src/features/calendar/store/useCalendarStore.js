import { create } from 'zustand';
import api from '../../../api';
import { format, addMonths, subMonths, addWeeks, subWeeks, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { sortEvents } from '../utils';
import { getAllEventsFromIndexedDB, upsertEventsToIndexedDB, getEventDateKey } from '../../../utils/pwaHelper';

let currentFetchId = 0;
let activeAbortController = null;
const fetchedRangeTimestamps = new Map();

export const useCalendarStore = create((set, get) => ({
  events: [],
  eventsById: {},
  loading: true,
  isOfflineMode: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  updatingInBackground: false,
  isHydrated: false,

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

  // Merge events into the persistent in-memory cache
  mergeEvents: (incomingEvents, dateRange = null) => {
    if (!incomingEvents || !Array.isArray(incomingEvents)) return;

    set(state => {
      const nextMap = { ...state.eventsById };

      // Prune events in the dateRange that are no longer returned by the server
      if (dateRange && dateRange.start && dateRange.end) {
        const incomingIds = new Set(incomingEvents.map(e => e.id));
        Object.keys(nextMap).forEach(id => {
          const ev = nextMap[id];
          const dateStr = getEventDateKey(ev);
          if (dateStr >= dateRange.start && dateStr <= dateRange.end && !incomingIds.has(id)) {
            delete nextMap[id];
          }
        });
      }

      // Upsert incoming events into map
      incomingEvents.forEach(ev => {
        if (!ev || !ev.id) return;
        nextMap[ev.id] = { ...(nextMap[ev.id] || {}), ...ev };
      });

      return {
        eventsById: nextMap,
        events: sortEvents(Object.values(nextMap))
      };
    });
  },

  // Hydrate store from IndexedDB on startup
  hydrateFromCache: async () => {
    try {
      const cached = await getAllEventsFromIndexedDB();
      if (cached && cached.length > 0) {
        get().mergeEvents(cached);
        set({ isHydrated: true, loading: false });
      } else {
        set({ isHydrated: true });
      }
    } catch (err) {
      console.warn('[Calendar] Hydration error:', err);
      set({ isHydrated: true });
    }
  },

  // Fetch Events with Lookahead, In-Memory Caching & Stale-While-Revalidate
  fetchEvents: async () => {
    const { currentDate, viewMode, isHydrated } = get();

    // Ensure cache hydration has been started
    if (!isHydrated) {
      await get().hydrateFromCache();
    }

    let gridStart, gridEnd, viewStart, viewEnd;
    if (viewMode === 'month') {
      const startMonth = startOfMonth(currentDate);
      const endMonth = endOfMonth(currentDate);
      gridStart = startOfWeek(startMonth, { weekStartsOn: 1 });
      gridEnd = endOfWeek(endMonth, { weekStartsOn: 1 });
      viewStart = format(gridStart, 'yyyy-MM-dd');
      viewEnd = format(gridEnd, 'yyyy-MM-dd');
    } else {
      gridStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      gridEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      viewStart = format(gridStart, 'yyyy-MM-dd');
      viewEnd = format(gridEnd, 'yyyy-MM-dd');
    }

    // Determine if we already have events in memory for this visible range
    const currentEvents = get().events;
    const hasEventsForView = currentEvents.some(ev => {
      const d = getEventDateKey(ev);
      return d >= viewStart && d <= viewEnd;
    });

    const rangeKey = `${viewMode}-${viewStart}-${viewEnd}`;
    const lastFetch = fetchedRangeTimestamps.get(rangeKey);
    const isRecentlyFetched = lastFetch && (Date.now() - lastFetch < 60000); // 1 minute freshness

    if (hasEventsForView || isRecentlyFetched) {
      // Data already available in memory: instant display, background refresh only
      set({ loading: false, updatingInBackground: !isRecentlyFetched });
      if (isRecentlyFetched) return;
    } else {
      // Cold load for this specific range
      set({ loading: true, updatingInBackground: false });
    }

    // Cancel in-flight request if user is navigating quickly
    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();
    const fetchId = ++currentFetchId;

    // Expand buffer for week view (1 week prior to 2 weeks ahead) for seamless lookahead
    let fetchStart = viewStart;
    let fetchEnd = viewEnd;
    if (viewMode === 'week') {
      fetchStart = format(subWeeks(gridStart, 1), 'yyyy-MM-dd');
      fetchEnd = format(addWeeks(gridEnd, 2), 'yyyy-MM-dd');
    }

    try {
      const res = await api.get(`/calendar?start=${fetchStart}&end=${fetchEnd}`, {
        signal: activeAbortController.signal
      });

      fetchedRangeTimestamps.set(rangeKey, Date.now());

      // Merge results into our persistent cache
      get().mergeEvents(res.data, { start: fetchStart, end: fetchEnd });
      upsertEventsToIndexedDB(res.data);

      if (fetchId === currentFetchId) {
        set({ isOfflineMode: false, loading: false, updatingInBackground: false });
      }
    } catch (netErr) {
      if (netErr?.name === 'CanceledError' || netErr?.name === 'AbortError' || netErr?.code === 'ERR_CANCELED') {
        return; // Superseded by newer navigation
      }
      console.warn('[Calendar] Failed to fetch calendar from network:', netErr);
      if (fetchId === currentFetchId) {
        set({ isOfflineMode: true, loading: false, updatingInBackground: false });
      }
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
      set(state => {
        const nextMap = { ...state.eventsById };
        subIds.forEach(id => {
          if (nextMap[id]) {
            nextMap[id] = { ...nextMap[id], isCollected: newVal };
          }
        });
        return {
          eventsById: nextMap,
          events: state.events.map(e => subIds.includes(e.id) ? { ...e, isCollected: newVal } : e)
        };
      });

      const updatedList = get().events.filter(e => subIds.includes(e.id));
      if (updatedList.length > 0) {
        upsertEventsToIndexedDB(updatedList);
      }

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
        set(state => {
          const nextMap = { ...state.eventsById };
          subIds.forEach(id => {
            if (nextMap[id]) {
              nextMap[id] = { ...nextMap[id], isWatched: false };
            }
          });
          return {
            eventsById: nextMap,
            events: state.events.map(e => subIds.includes(e.id) ? { ...e, isWatched: false } : e)
          };
        });

        const updatedList = get().events.filter(e => subIds.includes(e.id));
        if (updatedList.length > 0) {
          upsertEventsToIndexedDB(updatedList);
        }

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
        set(state => {
          const nextMap = { ...state.eventsById };
          subIds.forEach(id => {
            if (nextMap[id]) {
              nextMap[id] = { ...nextMap[id], isWatched: true };
            }
          });
          return {
            eventsById: nextMap,
            events: state.events.map(e => subIds.includes(e.id) ? { ...e, isWatched: true } : e)
          };
        });

        const updatedList = get().events.filter(e => subIds.includes(e.id));
        if (updatedList.length > 0) {
          upsertEventsToIndexedDB(updatedList);
        }

        return { success: true, message: `Watched "${isTV ? ev.showTitle : ev.title}"`, type: 'success' };
      }
    } catch (err) {
      console.error('Failed to log watch history:', err);
      return { success: false, message: 'Failed to update watch status', type: 'error' };
    }
  }
}));

// Automatically hydrate from IndexedDB on startup
if (typeof window !== 'undefined') {
  useCalendarStore.getState().hydrateFromCache();
}
