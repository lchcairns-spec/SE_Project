const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/init');
const { logAudit } = require('../utils/audit');

const JWT_SECRET = process.env.JWT_SECRET;

// Verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Check if user has required role
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      logAudit(req.user.id, 'unauthorized_access_attempt', null, null, 
        `Attempted to access ${req.path}`, req.ip);
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

// Verify 2FA if enabled
async function verify2FA(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const db = getDatabase();
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT two_factor_enabled FROM users WHERE id = ?',
      [req.user.id],
      (err, row) => {
        db.close();
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (row && row.two_factor_enabled) {
          // In a real implementation, check 2FA token from request
          // For now, we'll allow if 2FA is set up (simplified)
          const twoFactorToken = req.headers['x-2fa-token'];
          if (!twoFactorToken) {
            return res.status(401).json({ 
              error: '2FA token required',
              requires2FA: true 
            });
          }
        }

        next();
      }
    );
  });
}

module.exports = {
  authenticateToken,
  requireRole,
  verify2FA
};

