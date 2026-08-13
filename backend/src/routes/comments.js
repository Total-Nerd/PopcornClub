const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { fetchTMDB } = require('../utils/tmdb');
const { sendMentionEmail } = require('../utils/mailer');

async function getOrCreateMedia(tmdbId, type) {
  if (!tmdbId || !type) return null;
  const parsedId = parseInt(tmdbId, 10);
  let media = await prisma.media.findFirst({
    where: { tmdbId: parsedId, type }
  });
  if (!media) {
    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    const tmdbApiKey = systemSettings?.tmdbApiKey;
    let title = `${type} #${parsedId}`;
    let overview = '';
    let releaseDate = null;
    let posterPath = null;
    
    if (tmdbApiKey) {
      try {
        const data = await fetchTMDB(`/3/${type}/${parsedId}`, tmdbApiKey);
        title = data.title || data.name || title;
        overview = data.overview || '';
        releaseDate = data.release_date || data.first_air_date || null;
        posterPath = data.poster_path || null;
      } catch (err) {}
    }
    
    media = await prisma.media.create({
      data: {
        tmdbId: parsedId,
        type,
        title,
        overview,
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        posterPath
      }
    });
  }
  return media.id;
}

async function appendMentionedUsers(comments) {
  const allUsernames = new Set();
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g;

  for (const c of comments) {
    if (c.content) {
      const matches = [...c.content.matchAll(mentionRegex)];
      matches.forEach(m => allUsernames.add(m[1]));
    }
  }

  if (allUsernames.size === 0) return comments;

  const users = await prisma.user.findMany({
    where: {
      OR: Array.from(allUsernames).map(u => ({ username: { equals: u, mode: 'insensitive' } }))
    },
    select: { username: true, avatarPath: true }
  });

  const userMap = {};
  users.forEach(u => { userMap[u.username.toLowerCase()] = u; });

  return comments.map(c => {
    const mentions = [];
    if (c.content) {
      const matches = [...c.content.matchAll(mentionRegex)];
      matches.forEach(m => {
        const u = userMap[m[1].toLowerCase()];
        if (u && !mentions.find(x => x.username.toLowerCase() === u.username.toLowerCase())) {
          mentions.push(u);
        }
      });
    }
    return { ...c, mentionedUsers: mentions };
  });
}

// Create a new comment
router.post('/', async (req, res) => {
  try {
    const { mediaId, mediaType, listId, season, episode, content, hasSpoilers, parentId } = req.body;
    const userId = req.user.id;

    if (!mediaId && !listId) {
      return res.status(400).json({ error: 'Must provide mediaId or listId' });
    }

    const localMediaId = mediaId && mediaType ? await getOrCreateMedia(mediaId, mediaType) : mediaId ? parseInt(mediaId) : null;
    if (mediaId && mediaType && !localMediaId) return res.status(400).json({ error: 'Invalid media' });

    const comment = await prisma.comment.create({
      data: {
        userId,
        mediaId: localMediaId,
        season: season ? parseInt(season) : null,
        episode: episode ? parseInt(episode) : null,
        listId: listId ? parseInt(listId) : null,
        content,
        hasSpoilers: Boolean(hasSpoilers),
        parentId: parentId ? parseInt(parentId) : null,
      },
      include: {
        user: {
          select: { id: true, username: true, avatarPath: true }
        },
        media: true // Include media to construct links for emails
      }
    });

    // Handle @mentions
    if (content) {
      const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
      const matches = [...content.matchAll(mentionRegex)];
      const mentionedUsernames = [...new Set(matches.map(m => m[1]))]; // Unique usernames

      if (mentionedUsernames.length > 0) {
        // Run asynchronously so it doesn't block the API response
        (async () => {
          try {
            const mentionedUsers = await prisma.user.findMany({
              where: {
                OR: mentionedUsernames.map(u => ({ username: { equals: u, mode: 'insensitive' } })),
                id: { not: userId } // Don't notify self
              },
              select: { email: true, username: true }
            });

            if (mentionedUsers.length > 0) {
              const appDomain = process.env.APP_DOMAIN || 'https://track.dooleysmith.uk';
              
              let mediaTitle = 'a List';
              let mediaLink = `${appDomain}/lists/${listId}`;
              let mediaPoster = null;
              
              if (comment.media) {
                mediaTitle = comment.media.title;
                mediaPoster = comment.media.posterPath;
                if (comment.season != null && comment.episode != null) mediaTitle += ` (S${comment.season}E${comment.episode})`;
                else if (comment.season != null) mediaTitle += ` (Season ${comment.season})`;

                mediaLink = `${appDomain}/${comment.media.type === 'movie' ? 'movies' : 'shows'}/${comment.media.tmdbId}`;
                if (comment.season != null && comment.episode != null) {
                  mediaLink += `/season/${comment.season}/episode/${comment.episode}`;
                }
                mediaLink += `?comment=${comment.id}`;
              }

              for (const u of mentionedUsers) {
                if (u.email) {
                  await sendMentionEmail(u.email, u.username, comment.user.username, content, mediaTitle, mediaLink, mediaPoster);
                }
              }
            }
          } catch (err) {
            console.error('Error processing mentions:', err);
          }
        })();
      }
    }

    res.json(comment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// Get comments for media (global and episode specific)
router.get('/media/:mediaId', async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { mediaType, season, episode } = req.query;

    const localMediaId = mediaType ? await getOrCreateMedia(mediaId, mediaType) : parseInt(mediaId);
    if (!localMediaId) return res.json([]);

    const whereClause = { mediaId: localMediaId };
    if (season) whereClause.season = parseInt(season);
    if (episode) whereClause.episode = parseInt(episode);

    const comments = await prisma.comment.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, username: true, avatarPath: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    const finalComments = await appendMentionedUsers(comments);
    res.json(finalComments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Get comments for a list
router.get('/list/:listId', async (req, res) => {
  try {
    const { listId } = req.params;
    const comments = await prisma.comment.findMany({
      where: { listId: parseInt(listId) },
      include: {
        user: { select: { id: true, username: true, avatarPath: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    const finalComments = await appendMentionedUsers(comments);
    res.json(finalComments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Delete a comment
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const comment = await prisma.comment.findUnique({ where: { id: parseInt(id) } });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    
    // Only author or admin can delete
    if (comment.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    await prisma.comment.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Edit a comment (toggle spoiler, etc)
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, hasSpoilers } = req.body;
    const userId = req.user.id;

    const existing = await prisma.comment.findUnique({ where: { id: parseInt(id) } });
    if (!existing) return res.status(404).json({ error: 'Comment not found' });
    if (existing.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await prisma.comment.update({
      where: { id: parseInt(id) },
      data: {
        content: content !== undefined ? content : existing.content,
        hasSpoilers: hasSpoilers !== undefined ? Boolean(hasSpoilers) : existing.hasSpoilers
      }
    });
    res.json(updated);
  } catch (error) {
    console.error('Error editing comment:', error);
    res.status(500).json({ error: 'Failed to edit comment' });
  }
});

module.exports = router;
