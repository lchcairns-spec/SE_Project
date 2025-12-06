const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { getDatabase } = require('../database/init');
const { authenticateToken, verify2FA } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const HKMU_DOMAIN = process.env.HKMU_EMAIL_DOMAIN || '@hkmu.edu.hk';
const ADMIN_DOMAIN = process.env.ADMIN_EMAIL_DOMAIN || '@admin.com';

// Register user
router.post('/register', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  // Check email domain
  if (!email.endsWith(HKMU_DOMAIN) && !email.endsWith(ADMIN_DOMAIN)) {
    return res.status(400).json({ error: 'Email must be from HKMU or admin domain' });
  }

  // Determine role based on email
  let role = 'voter';
  if (email.endsWith(ADMIN_DOMAIN)) {
    role = 'poll_admin';
  }

  const db = getDatabase();
  const passwordHash = await bcrypt.hash(password, 10);

  db.get('SELECT id FROM users WHERE email = ?', [email], (err, existingUser) => {
    if (err) {
      db.close();
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingUser) {
      db.close();
      return res.status(400).json({ error: 'Email already registered' });
    }

    db.run(
      'INSERT INTO users (email, password_hash, role, verified) VALUES (?, ?, ?, ?)',
      [email, passwordHash, role, 1], // Auto-verify for simplicity
      function(err) {
        if (err) {
          db.close();
          return res.status(500).json({ error: 'Failed to register user' });
        }

        logAudit(this.lastID, 'user_registered', 'user', this.lastID, 
          `Registered with email: ${email}`, req.ip);

        db.close();
        res.status(201).json({ 
          message: 'Registration successful',
          userId: this.lastID 
        });
      }
    );
  });
});

// Login
router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, twoFactorToken } = req.body;
  const db = getDatabase();

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      db.close();
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      db.close();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      db.close();
      logAudit(user.id, 'failed_login', 'user', user.id, 'Invalid password', req.ip);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check 2FA if enabled
    if (user.two_factor_enabled) {
      if (!twoFactorToken) {
        db.close();
        return res.status(401).json({ 
          error: '2FA token required',
          requires2FA: true 
        });
      }

      const verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: 'base32',
        token: twoFactorToken,
        window: 2
      });

      if (!verified) {
        db.close();
        logAudit(user.id, 'failed_2fa', 'user', user.id, 'Invalid 2FA token', req.ip);
        return res.status(401).json({ error: 'Invalid 2FA token' });
      }
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    logAudit(user.id, 'user_login', 'user', user.id, 'Successful login', req.ip);

    db.close();
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        twoFactorEnabled: user.two_factor_enabled === 1
      }
    });
  });
});

// Setup 2FA
router.post('/setup-2fa', authenticateToken, (req, res) => {
  const secret = speakeasy.generateSecret({
    name: `Online Voting System (${req.user.email})`,
    issuer: 'Online Voting System'
  });

  const db = getDatabase();
  db.run(
    'UPDATE users SET two_factor_secret = ? WHERE id = ?',
    [secret.base32, req.user.id],
    (err) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Failed to setup 2FA' });
      }

      QRCode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
        db.close();
        if (err) {
          return res.status(500).json({ error: 'Failed to generate QR code' });
        }

        res.json({
          secret: secret.base32,
          qrCode: dataUrl,
          manualEntryKey: secret.base32
        });
      });
    }
  );
});

// Enable 2FA
router.post('/enable-2fa', authenticateToken, [
  body('token').notEmpty().withMessage('2FA token required')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { token } = req.body;
  const db = getDatabase();

  db.get('SELECT two_factor_secret FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user || !user.two_factor_secret) {
      db.close();
      return res.status(400).json({ error: '2FA not set up. Please setup first.' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    if (!verified) {
      db.close();
      return res.status(400).json({ error: 'Invalid 2FA token' });
    }

    db.run(
      'UPDATE users SET two_factor_enabled = 1 WHERE id = ?',
      [req.user.id],
      (err) => {
        db.close();
        if (err) {
          return res.status(500).json({ error: 'Failed to enable 2FA' });
        }

        logAudit(req.user.id, '2fa_enabled', 'user', req.user.id, '2FA enabled', req.ip);
        res.json({ message: '2FA enabled successfully' });
      }
    );
  });
});

// Get current user
router.get('/me', authenticateToken, (req, res) => {
  const db = getDatabase();
  db.get('SELECT id, email, role, two_factor_enabled FROM users WHERE id = ?', 
    [req.user.id], (err, user) => {
      db.close();
      if (err || !user) {
        return res.status(500).json({ error: 'User not found' });
      }
      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        twoFactorEnabled: user.two_factor_enabled === 1
      });
    });
});

module.exports = router;

