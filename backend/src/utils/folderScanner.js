const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const prisma = require('../prismaClient');
const { fetchTMDB } = require('./tmdb');
const { archiveRequestsOnCollect } = require('./requestManager');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// State variables for status reporting
let isScanning = false;
let lastScanTime = null;
let currentProgress = 'Idle';

// Map to store active Chokidar watchers
const activeWatchers = new Map();

// Helper to check if a file is a video by extension
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.m4v', '.mov', '.wmv', '.flv'];
function isVideoFile(filePath) {
  return VIDEO_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

// Clean and normalize title
function cleanTitle(str) {
  // Remove trailing garbage like dashes, brackets, parentheses, and whitespace
  let cleaned = str.replace(/[\s\[\({-]*$/, '');
  cleaned = cleaned.replace(/[._-]/g, ' ');
  // Remove common quality tags and release group clutter
  cleaned = cleaned.replace(/\b(1080p|720p|2160p|4k|uhd|bluray|brrip|bdrip|dvdrip|webrip|web-dl|h264|x264|h265|x265|hevc|dd5\s*1|aac|dts|remux|xvid|divx)\b/gi, '');
  return cleaned.replace(/\s+/g, ' ').trim();
}

// Parse TV and Movie details from filename and directory path
function parseFilename(filePath) {
  const filename = path.basename(filePath);
  const ext = path.extname(filename);
  const nameWithoutExt = path.basename(filename, ext);

  const normalizedPath = filePath.replace(/\\/g, '/');
  
  // Try to extract TMDB ID from anywhere in the path/filename
  let tmdbId = null;
  const tmdbMatch = normalizedPath.match(/(?:tmdb|tmdbid)[-:\s]+(\d+)/i) || normalizedPath.match(/\b(?:tmdb|tmdbid)-(\d+)\b/i);
  if (tmdbMatch) {
    tmdbId = parseInt(tmdbMatch[1], 10);
  }

  // Determine if it's a TV show or Movie based on path segments
  const isTvPath = normalizedPath.includes('/tv/') || normalizedPath.startsWith('/tv/');

  if (isTvPath) {
    const parts = normalizedPath.split('/');
    const tvIndex = parts.indexOf('tv');
    let title = '';
    if (tvIndex !== -1 && parts.length > tvIndex + 1) {
      title = parts[tvIndex + 1];
    } else {
      title = nameWithoutExt;
    }

    let year = null;
    const yearMatch = title.match(/(?:\(|\[)(\d{4})(?:[\s,\]\)]|$)/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
    }

    // Clean title of tmdb tags and year tags
    let cleanedTitle = title;
    cleanedTitle = cleanedTitle.replace(/[\(\[](?:tmdb|tmdbid)[-:\s]*\d+[\)\]]/gi, '');
    cleanedTitle = cleanedTitle.replace(/[\(\[]\d{4}[\)\]]/g, '');
    cleanedTitle = cleanTitle(cleanedTitle);

    let season = 1;
    let episode = 1;
    let endEpisode = null;

    // Check parent folder for Season number
    if (parts.length >= 2) {
      const parentFolder = parts[parts.length - 2];
      const seasonMatch = parentFolder.match(/season\s*(\d{1,2})/i);
      if (seasonMatch) {
        season = parseInt(seasonMatch[1], 10);
      }
    }

    // Try standard S01E02 or S01E02E05 patterns in the filename
    const tvMatch1 = nameWithoutExt.match(/s(\d{1,2})e(\d{1,2})(?:[-_]*e?(\d{1,2}))?\b/i);
    const tvMatch2 = nameWithoutExt.match(/(\d{1,2})x(\d{1,2})(?:[-_]*x?(\d{1,2}))?\b/i);

    if (tvMatch1) {
      season = parseInt(tvMatch1[1], 10);
      episode = parseInt(tvMatch1[2], 10);
      if (tvMatch1[3]) endEpisode = parseInt(tvMatch1[3], 10);
    } else if (tvMatch2) {
      season = parseInt(tvMatch2[1], 10);
      episode = parseInt(tvMatch2[2], 10);
      if (tvMatch2[3]) endEpisode = parseInt(tvMatch2[3], 10);
    } else {
      // Fallback: search for lone episode numbers in filename
      const epMatch = nameWithoutExt.match(/(?:ep|episode|e)[. _-]*(\d{1,2})/i);
      if (epMatch) {
        episode = parseInt(epMatch[1], 10);
      } else {
        const numMatch = nameWithoutExt.match(/\b(\d{1,2})\b/);
        if (numMatch) {
          episode = parseInt(numMatch[1], 10);
        }
      }
    }

    // Check for year in title or filename if not already found in title
    if (!year) {
      const yearMatchFn = nameWithoutExt.match(/(?:\(|\[)(\d{4})(?:[\s,\]\)]|$)/);
      if (yearMatchFn) {
        year = parseInt(yearMatchFn[1], 10);
      }
    }

    return {
      type: 'tv',
      title: cleanedTitle,
      season,
      episode,
      endEpisode,
      year,
      tmdbId
    };
  }

  // Movie logic
  let title = nameWithoutExt;
  let year = null;
  const yearMatch = nameWithoutExt.match(/(?:\(|\[)(\d{4})(?:[\s,\]\)]|$)/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
    title = nameWithoutExt.substring(0, nameWithoutExt.indexOf(yearMatch[0]));
  } else {
    // Check path for year if not in filename
    const parts = normalizedPath.split('/');
    if (parts.length >= 2) {
      const folderName = parts[parts.length - 2];
      const folderYearMatch = folderName.match(/(?:\(|\[)(\d{4})(?:[\s,\]\)]|$)/);
      if (folderYearMatch) {
        year = parseInt(folderYearMatch[1], 10);
      }
    }
  }

  let cleanedTitle = title;
  cleanedTitle = cleanedTitle.replace(/[\(\[](?:tmdb|tmdbid)[-:\s]*\d+[\)\]]/gi, '');
  cleanedTitle = cleanedTitle.replace(/[\(\[]\d{4}[\)\]]/g, '');
  cleanedTitle = cleanTitle(cleanedTitle);

  return {
    type: 'movie',
    title: cleanedTitle,
    year,
    tmdbId
  };
}

// Get all files recursively in a directory
async function getFilesInDirectory(dirPath) {
  let results = [];
  try {
    const list = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const file of list) {
      const filePath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        const subResults = await getFilesInDirectory(filePath);
        results = results.concat(subResults);
      } else if (file.isFile()) {
        results.push(filePath);
      }
    }
  } catch (err) {
    console.error(`[Folder Scanner] Error reading directory ${dirPath}:`, err.message);
  }
  return results;
}

// Thread-safe media record upsert (matching implementation in media.js)
async function getOrCreateMediaRecord({ tmdbId, type, title, overview, releaseDate, posterPath }) {
  const parsedId = parseInt(tmdbId, 10);
  let media = await prisma.media.findFirst({ where: { tmdbId: parsedId, type } });
  if (media) {
    const needsUpdate = (!media.posterPath && posterPath) ||
                        (!media.overview && overview) ||
                        (!media.releaseDate && releaseDate);
    if (needsUpdate) {
      try {
        media = await prisma.media.update({
          where: { id: media.id },
          data: {
            posterPath: media.posterPath || posterPath || null,
            overview: media.overview || overview || '',
            releaseDate: media.releaseDate || (releaseDate ? new Date(releaseDate) : null)
          }
        });
      } catch (err) {
        console.error('[Folder Scanner] Failed to enrich media:', err.message);
      }
    }
    return media;
  }

  try {
    media = await prisma.media.create({
      data: {
        tmdbId: parsedId,
        type,
        title,
        overview: overview || '',
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        posterPath: posterPath || null
      }
    });
    return media;
  } catch (err) {
    // Graceful fallback for concurrent insert collisions
    media = await prisma.media.findFirst({ where: { tmdbId: parsedId, type } });
    if (media) return media;
    throw err;
  }
}

// Process a single file (resolve via TMDB, add collections & local file records)
async function processSingleFile(filePath, folderType, apiKey) {
  if (!isVideoFile(filePath)) return null;

  try {
    // 1. Parse details from filename
    const parsed = parseFilename(filePath);
    if (!parsed) return null;

    console.log(`[Folder Scanner] Resolving file: "${path.basename(filePath)}" parsed as:`, parsed);

    // 2. Check if path already in database. If so, refresh lastSeen and update metadata if needed.
    const existing = await prisma.localFile.findUnique({ where: { path: filePath } });
    if (existing) {
      let shouldUpdate = false;
      const updateData = { lastSeen: new Date(), missingSince: null };
      
      if (parsed.type === 'tv') {
         if (!existing.manuallyCorrected && existing.episode !== parsed.episode) {
            updateData.episode = parsed.episode;
            shouldUpdate = true;
         }
         if (existing.endEpisode !== parsed.endEpisode) {
            updateData.endEpisode = parsed.endEpisode;
            shouldUpdate = true;
         }
      }
      
      let finalFile = existing;
      if (shouldUpdate) {
         finalFile = await prisma.localFile.update({
            where: { id: existing.id },
            data: updateData
         });
         console.log(`[Folder Scanner] Updated existing file metadata: S${finalFile.season}E${finalFile.episode}-${finalFile.endEpisode}`);
      } else {
         await prisma.localFile.update({
            where: { id: existing.id },
            data: updateData
         });
      }

      try {
        const allUsers = await prisma.user.findMany({ select: { id: true } });
        for (const u of allUsers) {
          if (finalFile.type === 'tv' && finalFile.season !== null && finalFile.episode !== null) {
            await prisma.collection.upsert({
              where: { userId_mediaId: { userId: u.id, mediaId: finalFile.mediaId } },
              update: {},
              create: { userId: u.id, mediaId: finalFile.mediaId }
            });
            const endEp = finalFile.endEpisode || finalFile.episode;
            for (let ep = finalFile.episode; ep <= endEp; ep++) {
              await prisma.episodeCollection.upsert({
                where: {
                  userId_mediaId_season_episode: {
                    userId: u.id,
                    mediaId: finalFile.mediaId,
                    season: finalFile.season,
                    episode: ep
                  }
                },
                update: {},
                create: {
                  userId: u.id,
                  mediaId: finalFile.mediaId,
                  season: finalFile.season,
                  episode: ep
                }
              });
            }
          } else {
            await prisma.collection.upsert({
              where: { userId_mediaId: { userId: u.id, mediaId: finalFile.mediaId } },
              update: {},
              create: { userId: u.id, mediaId: finalFile.mediaId }
            });
          }
        }
      } catch (err) {
        console.error('[Folder Scanner] Failed to record collection for existing file for all users:', err.message);
      }
      return finalFile;
    }

    // 3. Search and resolve on TMDB
    let tmdbData = null;
    if (parsed.tmdbId) {
      try {
        tmdbData = await fetchTMDB(`/3/${parsed.type}/${parsed.tmdbId}`, apiKey);
      } catch (err) {
        console.warn(`[Folder Scanner] Failed to fetch TMDB details directly for ID ${parsed.tmdbId}:`, err.message);
      }
    }

    if (!tmdbData) {
      if (parsed.type === 'tv') {
        const searchParams = { query: parsed.title };
        if (parsed.year) searchParams.first_air_date_year = parsed.year;
        const searchRes = await fetchTMDB('/3/search/tv', apiKey, searchParams);
        if (searchRes.results && searchRes.results.length > 0) {
          tmdbData = searchRes.results[0];
        }
      } else {
        const searchParams = { query: parsed.title };
        if (parsed.year) searchParams.year = parsed.year;
        const searchRes = await fetchTMDB('/3/search/movie', apiKey, searchParams);
        if (searchRes.results && searchRes.results.length > 0) {
          tmdbData = searchRes.results[0];
        }
      }
    }

    if (!tmdbData) {
      console.warn(`[Folder Scanner] Could not resolve TMDB details for: "${parsed.title}"`);
      return null;
    }

    // 4. Create/Get Media Record
    const media = await getOrCreateMediaRecord({
      tmdbId: tmdbData.id,
      type: parsed.type,
      title: tmdbData.name || tmdbData.title,
      overview: tmdbData.overview,
      releaseDate: tmdbData.first_air_date || tmdbData.release_date,
      posterPath: tmdbData.poster_path
    });

    // 5. Add to Collection or EpisodeCollection for all users
    try {
      const allUsers = await prisma.user.findMany({ select: { id: true } });
      for (const u of allUsers) {
        if (parsed.type === 'tv' && parsed.season !== undefined && parsed.episode !== undefined) {
          // Mark TV Show collected
          await prisma.collection.upsert({
            where: { userId_mediaId: { userId: u.id, mediaId: media.id } },
            update: {},
            create: { userId: u.id, mediaId: media.id }
          });
          // Mark Episode collected
          const endEp = parsed.endEpisode || parsed.episode;
          for (let ep = parsed.episode; ep <= endEp; ep++) {
            await prisma.episodeCollection.upsert({
              where: {
                userId_mediaId_season_episode: {
                  userId: u.id,
                  mediaId: media.id,
                  season: parsed.season,
                  episode: ep
                }
              },
              update: {},
              create: {
                userId: u.id,
                mediaId: media.id,
                season: parsed.season,
                episode: ep
              }
            });
          }
        } else {
          // Mark Movie collected
          await prisma.collection.upsert({
            where: { userId_mediaId: { userId: u.id, mediaId: media.id } },
            update: {},
            create: { userId: u.id, mediaId: media.id }
          });
        }
      }
      
      // Auto-archive requests for this media item
      if (parsed.type === 'tv' && parsed.season !== undefined && parsed.episode !== undefined) {
        const endEp = parsed.endEpisode || parsed.episode;
        for (let ep = parsed.episode; ep <= endEp; ep++) {
          await archiveRequestsOnCollect(media.id, 'tv', parsed.season, ep);
        }
      } else {
        await archiveRequestsOnCollect(media.id, 'movie');
      }
    } catch (err) {
      console.error('[Folder Scanner] Failed to record collection for all users:', err.message);
    }

    // 6. Create LocalFile Record
    const localFile = await prisma.localFile.create({
      data: {
        path: filePath,
        type: parsed.type,
        mediaId: media.id,
        season: parsed.type === 'tv' ? parsed.season : null,
        episode: parsed.type === 'tv' ? parsed.episode : null,
        endEpisode: parsed.type === 'tv' ? (parsed.endEpisode || null) : null,
        lastSeen: new Date(),
        missingSince: null
      }
    });

    return localFile;
  } catch (err) {
    console.error(`[Folder Scanner] Failed to process file ${filePath}:`, err.message);
    if (
      err.message.includes('timeout') ||
      err.message.includes('status code 429') ||
      err.code === 'ECONNRESET' ||
      err.code === 'ETIMEDOUT'
    ) {
      throw err;
    }
    return null;
  }
}

// Perform full scan on a single folder
async function scanFolder(folderRecord, apiKey) {
  const { path: folderPath, type: folderType } = folderRecord;
  console.log(`[Folder Scanner] Scanning folder: ${folderPath} (${folderType})`);

  if (!fs.existsSync(folderPath)) {
    console.error(`[Folder Scanner] Path does not exist on disk: ${folderPath}`);
    return;
  }

  // Get all files on disk under this folder
  const filesOnDisk = await getFilesInDirectory(folderPath);
  const videoFiles = filesOnDisk.filter(isVideoFile);

  console.log(`[Folder Scanner] Found ${videoFiles.length} video files in ${folderPath}`);

  // Process all files on disk
  const processedPaths = new Set();
  let count = 0;
  let consecutiveErrors = 0;
  for (const filePath of videoFiles) {
    currentProgress = `Scanning folder "${folderPath}": processing ${++count}/${videoFiles.length} (${path.basename(filePath)})`;
    
    // Check database to see if we already have it to avoid TMDB lookup and delay
    const existing = await prisma.localFile.findUnique({ where: { path: filePath } });
    if (!existing) {
      // Delay to be polite to TMDB API and prevent rate-limiting on fresh scans
      await sleep(250);
    }
    
    try {
      const res = await processSingleFile(filePath, folderType, apiKey);
      if (res) {
        processedPaths.add(filePath);
        consecutiveErrors = 0;
      }
    } catch (err) {
      consecutiveErrors++;
      console.error(`[Folder Scanner] Network error resolving ${filePath} (consecutive: ${consecutiveErrors}):`, err.message);
      if (consecutiveErrors >= 5) {
        console.error(`[Folder Scanner] Aborting scan for ${folderPath} due to 5 consecutive network failures.`);
        break;
      }
      console.log(`[Folder Scanner] Sleeping for 5 seconds to cool down TMDB connection...`);
      await sleep(5000);
    }
  }

  // Identify files in database under this folder path that were not found on disk
  const folderPrefix = folderPath.endsWith(path.sep) ? folderPath : folderPath + path.sep;
  const dbFiles = await prisma.localFile.findMany({
    where: {
      path: {
        startsWith: folderPrefix
      }
    }
  });

  for (const dbFile of dbFiles) {
    if (!processedPaths.has(dbFile.path) && !fs.existsSync(dbFile.path)) {
      // File is missing from disk! Set missingSince if not already set
      if (!dbFile.missingSince) {
        await prisma.localFile.update({
          where: { id: dbFile.id },
          data: { missingSince: new Date() }
        });
        console.log(`[Folder Scanner] File missing from disk, marked missing: ${dbFile.path}`);
      }
    } else {
      // File exists! Ensure missingSince is null
      if (dbFile.missingSince) {
        await prisma.localFile.update({
          where: { id: dbFile.id },
          data: { missingSince: null }
        });
      }
    }
  }
}

// Main function to run full scan of all configured folders
async function scanAllFolders() {
  if (isScanning) {
    console.warn('[Folder Scanner] Scan already in progress.');
    return;
  }

  isScanning = true;
  currentProgress = 'Loading settings...';
  try {
    const settings = await prisma.systemSettings.findFirst();
    const apiKey = settings?.tmdbApiKey;
    if (!apiKey) {
      currentProgress = 'Scan skipped: TMDB API Key is not configured under settings.';
      console.warn('[Folder Scanner] TMDB API Key not configured. Skipping scan.');
      isScanning = false;
      return;
    }

    const folders = await prisma.localFolder.findMany();
    for (const folder of folders) {
      await scanFolder(folder, apiKey);
    }

    lastScanTime = new Date();
    currentProgress = 'Idle';
    console.log('[Folder Scanner] Scanning completed successfully.');
  } catch (err) {
    currentProgress = `Error: ${err.message}`;
    console.error('[Folder Scanner] Scan failed:', err);
  } finally {
    isScanning = false;
  }
}

// Main function to run full scan of a single folder configuration
async function scanSingleFolder(folderRecord) {
  if (isScanning) {
    console.warn('[Folder Scanner] Scan already in progress.');
    return;
  }

  isScanning = true;
  currentProgress = 'Loading settings...';
  try {
    const settings = await prisma.systemSettings.findFirst();
    const apiKey = settings?.tmdbApiKey;
    if (!apiKey) {
      currentProgress = 'Scan skipped: TMDB API Key is not configured under settings.';
      console.warn('[Folder Scanner] TMDB API Key not configured. Skipping scan.');
      isScanning = false;
      return;
    }

    await scanFolder(folderRecord, apiKey);

    lastScanTime = new Date();
    currentProgress = 'Idle';
    console.log(`[Folder Scanner] Scan of folder ${folderRecord.path} completed successfully.`);
  } catch (err) {
    currentProgress = `Error: ${err.message}`;
    console.error(`[Folder Scanner] Scan of folder ${folderRecord.path} failed:`, err);
  } finally {
    isScanning = false;
  }
}

// 12-Hour expiration cleanup job (runs periodically)
async function runCleanupJob() {
  console.log('[Folder Scanner] Running 12-hour expiration cleanup job...');
  try {
    const expiredThreshold = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const expiredFiles = await prisma.localFile.findMany({
      where: {
        missingSince: {
          not: null,
          lt: expiredThreshold
        }
      }
    });

    console.log(`[Folder Scanner] Found ${expiredFiles.length} expired file records to uncollect.`);

    for (const file of expiredFiles) {
      // Delete the local file record
      await prisma.localFile.delete({ where: { id: file.id } });
      console.log(`[Folder Scanner] Deleted expired LocalFile database reference: ${file.path}`);

      // Run uncollect verification
      if (file.type === 'tv') {
        // A single file might cover a range of episodes
        const endEp = file.endEpisode || file.episode;
        for (let ep = file.episode; ep <= endEp; ep++) {
          // Count other local files covering this exact episode 'ep'
          const remainingCount = await prisma.localFile.count({
            where: {
              mediaId: file.mediaId,
              season: file.season,
              episode: { lte: ep },
              OR: [
                { endEpisode: { gte: ep } },
                { endEpisode: null, episode: ep }
              ]
            }
          });
          if (remainingCount === 0) {
            // Uncollect the episode
            await prisma.episodeCollection.deleteMany({
              where: {
                mediaId: file.mediaId,
                season: file.season,
                episode: ep
              }
            });
            console.log(`[Folder Scanner] Episode S${file.season}E${ep} of Media #${file.mediaId} is no longer collected (no local files left).`);
          }
        }
      } else {
        // Count other local files for this movie
        const remainingCount = await prisma.localFile.count({
          where: {
            mediaId: file.mediaId
          }
        });
        if (remainingCount === 0) {
          // Uncollect the movie
          await prisma.collection.deleteMany({
            where: {
              mediaId: file.mediaId
            }
          });
          console.log(`[Folder Scanner] Movie #${file.mediaId} is no longer collected (no local files left).`);
        }
      }
    }
  } catch (err) {
    console.error('[Folder Scanner] Cleanup job failed:', err.message);
  }
}

// Start active watcher for a folder using Chokidar
function startWatcher(folderRecord) {
  const { id, path: folderPath, type: folderType } = folderRecord;
  if (activeWatchers.has(id)) {
    console.log(`[Watcher] Watcher already exists for folder ID ${id}`);
    return;
  }

  console.log(`[Watcher] Starting watcher for: ${folderPath} (${folderType})`);

  // Watch recursive folders. Use polling inside Docker to ensure bind mounts update correctly.
  const watcher = chokidar.watch(folderPath, {
    ignored: (itemPath, stats) => {
      // Ignore dotfiles/hidden directories
      if (path.basename(itemPath).startsWith('.')) {
        return true;
      }
      if (stats) {
        if (stats.isDirectory()) return false;
        const ext = path.extname(itemPath).toLowerCase();
        return !VIDEO_EXTENSIONS.includes(ext);
      }
      const ext = path.extname(itemPath).toLowerCase();
      if (ext && !VIDEO_EXTENSIONS.includes(ext)) {
        return true;
      }
      return false;
    },
    persistent: true,
    ignoreInitial: true,
    usePolling: true,
    interval: 20000, // 20 seconds polling interval
    binaryInterval: 25000
  });

  watcher.on('add', async (filePath) => {
    console.log(`[Watcher] File added: ${filePath}`);
    const settings = await prisma.systemSettings.findFirst();
    const apiKey = settings?.tmdbApiKey;
    if (apiKey) {
      await processSingleFile(filePath, folderType, apiKey);
    }
  });

  watcher.on('change', async (filePath) => {
    console.log(`[Watcher] File changed: ${filePath}`);
    const settings = await prisma.systemSettings.findFirst();
    const apiKey = settings?.tmdbApiKey;
    if (apiKey) {
      await processSingleFile(filePath, folderType, apiKey);
    }
  });

  watcher.on('unlink', async (filePath) => {
    console.log(`[Watcher] File removed: ${filePath}`);
    try {
      await prisma.localFile.updateMany({
        where: { path: filePath },
        data: { missingSince: new Date() }
      });
    } catch (err) {
      console.error(`[Watcher] Failed to flag missing file: ${filePath}`, err.message);
    }
  });

  watcher.on('error', (err) => {
    console.error(`[Watcher] Folder ${folderPath} error:`, err.message);
  });

  activeWatchers.set(id, watcher);
}

// Stop watcher for a folder
function stopWatcher(folderId) {
  const watcher = activeWatchers.get(folderId);
  if (watcher) {
    console.log(`[Watcher] Stopping watcher for folder ID ${folderId}`);
    watcher.close();
    activeWatchers.delete(folderId);
  }
}

async function selfHealMismatches() {
  console.log('[Self-Heal] Checking for folder type / media type mismatches in database...');
  try {
    const files = await prisma.localFile.findMany({
      include: { media: true }
    });

    const badFiles = files.filter(f => {
      const normalized = f.path.replace(/\\/g, '/');
      const isTv = normalized.startsWith('/tv/');
      const isMovie = normalized.startsWith('/movies/');
      
      if (isTv && f.media.type !== 'tv') return true;
      if (isMovie && f.media.type !== 'movie') return true;
      return false;
    });

    if (badFiles.length > 0) {
      console.log(`[Self-Heal] Found ${badFiles.length} mismatched file references. Deleting them so they can be re-scanned correctly...`);
      const fileIds = badFiles.map(f => f.id);
      
      // Delete the bad local file records
      await prisma.localFile.deleteMany({
        where: { id: { in: fileIds } }
      });

      // Clean up empty/orphaned media records to avoid database bloat
      const allMedia = await prisma.media.findMany({
        include: {
          localFiles: true,
          collections: true,
          watchHistoryLogs: true
        }
      });
      const orphanedMedia = allMedia.filter(m => m.localFiles.length === 0 && m.collections.length === 0 && m.watchHistoryLogs.length === 0);
      if (orphanedMedia.length > 0) {
        console.log(`[Self-Heal] Cleaning up ${orphanedMedia.length} orphaned media records...`);
        await prisma.media.deleteMany({
          where: { id: { in: orphanedMedia.map(m => m.id) } }
        });
      }

      console.log('[Self-Heal] Deletion completed. Mismatched files will be re-scanned on the next folder scan.');
    } else {
      console.log('[Self-Heal] No mismatched file references detected.');
    }
  } catch (err) {
    console.error('[Self-Heal] Error running mismatch self-heal:', err.message);
  }
}

// Initializer function for server startup
async function initFolderScanner() {
  console.log('[Folder Scanner] Initializing scanner system...');
  
  // Clean up any existing mismatched file type references first
  await selfHealMismatches();
  
  // Auto-populate / sync TMDB API Key from environment variable if configured
  try {
    const envApiKey = process.env.TMDB_API_KEY;
    if (envApiKey) {
      const settings = await prisma.systemSettings.findFirst();
      if (settings && settings.tmdbApiKey !== envApiKey) {
        console.log('[Folder Scanner] Automatically updating TMDB API Key from environment variable.');
        await prisma.systemSettings.update({
          where: { id: settings.id },
          data: { tmdbApiKey: envApiKey }
        });
      }
    }
  } catch (err) {
    console.error('[Folder Scanner] Failed to auto-populate TMDB API Key from environment:', err.message);
  }

  // Auto-configure default folders if they exist on filesystem but not in DB
  try {
    const defaults = [
      { path: '/movies', type: 'movie', watch: true },
      { path: '/tv', type: 'tv', watch: true }
    ];
    for (const folder of defaults) {
      if (fs.existsSync(folder.path)) {
        const stat = fs.statSync(folder.path);
        if (stat.isDirectory()) {
          const existing = await prisma.localFolder.findUnique({ where: { path: folder.path } });
          if (!existing) {
            console.log(`[Folder Scanner] Auto-configuring default folder: ${folder.path} (${folder.type})`);
            await prisma.localFolder.create({
              data: {
                path: folder.path,
                type: folder.type,
                watch: folder.watch
              }
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('[Folder Scanner] Failed to auto-configure default folders:', err.message);
  }

  // 1. Start periodic scans every 4 hours
  setInterval(scanAllFolders, 4 * 60 * 60 * 1000);

  // 2. Start hourly cleanup checks for 12-hour expiration rule
  setInterval(runCleanupJob, 60 * 60 * 1000);

  // 3. Initialize Chokidar watchers for any folder configured with watch: true
  try {
    const watchFolders = await prisma.localFolder.findMany({ where: { watch: true } });
    for (const folder of watchFolders) {
      startWatcher(folder);
    }
  } catch (err) {
    console.error('[Folder Scanner] Failed to initialize watchers:', err.message);
  }

  // 4. Run an initial scan of folders on startup asynchronously
  setTimeout(scanAllFolders, 5000);
}

function matchDirectoryToMedia(dirName, media) {
  const name = dirName.replace(/\\/g, '/').split('/').pop();

  // 1. Match by TMDB ID
  const tmdbMatch = name.match(/(?:tmdb|tmdbid)[-:\s]+(\d+)/i) || name.match(/\b(?:tmdb|tmdbid)-(\d+)\b/i);
  if (tmdbMatch) {
    const tmdbId = parseInt(tmdbMatch[1], 10);
    if (tmdbId === media.tmdbId) return true;
  }

  // 2. Match by Title (and optional Year)
  let cleanedName = name;
  cleanedName = cleanedName.replace(/[\(\[](?:tmdb|tmdbid)[-:\s]*\d+[\)\]]/gi, '');
  
  let dirYear = null;
  const yearMatch = cleanedName.match(/(?:\(|\[)(\d{4})(?:[\s,\]\)]|$)/);
  if (yearMatch) {
    dirYear = parseInt(yearMatch[1], 10);
  }
  cleanedName = cleanedName.replace(/[\(\[]\d{4}[\)\]]/g, '');

  const cleanDirTitle = cleanedName.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  const cleanMediaTitle = media.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

  if (cleanDirTitle === cleanMediaTitle) {
    if (dirYear && media.releaseDate) {
      const mediaYear = new Date(media.releaseDate).getFullYear();
      if (dirYear === mediaYear) return true;
    } else {
      return true;
    }
  }

  return false;
}

async function scanMediaItem(mediaId, options = {}) {
  const { season, episode } = options;
  const settings = await prisma.systemSettings.findFirst();
  const apiKey = settings?.tmdbApiKey;
  if (!apiKey) {
    throw new Error('TMDB API Key is not configured.');
  }

  // 1. Fetch Media
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    include: { localFiles: true }
  });
  if (!media) throw new Error('Media not found.');

  // 2. Fetch configured folders
  const folders = await prisma.localFolder.findMany({
    where: { type: media.type }
  });
  if (folders.length === 0) {
    return { addedCount: 0, totalProcessed: 0, addedFiles: [] };
  }

  // 3. Resolve target directories to scan
  const targetDirs = new Set();
  
  // Strategy A: Direct subdirectories matching the show/movie name or ID
  for (const folder of folders) {
    const rootPath = folder.path;
    if (!fs.existsSync(rootPath)) continue;

    try {
      const entries = await fs.promises.readdir(rootPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(rootPath, entry.name);
          if (matchDirectoryToMedia(entry.name, media)) {
            targetDirs.add(dirPath);
          }
        }
      }
    } catch (err) {
      console.error(`[Folder Scanner] Error listing root folder ${rootPath}:`, err.message);
    }
  }

  // Strategy B: Directories of existing files for this media
  for (const file of media.localFiles) {
    const dir = path.dirname(file.path);
    if (fs.existsSync(dir)) {
      targetDirs.add(dir);
      const parentDir = path.dirname(dir);
      if (parentDir && parentDir !== '/' && parentDir.endsWith(media.type === 'tv' ? 'tv' : 'movies') === false) {
        targetDirs.add(parentDir);
      }
    }
  }

  // Strategy C: Fallback to scanning configured folders in full if no target dirs found
  if (targetDirs.size === 0) {
    for (const folder of folders) {
      targetDirs.add(folder.path);
    }
  }

  console.log(`[Folder Scanner] Targeted scan directories for "${media.title}":`, Array.from(targetDirs));

  // 4. Scan all resolved directories recursively
  const videoFiles = [];
  for (const dir of targetDirs) {
    const files = await getFilesInDirectory(dir);
    for (const file of files) {
      if (isVideoFile(file) && !videoFiles.includes(file)) {
        videoFiles.push(file);
      }
    }
  }

  console.log(`[Folder Scanner] Found ${videoFiles.length} video files in target directories.`);

  // 5. Process files and filter for matching ones
  let addedCount = 0;
  let totalProcessed = 0;
  const addedFiles = [];

  for (const filePath of videoFiles) {
    const existing = await prisma.localFile.findUnique({ where: { path: filePath } });
    
    const parsed = parseFilename(filePath);
    if (!parsed) continue;

    // Check if parsed media matches target media
    let isMatch = false;
    if (parsed.tmdbId && parsed.tmdbId === media.tmdbId) {
      isMatch = true;
    } else {
      const cleanParsedTitle = parsed.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      const cleanMediaTitle = media.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      if (cleanParsedTitle === cleanMediaTitle) {
        isMatch = true;
      }
    }

    if (!isMatch) continue;

    // If season filter is provided, check season
    if (media.type === 'tv' && season !== null && parsed.season !== season) {
      continue;
    }

    // If episode filter is provided, check episode range
    if (media.type === 'tv' && episode !== null && parsed.episode !== null) {
      const endEp = parsed.endEpisode || parsed.episode;
      if (episode < parsed.episode || episode > endEp) {
        continue;
      }
    }

    totalProcessed++;

    if (!existing) {
      // Delay slightly if it's a new file to avoid rate limits
      await sleep(250);
    }
    
    try {
      const localFile = await processSingleFile(filePath, media.type, apiKey);
      if (localFile && !existing) {
        addedCount++;
        addedFiles.push(filePath);
      }
    } catch (err) {
      console.error(`[Folder Scanner] Error processing target file ${filePath}:`, err.message);
    }
  }

  return { addedCount, totalProcessed, addedFiles };
}

module.exports = {
  scanAllFolders,
  scanSingleFolder,
  initFolderScanner,
  startWatcher,
  stopWatcher,
  scanMediaItem,
  getStatus: () => ({
    isScanning,
    lastScanTime,
    currentProgress
  })
};
