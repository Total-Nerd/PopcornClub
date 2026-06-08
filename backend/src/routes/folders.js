const express = require('express');
const fs = require('fs');
const path = require('path');
const prisma = require('../prismaClient');
const { authenticateToken } = require('../middleware/auth');
const { scanAllFolders, scanSingleFolder, startWatcher, stopWatcher, getStatus } = require('../utils/folderScanner');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/folders - List folders + scanner status
router.get('/', async (req, res) => {
  try {
    const folders = await prisma.localFolder.findMany({
      orderBy: { createdAt: 'asc' }
    });
    const status = getStatus();
    res.json({
      folders,
      status
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

const { execSync } = require('child_process');

function getSystemDrives() {
  const drives = [];
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  if (isWindows) {
    try {
      const stdout = execSync('wmic logicaldisk get name').toString();
      const wmicDrives = stdout
        .split('\n')
        .map(line => line.trim())
        .filter(line => /^[A-Z]:$/i.test(line))
        .map(drive => drive + '\\');
      if (wmicDrives.length > 0) {
        return wmicDrives;
      }
    } catch (err) {
      // Fallback
    }
    for (let i = 65; i <= 90; i++) {
      const drive = String.fromCharCode(i) + ':\\';
      try {
        if (fs.existsSync(drive)) {
          drives.push(drive);
        }
      } catch (e) {}
    }
    if (drives.length === 0) {
      drives.push('C:\\');
    }
  } else if (isMac) {
    drives.push('/');
    try {
      const volumes = fs.readdirSync('/Volumes');
      for (const vol of volumes) {
        if (vol.startsWith('.')) continue;
        const volPath = path.join('/Volumes', vol);
        try {
          const stat = fs.statSync(volPath);
          if (stat.isDirectory()) {
            drives.push(volPath);
          }
        } catch (e) {}
      }
    } catch (err) {}
  } else {
    // Linux / Docker container
    drives.push('/');
    const checkPaths = ['/mnt', '/media'];
    for (const p of checkPaths) {
      try {
        if (fs.existsSync(p)) {
          const subdirs = fs.readdirSync(p);
          for (const subdir of subdirs) {
            if (subdir.startsWith('.')) continue;
            if (['cdrom', 'floppy', 'usb'].includes(subdir.toLowerCase())) continue;
            const fullPath = path.join(p, subdir);
            if (fs.statSync(fullPath).isDirectory()) {
              drives.push(fullPath);
            }
          }
        }
      } catch (e) {}
    }

    // Scan root / for single-letter drives (e.g., /c, /d) or host mappings (e.g., /host-c, /data, /share)
    try {
      const rootItems = fs.readdirSync('/');
      for (const item of rootItems) {
        if (item.length === 1 && /^[a-z]$/i.test(item)) {
          const fullPath = path.join('/', item);
          if (fs.statSync(fullPath).isDirectory()) {
            drives.push(fullPath);
          }
        }
        if (item.toLowerCase().startsWith('host') || item === 'data' || item === 'share' || item === 'movies' || item === 'tv') {
          const fullPath = path.join('/', item);
          if (fs.statSync(fullPath).isDirectory()) {
            drives.push(fullPath);
          }
        }
      }
    } catch (e) {}
  }

  return [...new Set(drives)].map(d => path.resolve(d));
}

// GET /api/folders/browse - Browse directory structure
router.get('/browse', async (req, res) => {
  let targetPath = req.query.path || '/';
  
  // Resolve path
  targetPath = path.resolve(targetPath);

  try {
    if (!fs.existsSync(targetPath)) {
      // Fallback to container root or cwd if directory doesn't exist
      targetPath = path.resolve('/');
    }

    const stat = await fs.promises.stat(targetPath);
    if (!stat.isDirectory()) {
      targetPath = path.resolve('/');
    }

    const items = await fs.promises.readdir(targetPath, { withFileTypes: true });
    const directories = [];

    for (const item of items) {
      // Ignore hidden directories
      if (item.name.startsWith('.')) continue;

      if (item.isDirectory()) {
        directories.push({
          name: item.name,
          path: path.join(targetPath, item.name)
        });
      }
    }

    // Sort alphabetically
    directories.sort((a, b) => a.name.localeCompare(b.name));

    const rootPath = path.parse(targetPath).root;
    const parentPath = targetPath === rootPath ? null : path.dirname(targetPath);
    const drives = getSystemDrives();

    res.json({
      currentPath: targetPath,
      parentPath,
      drives,
      directories
    });
  } catch (err) {
    console.error(`[Folders Route] Error browsing directory ${targetPath}:`, err.message);
    res.status(500).json({ error: `Failed to browse directory: ${err.message}` });
  }
});

// POST /api/folders - Add a local folder configuration
router.post('/', async (req, res) => {
  const { path: folderPath, type, watch } = req.body;

  if (!folderPath || !type) {
    return res.status(400).json({ error: 'Folder path and type are required' });
  }

  if (type !== 'movie' && type !== 'tv') {
    return res.status(400).json({ error: 'Invalid folder type. Must be "movie" or "tv"' });
  }

  // Resolve and normalize path
  const resolvedPath = path.resolve(folderPath);

  // Verify path exists on disk
  if (!fs.existsSync(resolvedPath)) {
    return res.status(400).json({ error: `Directory does not exist on disk: ${resolvedPath}. Please verify Docker volume mappings.` });
  }

  const stat = await fs.statSync(resolvedPath);
  if (!stat.isDirectory()) {
    return res.status(400).json({ error: `Path is not a directory: ${resolvedPath}` });
  }

  try {
    // Check if duplicate path
    const existing = await prisma.localFolder.findUnique({ where: { path: resolvedPath } });
    if (existing) {
      return res.status(400).json({ error: 'This folder path has already been added' });
    }

    const newFolder = await prisma.localFolder.create({
      data: {
        path: resolvedPath,
        type,
        watch: !!watch
      }
    });

    // Start watching if watch is enabled
    if (newFolder.watch) {
      startWatcher(newFolder);
    }

    // Trigger asynchronous background scan for this folder
    scanSingleFolder(newFolder).catch(err => console.error('[Folders Route] Error scanning after add:', err));

    res.json({ success: true, folder: newFolder });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create folder config' });
  }
});

// PUT /api/folders/:id - Toggle watch option
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { watch } = req.body;

  try {
    const folder = await prisma.localFolder.findUnique({ where: { id: parseInt(id, 10) } });
    if (!folder) {
      return res.status(404).json({ error: 'Folder configuration not found' });
    }

    const updated = await prisma.localFolder.update({
      where: { id: folder.id },
      data: { watch: !!watch }
    });

    if (updated.watch) {
      startWatcher(updated);
      // Trigger a scan immediately so existing files are pulled in when monitoring starts
      scanSingleFolder(updated).catch(err => console.error('[Folders Route] Error scanning after watch toggle:', err));
    } else {
      stopWatcher(updated.id);
    }

    res.json({ success: true, folder: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update folder config' });
  }
});

// DELETE /api/folders/:id - Delete folder config and clean up references
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const folder = await prisma.localFolder.findUnique({ where: { id: parseInt(id, 10) } });
    if (!folder) {
      return res.status(404).json({ error: 'Folder configuration not found' });
    }

    // Stop watcher if active
    stopWatcher(folder.id);

    // Identify and delete all LocalFile references belonging to this folder prefix
    const folderPrefix = folder.path.endsWith(path.sep) ? folder.path : folder.path + path.sep;
    const dbFiles = await prisma.localFile.findMany({
      where: {
        path: {
          startsWith: folderPrefix
        }
      }
    });

    // Delete local files
    await prisma.localFile.deleteMany({
      where: {
        path: {
          startsWith: folderPrefix
        }
      }
    });

    // Run uncollect verification checks for the deleted paths
    for (const file of dbFiles) {
      if (file.type === 'tv') {
        const count = await prisma.localFile.count({
          where: {
            mediaId: file.mediaId,
            season: file.season,
            episode: file.episode
          }
        });
        if (count === 0) {
          await prisma.episodeCollection.deleteMany({
            where: {
              mediaId: file.mediaId,
              season: file.season,
              episode: file.episode
            }
          });
        }
      } else {
        const count = await prisma.localFile.count({
          where: {
            mediaId: file.mediaId
          }
        });
        if (count === 0) {
          await prisma.collection.deleteMany({
            where: {
              mediaId: file.mediaId
            }
          });
        }
      }
    }

    // Delete the configuration
    await prisma.localFolder.delete({ where: { id: folder.id } });

    res.json({ success: true });
  } catch (error) {
    console.error('[Folders Route] Failed to delete folder config:', error.message);
    res.status(500).json({ error: 'Failed to delete folder config' });
  }
});

// POST /api/folders/scan - Trigger manual full scan
router.post('/scan', async (req, res) => {
  scanAllFolders()
    .then(() => console.log('[Folders Route] Manual full scan complete.'))
    .catch(err => console.error('[Folders Route] Manual scan failed:', err));

  res.json({ success: true, message: 'Scan started in the background.' });
});

// POST /api/folders/:id/scan - Trigger manual scan for a specific folder
router.post('/:id/scan', async (req, res) => {
  const { id } = req.params;
  try {
    const folder = await prisma.localFolder.findUnique({ where: { id: parseInt(id, 10) } });
    if (!folder) {
      return res.status(404).json({ error: 'Folder configuration not found' });
    }

    scanSingleFolder(folder)
      .then(() => console.log(`[Folders Route] Manual scan for folder ${folder.path} complete.`))
      .catch(err => console.error(`[Folders Route] Manual scan for folder ${folder.path} failed:`, err));

    res.json({ success: true, message: `Scan for ${folder.path} started in the background.` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to trigger folder scan' });
  }
});

module.exports = router;
