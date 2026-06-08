const express = require('express');
const prisma = require('../prismaClient');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.put('/', async (req, res) => {
  const { plexUser, tmdbApiKey, traktUsername, traktClientId } = req.body;
  
  try {
    const updated = await prisma.settings.update({
      where: { id: req.user.id },
      data: {
        plexUser: plexUser !== undefined ? plexUser : undefined,
        tmdbApiKey: tmdbApiKey !== undefined ? tmdbApiKey : undefined,
        traktUsername: traktUsername !== undefined ? traktUsername : undefined,
        traktClientId: traktClientId !== undefined ? traktClientId : undefined
      }
    });

    res.json({ 
      success: true, 
      plexUser: updated.plexUser, 
      tmdbApiKey: updated.tmdbApiKey,
      traktUsername: updated.traktUsername,
      traktClientId: updated.traktClientId
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
