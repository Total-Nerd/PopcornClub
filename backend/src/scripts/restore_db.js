const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database restore...');
  const backupPath = path.join(__dirname, '../../migrate_temp.json');
  
  if (!fs.existsSync(backupPath)) {
    console.error(`Backup file not found at: ${backupPath}`);
    process.exit(1);
  }

  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));

  try {
    // Clean up all tables in order of dependency
    console.log('Cleaning up existing database records for a clean restore...');
    await prisma.listItem.deleteMany();
    await prisma.customList.deleteMany();
    await prisma.watchHistoryLog.deleteMany();
    await prisma.episodeWatchHistory.deleteMany();
    await prisma.episodeCollection.deleteMany();
    await prisma.watchHistory.deleteMany();
    await prisma.collection.deleteMany();
    await prisma.localFile.deleteMany();
    await prisma.localFolder.deleteMany();
    await prisma.media.deleteMany();
    await prisma.user.deleteMany();
    await prisma.systemSettings.deleteMany();
    console.log('Database cleanup completed.');

    // 1. Restore User
    console.log('Restoring Users...');
    let adminUserId = 1;
    if (backup.settings && backup.settings.length > 0) {
      for (const s of backup.settings) {
        const token = crypto.randomBytes(16).toString('hex');
        const user = await prisma.user.create({
          data: {
            id: s.id,
            username: s.username,
            passwordHash: s.passwordHash,
            role: s.id === 1 ? 'admin' : 'user', // first is admin
            plexUser: s.plexUser,
            plexWebhookToken: token,
            traktUsername: s.traktUsername,
            traktClientId: s.traktClientId
          }
        });
        if (s.id === 1) adminUserId = user.id;
        console.log(`Created User: ${user.username} (Role: ${user.role}, Webhook Token: ${token})`);
      }
    } else {
      // Fallback: create default admin user if no settings found
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('admin123', salt);
      const token = crypto.randomBytes(16).toString('hex');
      const user = await prisma.user.create({
        data: {
          id: 1,
          username: 'admin',
          passwordHash,
          role: 'admin',
          plexWebhookToken: token
        }
      });
      adminUserId = user.id;
      console.log(`Created default Admin User: admin (Password: admin123, Webhook Token: ${token})`);
    }

    // 2. Restore SystemSettings
    console.log('Restoring SystemSettings...');
    const firstSettings = backup.settings?.[0];
    await prisma.systemSettings.upsert({
      where: { id: 1 },
      update: {
        tmdbApiKey: firstSettings?.tmdbApiKey || null
      },
      create: {
        id: 1,
        tmdbApiKey: firstSettings?.tmdbApiKey || null
      }
    });
    console.log('SystemSettings restored.');

    // 3. Restore Media
    console.log('Restoring Media...');
    if (backup.media && backup.media.length > 0) {
      for (const m of backup.media) {
        await prisma.media.create({
          data: {
            id: m.id,
            tmdbId: m.tmdbId,
            type: m.type,
            title: m.title,
            overview: m.overview,
            releaseDate: m.releaseDate ? new Date(m.releaseDate) : null,
            posterPath: m.posterPath,
            genres: m.genres,
            createdAt: new Date(m.createdAt),
            updatedAt: new Date(m.updatedAt)
          }
        });
      }
      console.log(`Restored ${backup.media.length} Media records.`);
    }

    // 4. Restore LocalFolder
    console.log('Restoring LocalFolders...');
    if (backup.localFolders && backup.localFolders.length > 0) {
      for (const f of backup.localFolders) {
        await prisma.localFolder.create({
          data: {
            id: f.id,
            path: f.path,
            type: f.type,
            watch: f.watch,
            createdAt: new Date(f.createdAt),
            updatedAt: new Date(f.updatedAt)
          }
        });
      }
      console.log(`Restored ${backup.localFolders.length} LocalFolder records.`);
    }

    // 5. Restore LocalFile
    console.log('Restoring LocalFiles...');
    if (backup.localFiles && backup.localFiles.length > 0) {
      for (const f of backup.localFiles) {
        await prisma.localFile.create({
          data: {
            id: f.id,
            path: f.path,
            type: f.type,
            mediaId: f.mediaId,
            season: f.season,
            episode: f.episode,
            lastSeen: new Date(f.lastSeen),
            missingSince: f.missingSince ? new Date(f.missingSince) : null,
            manuallyCorrected: f.manuallyCorrected,
            createdAt: new Date(f.createdAt),
            updatedAt: new Date(f.updatedAt)
          }
        });
      }
      console.log(`Restored ${backup.localFiles.length} LocalFile records.`);
    }

    // 6. Restore Collections (link to admin user)
    console.log('Restoring Collections...');
    if (backup.collections && backup.collections.length > 0) {
      for (const c of backup.collections) {
        await prisma.collection.create({
          data: {
            id: c.id,
            mediaId: c.mediaId,
            userId: adminUserId,
            collectedAt: new Date(c.collectedAt)
          }
        });
      }
      console.log(`Restored ${backup.collections.length} Collection records linked to user ${adminUserId}.`);
    }

    // 7. Restore WatchHistory (link to admin user)
    console.log('Restoring WatchHistories...');
    if (backup.watchHistory && backup.watchHistory.length > 0) {
      for (const w of backup.watchHistory) {
        await prisma.watchHistory.create({
          data: {
            id: w.id,
            mediaId: w.mediaId,
            userId: adminUserId,
            watchedAt: new Date(w.watchedAt)
          }
        });
      }
      console.log(`Restored ${backup.watchHistory.length} WatchHistory records linked to user ${adminUserId}.`);
    }

    // 8. Restore EpisodeCollection (link to admin user)
    console.log('Restoring EpisodeCollections...');
    if (backup.episodeCollections && backup.episodeCollections.length > 0) {
      for (const ec of backup.episodeCollections) {
        await prisma.episodeCollection.create({
          data: {
            id: ec.id,
            mediaId: ec.mediaId,
            season: ec.season,
            episode: ec.episode,
            userId: adminUserId,
            collectedAt: new Date(ec.collectedAt)
          }
        });
      }
      console.log(`Restored ${backup.episodeCollections.length} EpisodeCollection records linked to user ${adminUserId}.`);
    }

    // 9. Restore EpisodeWatchHistory (link to admin user)
    console.log('Restoring EpisodeWatchHistories...');
    if (backup.episodeWatchHistory && backup.episodeWatchHistory.length > 0) {
      for (const ew of backup.episodeWatchHistory) {
        await prisma.episodeWatchHistory.create({
          data: {
            id: ew.id,
            mediaId: ew.mediaId,
            season: ew.season,
            episode: ew.episode,
            userId: adminUserId,
            watchedAt: new Date(ew.watchedAt)
          }
        });
      }
      console.log(`Restored ${backup.episodeWatchHistory.length} EpisodeWatchHistory records linked to user ${adminUserId}.`);
    }

    // 10. Restore WatchHistoryLogs (link to admin user)
    console.log('Restoring WatchHistoryLogs...');
    if (backup.watchHistoryLogs && backup.watchHistoryLogs.length > 0) {
      for (const log of backup.watchHistoryLogs) {
        await prisma.watchHistoryLog.create({
          data: {
            id: log.id,
            mediaId: log.mediaId,
            type: log.type,
            season: log.season,
            episode: log.episode,
            watchedAt: new Date(log.watchedAt),
            duration: log.duration,
            viewOffset: log.viewOffset,
            isCompleted: log.isCompleted,
            userId: adminUserId,
            createdAt: new Date(log.createdAt),
            updatedAt: new Date(log.updatedAt)
          }
        });
      }
      console.log(`Restored ${backup.watchHistoryLogs.length} WatchHistoryLog records linked to user ${adminUserId}.`);
    }

    // 11. Restore CustomLists (link to admin user)
    console.log('Restoring CustomLists...');
    if (backup.customLists && backup.customLists.length > 0) {
      for (const cl of backup.customLists) {
        await prisma.customList.create({
          data: {
            id: cl.id,
            name: cl.name,
            userId: adminUserId,
            createdAt: new Date(cl.createdAt),
            updatedAt: new Date(cl.updatedAt)
          }
        });
      }
      console.log(`Restored ${backup.customLists.length} CustomList records linked to user ${adminUserId}.`);
    }

    // 12. Restore ListItems
    console.log('Restoring ListItems...');
    if (backup.listItems && backup.listItems.length > 0) {
      for (const li of backup.listItems) {
        await prisma.listItem.create({
          data: {
            id: li.id,
            listId: li.listId,
            mediaId: li.mediaId,
            addedAt: new Date(li.addedAt)
          }
        });
      }
      console.log(`Restored ${backup.listItems.length} ListItem records.`);
    }

    // 13. Reset PostgreSQL sequences so autoincrement works properly
    console.log('Resetting PostgreSQL sequences...');
    const tables = [
      { name: 'User', seq: 'User_id_seq' },
      { name: 'Media', seq: 'Media_id_seq' },
      { name: 'Collection', seq: 'Collection_id_seq' },
      { name: 'WatchHistory', seq: 'WatchHistory_id_seq' },
      { name: 'EpisodeCollection', seq: 'EpisodeCollection_id_seq' },
      { name: 'EpisodeWatchHistory', seq: 'EpisodeWatchHistory_id_seq' },
      { name: 'WatchHistoryLog', seq: 'WatchHistoryLog_id_seq' },
      { name: 'CustomList', seq: 'CustomList_id_seq' },
      { name: 'ListItem', seq: 'ListItem_id_seq' },
      { name: 'LocalFolder', seq: 'LocalFolder_id_seq' },
      { name: 'LocalFile', seq: 'LocalFile_id_seq' }
    ];

    for (const t of tables) {
      try {
        await prisma.$executeRawUnsafe(`SELECT setval('${t.seq}', COALESCE((SELECT MAX(id)+1 FROM "${t.name}"), 1), false);`);
        console.log(`Sequence reset for ${t.name}.`);
      } catch (err) {
        console.log(`Could not reset sequence for table ${t.name}:`, err.message);
      }
    }

    console.log('\nDatabase restore completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error during restore:', err);
    process.exit(1);
  }
}

main();
