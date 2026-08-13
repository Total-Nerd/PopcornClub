const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey_change_in_production', async (err, decoded) => {
    if (err) return res.sendStatus(403);
    
    try {
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user) return res.sendStatus(403);
      req.user = user;
      next();
    } catch (dbErr) {
      console.error('Database error in auth middleware:', dbErr.message);
      return res.sendStatus(500);
    }
  });
};


const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return next();

  jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey_change_in_production', async (err, decoded) => {
    if (err) return next();
    try {
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (user) {
        req.user = user;
      }
      next();
    } catch (dbErr) {
      next();
    }
  });
};

module.exports = { authenticateToken, optionalAuth };
