const prisma = require('../prismaClient');

/**
 * Automatically archives requests for a media item when it is collected.
 * @param {number} mediaId - The ID of the Media record
 * @param {string} type - 'movie' or 'tv'
 * @param {number|null} season - Season number (for TV episodes)
 * @param {number|null} episode - Episode number (for TV episodes)
 */
async function archiveRequestsOnCollect(mediaId, type, season = null, episode = null) {
  try {
    if (type === 'movie') {
      // Archive all pending/confirmed requests for this movie
      await prisma.request.updateMany({
        where: {
          mediaId,
          status: { in: ['pending', 'confirmed'] }
        },
        data: { status: 'collected' }
      });
      console.log(`[RequestManager] Collected requests for Movie Media #${mediaId}`);
    } else if (type === 'tv') {
      if (season !== null && episode !== null) {
        // Archive the specific episode request
        await prisma.request.updateMany({
          where: {
            mediaId,
            season,
            episode,
            status: { in: ['pending', 'confirmed'] }
          },
          data: { status: 'collected' }
        });
        
        console.log(`[RequestManager] Collected requests for TV Episode S${season}E${episode} of Media #${mediaId}`);
      } else {
        // If they collected a whole show or season at once (e.g. manual /collect endpoint)
        await prisma.request.updateMany({
          where: {
            mediaId,
            status: { in: ['pending', 'confirmed'] }
          },
          data: { status: 'collected' }
        });
        console.log(`[RequestManager] Collected all requests for TV Show Media #${mediaId}`);
      }
    }
  } catch (error) {
    console.error('[RequestManager] Error archiving requests:', error);
  }
}

module.exports = {
  archiveRequestsOnCollect
};
