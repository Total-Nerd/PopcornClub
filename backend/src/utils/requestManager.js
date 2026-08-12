const prisma = require('../prismaClient');
const { sendUserRequestUpdateNotification } = require('./mailer');

/**
 * Automatically archives requests for a media item when it is collected.
 * @param {number} mediaId - The ID of the Media record
 * @param {string} type - 'movie' or 'tv'
 * @param {number|null} season - Season number (for TV episodes)
 * @param {number|null} episode - Episode number (for TV episodes)
 */
async function archiveRequestsOnCollect(mediaId, type, season = null, episode = null) {
  try {
    let whereClause = {
      mediaId,
      status: { in: ['pending', 'confirmed'] }
    };

    if (type === 'tv' && season !== null && episode !== null) {
      whereClause.season = season;
      whereClause.episode = episode;
    }

    // Fetch affected requests to send notifications
    const affectedRequests = await prisma.request.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, username: true, email: true, avatarPath: true } },
        media: true
      }
    });

    if (affectedRequests.length > 0) {
      await prisma.request.updateMany({
        where: whereClause,
        data: { status: 'collected' }
      });
      
      console.log(`[RequestManager] Collected ${affectedRequests.length} requests for Media #${mediaId}`);

      // Send notifications
      for (const req of affectedRequests) {
        sendUserRequestUpdateNotification(
          req.user,
          req.media,
          'collected',
          null,
          req.season,
          req.episode
        ).catch(err => console.error('[Mailer] Background user update notification error:', err));
      }
    }
  } catch (error) {
    console.error('[RequestManager] Error archiving requests:', error);
  }
}

module.exports = {
  archiveRequestsOnCollect
};
