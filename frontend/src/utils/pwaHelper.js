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
 * Save list of events to IndexedDB, completely replacing previous entries
 */
export const saveEventsToIndexedDB = async (events) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Clear previous calendar cache
    const clearRequest = store.clear();

    clearRequest.onerror = (e) => {
      console.error('[IndexedDB] Failed to clear database:', e.target.error);
      reject(e.target.error);
    };

    clearRequest.onsuccess = () => {
      if (events.length === 0) {
        resolve(0);
        return;
      }

      let addedCount = 0;
      events.forEach((event) => {
        const addRequest = store.add(event);
        addRequest.onsuccess = () => {
          addedCount++;
          if (addedCount === events.length) {
            console.log(`[IndexedDB] Saved ${addedCount} calendar events for offline access.`);
            resolve(addedCount);
          }
        };
        addRequest.onerror = (err) => {
          console.error('[IndexedDB] Error adding item:', err.target.error);
        };
      });
    };
  });
};

/**
 * Fetch calendar events from IndexedDB that fall inside start and end bounds
 */
export const getEventsFromIndexedDB = async (startStr, endStr) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = (e) => {
      reject(e.target.error);
    };

    request.onsuccess = () => {
      const allEvents = request.result || [];
      // Filter events by startStr and endStr (YYYY-MM-DD format)
      const filtered = allEvents.filter((ev) => {
        return ev.airDate >= startStr && ev.airDate <= endStr;
      });
      resolve(filtered);
    };
  });
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
 * Pre-fetch 6 months of calendar data and save to IndexedDB
 */
export const syncCalendarOffline = async (apiInstance) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.warn('[PWA] Cannot sync calendar while offline.');
    return { success: false, error: 'Offline' };
  }

  try {
    const today = new Date();
    
    // Start date: 1st of current month
    const startYear = today.getFullYear();
    const startMonth = String(today.getMonth() + 1).padStart(2, '0');
    const startStr = `${startYear}-${startMonth}-01`;

    // End date: Last day of the month 6 months from now
    const futureDate = new Date(today.getFullYear(), today.getMonth() + 6, 0);
    const endYear = futureDate.getFullYear();
    const endMonth = String(futureDate.getMonth() + 1).padStart(2, '0');
    const endDay = String(futureDate.getDate()).padStart(2, '0');
    const endStr = `${endYear}-${endMonth}-${endDay}`;

    console.log(`[PWA] Background pre-fetching 6 months calendar data (${startStr} to ${endStr})...`);
    
    const response = await apiInstance.get(`/calendar?start=${startStr}&end=${endStr}`);
    
    if (response.data && Array.isArray(response.data)) {
      const count = await saveEventsToIndexedDB(response.data);
      localStorage.setItem('pwa_last_sync_time', new Date().toISOString());
      return { success: true, count };
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
    return new Promise((resolve, reject) => {
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
