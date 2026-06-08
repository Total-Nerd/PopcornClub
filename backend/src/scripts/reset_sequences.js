const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Resetting PostgreSQL sequences...');
  const tables = [
    { name: 'User', seq: '"User_id_seq"' },
    { name: 'Media', seq: '"Media_id_seq"' },
    { name: 'Collection', seq: '"Collection_id_seq"' },
    { name: 'WatchHistory', seq: '"WatchHistory_id_seq"' },
    { name: 'EpisodeCollection', seq: '"EpisodeCollection_id_seq"' },
    { name: 'EpisodeWatchHistory', seq: '"EpisodeWatchHistory_id_seq"' },
    { name: 'WatchHistoryLog', seq: '"WatchHistoryLog_id_seq"' },
    { name: 'CustomList', seq: '"CustomList_id_seq"' },
    { name: 'ListItem', seq: '"ListItem_id_seq"' },
    { name: 'LocalFolder', seq: '"LocalFolder_id_seq"' },
    { name: 'LocalFile', seq: '"LocalFile_id_seq"' }
  ];

  for (const t of tables) {
    try {
      await prisma.$executeRawUnsafe(`SELECT setval('${t.seq}', COALESCE((SELECT MAX(id)+1 FROM "${t.name}"), 1), false);`);
      console.log(`Sequence reset for ${t.name}.`);
    } catch (err) {
      console.error(`Could not reset sequence for table ${t.name}:`, err.message);
    }
  }
  console.log('All sequences reset.');
  process.exit(0);
}

main();
