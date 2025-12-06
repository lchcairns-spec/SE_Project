const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit, getAuditLogs } = require('../utils/audit');

const router = express.Router();

// All admin routes require poll_admin role
router.use(authenticateToken);
router.use(requireRole('poll_admin'));

// Get all polls (admin view)
router.get('/polls', (req, res) => {
  const db = getDatabase();

  db.all(`
    SELECT p.*, u.email as creator_email,
           (SELECT COUNT(*) FROM votes WHERE poll_id = p.id) as vote_count
    FROM polls p
    JOIN users u ON p.creator_id = u.id
    ORDER BY p.created_at DESC
  `, (err, polls) => {
    db.close();
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(polls);
  });
});

// Force close/reopen poll
router.post('/polls/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['active', 'closed', 'draft'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const db = getDatabase();
  db.run('UPDATE polls SET status = ? WHERE id = ?', [status, id], (err) => {
    if (err) {
      db.close();
      return res.status(500).json({ error: 'Failed to update poll status' });
    }

    logAudit(req.user.id, 'poll_status_changed', 'poll', id, 
      `Changed poll ${id} status to ${status}`, req.ip);
    db.close();
    res.json({ message: `Poll ${status} successfully` });
  });
});

// Get audit logs
router.get('/audit-logs', async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId ? parseInt(req.query.userId) : null,
      action: req.query.action || null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null,
      limit: req.query.limit ? parseInt(req.query.limit) : 100
    };

    const logs = await getAuditLogs(filters);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
});

// Get system statistics
router.get('/statistics', (req, res) => {
  const db = getDatabase();

  Promise.all([
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    }),
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM polls', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    }),
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM votes', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    }),
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM polls WHERE status = ?', ['active'], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    })
  ]).then(([users, polls, votes, activePolls]) => {
    db.close();
    res.json({
      totalUsers: users,
      totalPolls: polls,
      totalVotes: votes,
      activePolls: activePolls
    });
  }).catch(err => {
    db.close();
    res.status(500).json({ error: 'Failed to get statistics' });
  });
});

// Manage users
router.get('/users', (req, res) => {
  const db = getDatabase();

  db.all(`
    SELECT id, email, role, created_at, verified
    FROM users
    ORDER BY created_at DESC
  `, (err, users) => {
    db.close();
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(users);
  });
});

// Update user role
router.put('/users/:id/role', (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['voter', 'vote_creator', 'poll_admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const db = getDatabase();
  db.run('UPDATE users SET role = ? WHERE id = ?', [role, id], (err) => {
    if (err) {
      db.close();
      return res.status(500).json({ error: 'Failed to update user role' });
    }

    logAudit(req.user.id, 'user_role_updated', 'user', id, 
      `Changed user ${id} role to ${role}`, req.ip);
    db.close();
    res.json({ message: 'User role updated successfully' });
  });
});

// Export poll results
router.get('/polls/:id/export', (req, res) => {
  const { id } = req.params;
  const db = getDatabase();

  db.get('SELECT * FROM polls WHERE id = ?', [id], (err, poll) => {
    if (err || !poll) {
      db.close();
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Get all votes
    db.all(`
      SELECT v.*, u.email as voter_email
      FROM votes v
      JOIN users u ON v.voter_id = u.id
      WHERE v.poll_id = ?
    `, [id], (err, votes) => {
      db.close();
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      logAudit(req.user.id, 'poll_results_exported', 'poll', id, 
        `Exported results for poll ${id}`, req.ip);

      res.json({
        poll: {
          id: poll.id,
          title: poll.title,
          description: poll.description,
          status: poll.status
        },
        votes: votes.map(v => ({
          receiptId: v.receipt_id,
          voterEmail: v.voter_email,
          voteHash: v.vote_hash,
          timestamp: v.created_at
        })),
        totalVotes: votes.length
      });
    });
  });
});

module.exports = router;

