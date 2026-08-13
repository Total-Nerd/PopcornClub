const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

// Follow a user
router.post('/follow/:userId', async (req, res) => {
  try {
    const followingId = parseInt(req.params.userId);
    const followerId = req.user.id;

    if (followingId === followerId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    await prisma.follows.upsert({
      where: {
        followerId_followingId: {
          followerId,
          followingId
        }
      },
      create: {
        followerId,
        followingId
      },
      update: {} // do nothing if it exists
    });

    res.json({ success: true, followed: true });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// Unfollow a user
router.delete('/unfollow/:userId', async (req, res) => {
  try {
    const followingId = parseInt(req.params.userId);
    const followerId = req.user.id;

    await prisma.follows.deleteMany({
      where: {
        followerId,
        followingId
      }
    });

    res.json({ success: true, followed: false });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// Get social feed
router.get('/feed', async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { userId } = req.query;
    
    // Get list of friends (people the user follows)
    let targetUserIds = [];

    if (userId) {
      // If a specific userId is requested, only fetch feed for them
      targetUserIds = [parseInt(userId)];
    } else {
      // Otherwise get list of friends
      const following = await prisma.follows.findMany({
        where: { followerId: currentUserId },
        select: { followingId: true }
      });
      targetUserIds = following.map(f => f.followingId);
      
      // If no friends, return empty
      if (targetUserIds.length === 0) {
        return res.json([]);
      }
    }

    // Get recent watch history from friends
    const watchHistory = await prisma.watchHistoryLog.findMany({
      where: {
        userId: { in: targetUserIds },
        isCompleted: true
      },
      include: {
        user: { select: { id: true, username: true, avatarPath: true } },
        media: { select: { id: true, title: true, type: true, posterPath: true, tmdbId: true } }
      },
      orderBy: { watchedAt: 'desc' },
      take: 20
    });

    const reactions = await prisma.reaction.findMany({
      where: { userId: { in: targetUserIds } },
      include: {
        user: { select: { id: true, username: true, avatarPath: true } },
        media: { select: { id: true, title: true, type: true, posterPath: true, tmdbId: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const comments = await prisma.comment.findMany({
      where: { userId: { in: targetUserIds }, mediaId: { not: null }, hasSpoilers: false }, // Only include non-spoiler comments with media in feed
      include: {
        user: { select: { id: true, username: true, avatarPath: true } },
        media: { select: { id: true, title: true, type: true, posterPath: true, tmdbId: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // Format items as feed items
    let feed = watchHistory.map(log => ({
      id: `watch_${log.id}`,
      type: 'watch',
      user: log.user,
      media: log.media,
      season: log.season,
      episode: log.episode,
      createdAt: log.watchedAt
    }));

    feed = feed.concat(reactions.map(r => ({
      id: `reaction_${r.id}`,
      type: 'reaction',
      user: r.user,
      media: r.media,
      season: r.season,
      episode: r.episode,
      emoji: r.emoji,
      createdAt: r.createdAt
    })));

    feed = feed.concat(comments.map(c => ({
      id: `comment_${c.id}`,
      type: 'comment',
      user: c.user,
      media: c.media,
      season: c.season,
      episode: c.episode,
      content: c.content,
      createdAt: c.createdAt
    })));

    // Sort combined feed and take top 30
    feed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    feed = feed.slice(0, 30);

    res.json(feed);
  } catch (error) {
    console.error('Error fetching social feed:', error);
    res.status(500).json({ error: 'Failed to fetch social feed' });
  }
});

// Search users to follow
router.get('/users/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    const users = await prisma.user.findMany({
      where: {
        username: { contains: q, mode: 'insensitive' },
        id: { not: req.user.id }
      },
      select: { id: true, username: true, avatarPath: true },
      take: 10
    });
    
    // Check if currently following these users
    const following = await prisma.follows.findMany({
      where: {
        followerId: req.user.id,
        followingId: { in: users.map(u => u.id) }
      }
    });
    
    const followingSet = new Set(following.map(f => f.followingId));
    
    const results = users.map(u => ({
      ...u,
      isFollowing: followingSet.has(u.id)
    }));

    res.json(results);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Get users the current user follows
router.get('/following', async (req, res) => {
  try {
    const following = await prisma.follows.findMany({
      where: { followerId: req.user.id },
      include: {
        following: { select: { id: true, username: true, avatarPath: true } }
      }
    });
    res.json(following.map(f => f.following));
  } catch (error) {
    console.error('Error fetching following:', error);
    res.status(500).json({ error: 'Failed to fetch following users' });
  }
});

module.exports = router;
