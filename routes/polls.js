const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Get all available polls (for voters)
router.get('/available', authenticateToken, (req, res) => {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.all(`
    SELECT p.*, u.email as creator_email,
           (SELECT COUNT(*) FROM votes WHERE poll_id = p.id) as vote_count
    FROM polls p
    JOIN users u ON p.creator_id = u.id
    WHERE p.status = 'active'
      AND (p.start_date IS NULL OR p.start_date <= ?)
      AND (p.end_date IS NULL OR p.end_date >= ?)
    ORDER BY p.created_at DESC
  `, [now, now], (err, polls) => {
    if (err) {
      db.close();
      return res.status(500).json({ error: 'Database error' });
    }

    // Get options for each poll
    const pollsWithOptions = polls.map(poll => {
      return new Promise((resolve) => {
        db.all('SELECT * FROM poll_options WHERE poll_id = ? ORDER BY display_order',
          [poll.id], (err, options) => {
            resolve({ ...poll, options: options || [] });
          });
      });
    });

    Promise.all(pollsWithOptions).then(results => {
      db.close();
      res.json(results);
    });
  });
});

// Get poll details
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  const pollId = req.params.id;

  db.get(`
    SELECT p.*, u.email as creator_email,
           (SELECT COUNT(*) FROM votes WHERE poll_id = p.id) as vote_count
    FROM polls p
    JOIN users u ON p.creator_id = u.id
    WHERE p.id = ?
  `, [pollId], (err, poll) => {
    if (err) {
      db.close();
      return res.status(500).json({ error: 'Database error' });
    }

    if (!poll) {
      db.close();
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if user has already voted
    db.get('SELECT id FROM votes WHERE poll_id = ? AND voter_id = ?',
      [pollId, req.user.id], (err, vote) => {
        if (err) {
          db.close();
          return res.status(500).json({ error: 'Database error' });
        }

        // Get options
        db.all('SELECT * FROM poll_options WHERE poll_id = ? ORDER BY display_order',
          [pollId], (err, options) => {
            db.close();
            res.json({
              ...poll,
              options: options || [],
              hasVoted: !!vote
            });
          });
      });
  });
});

// Create poll (Vote Creator or Poll Admin)
router.post('/', authenticateToken, requireRole('vote_creator', 'poll_admin'), [
  body('title').notEmpty().withMessage('Title is required'),
  body('options').isArray({ min: 2 }).withMessage('At least 2 options required')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { title, description, poll_type, allow_revote, start_date, end_date, 
          target_students, options } = req.body;

  const db = getDatabase();

  db.run(`
    INSERT INTO polls (title, description, creator_id, poll_type, allow_revote, 
                      start_date, end_date, target_students, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `, [title, description || null, req.user.id, poll_type || 'single', 
      allow_revote ? 1 : 0, start_date || null, end_date || null, 
      target_students || null],
    function(err) {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Failed to create poll' });
      }

      const pollId = this.lastID;

      // Insert options
      const optionPromises = options.map((option, index) => {
        return new Promise((resolve, reject) => {
          db.run('INSERT INTO poll_options (poll_id, option_text, display_order) VALUES (?, ?, ?)',
            [pollId, option, index], (err) => {
              if (err) reject(err);
              else resolve();
            });
        });
      });

      Promise.all(optionPromises).then(() => {
        logAudit(req.user.id, 'poll_created', 'poll', pollId, 
          `Created poll: ${title}`, req.ip);
        db.close();
        res.status(201).json({ message: 'Poll created successfully', pollId });
      }).catch(err => {
        db.close();
        res.status(500).json({ error: 'Failed to create poll options' });
      });
    });
});

// Update poll (Creator or Admin)
router.put('/:id', authenticateToken, requireRole('vote_creator', 'poll_admin'), (req, res) => {
  const pollId = req.params.id;
  const db = getDatabase();

  // Check if user is creator or admin
  db.get('SELECT creator_id FROM polls WHERE id = ?', [pollId], (err, poll) => {
    if (err || !poll) {
      db.close();
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (poll.creator_id !== req.user.id && req.user.role !== 'poll_admin') {
      db.close();
      return res.status(403).json({ error: 'Not authorized to edit this poll' });
    }

    const { title, description, poll_type, allow_revote, start_date, end_date, 
            target_students, status } = req.body;

    db.run(`
      UPDATE polls 
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          poll_type = COALESCE(?, poll_type),
          allow_revote = COALESCE(?, allow_revote),
          start_date = COALESCE(?, start_date),
          end_date = COALESCE(?, end_date),
          target_students = COALESCE(?, target_students),
          status = COALESCE(?, status)
      WHERE id = ?
    `, [title, description, poll_type, allow_revote, start_date, end_date, 
        target_students, status, pollId],
      (err) => {
        if (err) {
          db.close();
          return res.status(500).json({ error: 'Failed to update poll' });
        }

        logAudit(req.user.id, 'poll_updated', 'poll', pollId, 
          `Updated poll ${pollId}`, req.ip);
        db.close();
        res.json({ message: 'Poll updated successfully' });
      });
  });
});

// Get my polls (for creators)
router.get('/my/polls', authenticateToken, requireRole('vote_creator', 'poll_admin'), (req, res) => {
  const db = getDatabase();

  db.all(`
    SELECT p.*, 
           (SELECT COUNT(*) FROM votes WHERE poll_id = p.id) as vote_count
    FROM polls p
    WHERE p.creator_id = ?
    ORDER BY p.created_at DESC
  `, [req.user.id], (err, polls) => {
    db.close();
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(polls);
  });
});

// Generate invite link
router.post('/:id/invite', authenticateToken, requireRole('vote_creator', 'poll_admin'), (req, res) => {
  const pollId = req.params.id;
  const { email, expiresIn } = req.body;
  const crypto = require('crypto');
  const db = getDatabase();

  // Verify user is creator or admin
  db.get('SELECT creator_id FROM polls WHERE id = ?', [pollId], (err, poll) => {
    if (err || !poll) {
      db.close();
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (poll.creator_id !== req.user.id && req.user.role !== 'poll_admin') {
      db.close();
      return res.status(403).json({ error: 'Not authorized' });
    }

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = expiresIn 
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days default

    db.run(`
      INSERT INTO invitations (poll_id, invite_token, email, created_by, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `, [pollId, inviteToken, email || null, req.user.id, expiresAt],
      function(err) {
        if (err) {
          db.close();
          return res.status(500).json({ error: 'Failed to create invitation' });
        }

        logAudit(req.user.id, 'invite_created', 'poll', pollId, 
          `Created invite for poll ${pollId}`, req.ip);
        db.close();
        res.json({
          inviteToken,
          inviteLink: `/invite/${inviteToken}`,
          expiresAt
        });
      });
  });
});

module.exports = router;

