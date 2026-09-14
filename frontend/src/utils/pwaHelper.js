/**
 * PWA & Offline utility helper
 * Handles IndexedDB operations and background prefetching for the 6-Month calendar cache.
 */

const DB_NAME = 'PopcornClubPWA';
const DB_VERSION = 1;
const STORE_NAME = 'calendar-events';

// Active beforeinstallprompt event for PWA installation
let deferredPrompt = null;
let installCallback = null;

// Listen for PWA installation capability
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    console.log('[PWA] Installation prompt stashed.');
    if (installCallback) {
      installCallback(true);
    }
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] PopcornClub has been installed successfully!');
    deferredPrompt = null;
    if (installCallback) {
      installCallback(false);
    }
  });
}

/**
 * Register a listener for when app installation eligibility changes
 */
export const registerInstallListener = (callback) => {
  installCallback = callback;
  // Initialize with current state
  if (deferredPrompt) {
    callback(true);
  }
};

/**
 * Triggers the native PWA installation prompt
 */
export const triggerInstallPrompt = async () => {
  if (!deferredPrompt) {
    console.warn('[PWA] Install prompt not available yet');
    return false;
  }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`[PWA] Install outcome: ${outcome}`);
  deferredPrompt = null;
  if (installCallback) {
    installCallback(false);
  }
  return outcome === 'accepted';
};

/**
 * Initialize IndexedDB Database
 */
export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('[IndexedDB] Database failed to open:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        console.log('[IndexedDB] Object store created:', STORE_NAME);
      }
    };
  });
};

/**
 * Save list of events to IndexedDB safely using upsert without wiping existing cache
 */
export const saveEventsToIndexedDB = async (events) => {
  return upsertEventsToIndexedDB(events);
};

/**
 * Helper to compute an event's date key in the local timezone
 */
export const getEventDateKey = (ev) => {
  if (ev.localDateStr) return ev.localDateStr;
  if (ev.airDateTime) {
    const d = new Date(ev.airDateTime);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return ev.airDate || '';
};

/**
 * Retrieve all cached calendar events from IndexedDB
 */
export const getAllEventsFromIndexedDB = async () => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = (e) => {
        console.error('[IndexedDB] Failed to get all events:', e.target.error);
        reject(e.target.error);
      };

      request.onsuccess = () => {
        resolve(request.result || []);
      };
    });
  } catch (err) {
    console.error('[IndexedDB] Error reading cache:', err);
    return [];
  }
};

/**
 * Fetch calendar events from IndexedDB that fall inside start and end bounds
 */
export const getEventsFromIndexedDB = async (startStr, endStr) => {
  try {
    const allEvents = await getAllEventsFromIndexedDB();
    const filtered = allEvents.filter((ev) => {
      const dateKey = getEventDateKey(ev);
      return dateKey >= startStr && dateKey <= endStr;
    });
    return filtered;
  } catch (err) {
    console.warn('[IndexedDB] Error filtering events from cache:', err);
    return [];
  }
};

/**
 * Retrieve total number of cached events in IndexedDB
 */
export const getCachedEventsCount = async () => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onerror = (e) => reject(e.target.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (err) {
    console.error('[IndexedDB] Failed to get cache count:', err);
    return 0;
  }
};

/**
 * Pre-fetch 1 month past to 6 months future of calendar data and save to IndexedDB
 */
export const syncCalendarOffline = async (apiInstance) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.warn('[PWA] Cannot sync calendar while offline.');
    return { success: false, error: 'Offline' };
  }

  try {
    const today = new Date();
    
    // Start date: 1st of previous month to cover recent airings & boundary weeks
    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const startYear = prevMonthDate.getFullYear();
    const startMonth = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
    const startStr = `${startYear}-${startMonth}-01`;

    // End date: Last day of the month 6 months from now
    const futureDate = new Date(today.getFullYear(), today.getMonth() + 7, 0);
    const endYear = futureDate.getFullYear();
    const endMonth = String(futureDate.getMonth() + 1).padStart(2, '0');
    const endDay = String(futureDate.getDate()).padStart(2, '0');
    const endStr = `${endYear}-${endMonth}-${endDay}`;

    console.log(`[PWA] Background pre-fetching calendar data (${startStr} to ${endStr})...`);
    
    const response = await apiInstance.get(`/calendar?start=${startStr}&end=${endStr}`);
    
    if (response.data && Array.isArray(response.data)) {
      const count = await upsertEventsToIndexedDB(response.data);
      localStorage.setItem('pwa_last_sync_time', new Date().toISOString());
      return { success: true, count, events: response.data };
    } else {
      throw new Error('Invalid server calendar response format');
    }
  } catch (error) {
    console.error('[PWA] Background calendar sync failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Upsert/insert a list of events to IndexedDB without clearing existing ones
 */
export const upsertEventsToIndexedDB = async (events) => {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      let processedCount = 0;
      
      if (!events || events.length === 0) {
        resolve(0);
        return;
      }
      
      events.forEach((event) => {
        const putRequest = store.put(event);
        putRequest.onsuccess = () => {
          processedCount++;
          if (processedCount === events.length) {
            console.log(`[IndexedDB] Upserted ${processedCount} calendar events to cache.`);
            resolve(processedCount);
          }
        };
        putRequest.onerror = (err) => {
          console.error('[IndexedDB] Error upserting item:', err.target.error);
          processedCount++;
          if (processedCount === events.length) {
            resolve(processedCount);
          }
        };
      });
    });
  } catch (err) {
    console.error('[IndexedDB] Failed to upsert events:', err);
    return 0;
  }
};

