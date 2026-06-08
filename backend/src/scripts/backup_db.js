const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting full database backup...');
  const backup = {};

  try {
    // 1. Settings
    try {
      backup.settings = await prisma.settings.findMany();
      console.log(`Backed up ${backup.settings.length} settings records.`);
    } catch (err) {
      console.log('No Settings table found or error:', err.message);
      backup.settings = [];
    }

    // 2. Media
    try {
      backup.media = await prisma.media.findMany();
      console.log(`Backed up ${backup.media.length} media records.`);
    } catch (err) {
      console.log('No Media table found or error:', err.message);
      backup.media = [];
    }

    // 3. Collection
    try {
      backup.collections = await prisma.collection.findMany();
      console.log(`Backed up ${backup.collections.length} collection records.`);
    } catch (err) {
      console.log('No Collection table found or error:', err.message);
      backup.collections = [];
    }

    // 4. WatchHistory
    try {
      backup.watchHistory = await prisma.watchHistory.findMany();
      console.log(`Backed up ${backup.watchHistory.length} watchHistory records.`);
    } catch (err) {
      console.log('No WatchHistory table found or error:', err.message);
      backup.watchHistory = [];
    }

    // 5. EpisodeCollection
    try {
      backup.episodeCollections = await prisma.episodeCollection.findMany();
      console.log(`Backed up ${backup.episodeCollections.length} episodeCollection records.`);
    } catch (err) {
      console.log('No EpisodeCollection table found or error:', err.message);
      backup.episodeCollections = [];
    }

    // 6. EpisodeWatchHistory
    try {
      backup.episodeWatchHistory = await prisma.episodeWatchHistory.findMany();
      console.log(`Backed up ${backup.episodeWatchHistory.length} episodeWatchHistory records.`);
    } catch (err) {
      console.log('No EpisodeWatchHistory table found or error:', err.message);
      backup.episodeWatchHistory = [];
    }

    // 7. WatchHistoryLog
    try {
      backup.watchHistoryLogs = await prisma.watchHistoryLog.findMany();
      console.log(`Backed up ${backup.watchHistoryLogs.length} watchHistoryLog records.`);
    } catch (err) {
      console.log('No WatchHistoryLog table found or error:', err.message);
      backup.watchHistoryLogs = [];
    }

    // 8. CustomList
    try {
      backup.customLists = await prisma.customList.findMany();
      console.log(`Backed up ${backup.customLists.length} customList records.`);
    } catch (err) {
      console.log('No CustomList table found or error:', err.message);
      backup.customLists = [];
    }

    // 9. ListItem
    try {
      backup.listItems = await prisma.listItem.findMany();
      console.log(`Backed up ${backup.listItems.length} listItem records.`);
    } catch (err) {
      console.log('No ListItem table found or error:', err.message);
      backup.listItems = [];
    }

    // 10. LocalFolder
    try {
      backup.localFolders = await prisma.localFolder.findMany();
      console.log(`Backed up ${backup.localFolders.length} localFolder records.`);
    } catch (err) {
      console.log('No LocalFolder table found or error:', err.message);
      backup.localFolders = [];
    }

    // 11. LocalFile
    try {
      backup.localFiles = await prisma.localFile.findMany();
      console.log(`Backed up ${backup.localFiles.length} localFile records.`);
    } catch (err) {
      console.log('No LocalFile table found or error:', err.message);
      backup.localFiles = [];
    }

    // Save to backup file
    const backupPath = path.join(__dirname, '../../migrate_temp.json');
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf-8');
    console.log(`Database backup saved successfully to: ${backupPath}`);
    process.exit(0);
  } catch (err) {
    console.error('Fatal error during backup:', err);
    process.exit(1);
  }
}

main();
