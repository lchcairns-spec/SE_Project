const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { encrypt, hashVote, generateReceiptId } = require('../utils/encryption');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Cast vote
router.post('/cast', authenticateToken, [
  body('pollId').isInt().withMessage('Valid poll ID required'),
  body('selectedOptions').isArray({ min: 1 }).withMessage('At least one option must be selected')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { pollId, selectedOptions } = req.body;
  const db = getDatabase();

  // Verify poll exists and is active
  db.get(`
    SELECT * FROM polls 
    WHERE id = ? AND status = 'active'
      AND (start_date IS NULL OR start_date <= datetime('now'))
      AND (end_date IS NULL OR end_date >= datetime('now'))
  `, [pollId], (err, poll) => {
    if (err) {
      db.close();
      return res.status(500).json({ error: 'Database error' });
    }

    if (!poll) {
      db.close();
      return res.status(404).json({ error: 'Poll not found or not active' });
    }

    // Check if user has already voted
    db.get('SELECT id FROM votes WHERE poll_id = ? AND voter_id = ?',
      [pollId, req.user.id], (err, existingVote) => {
        if (err) {
          db.close();
          return res.status(500).json({ error: 'Database error' });
        }

        if (existingVote && !poll.allow_revote) {
          db.close();
          return res.status(400).json({ error: 'You have already voted in this poll' });
        }

        // Verify selected options exist
        const placeholders = selectedOptions.map(() => '?').join(',');
        db.all(`SELECT id FROM poll_options WHERE id IN (${placeholders}) AND poll_id = ?`,
          [...selectedOptions, pollId], (err, validOptions) => {
            if (err) {
              db.close();
              return res.status(500).json({ error: 'Database error' });
            }

            if (validOptions.length !== selectedOptions.length) {
              db.close();
              return res.status(400).json({ error: 'Invalid option selected' });
            }

            // Check poll type (single vs multiple)
            if (poll.poll_type === 'single' && selectedOptions.length > 1) {
              db.close();
              return res.status(400).json({ error: 'This poll allows only one selection' });
            }

            // Encrypt vote
            const timestamp = new Date().toISOString();
            const encryptedVote = encrypt(JSON.stringify({
              pollId,
              voterId: req.user.id,
              selectedOptions,
              timestamp
            }));

            const voteHash = hashVote(pollId, req.user.id, selectedOptions, timestamp);
            const receiptId = generateReceiptId();

            // If revote, delete old vote first
            const insertVote = () => {
              db.run(`
                INSERT INTO votes (poll_id, voter_id, selected_options, vote_hash, receipt_id)
                VALUES (?, ?, ?, ?, ?)
              `, [pollId, req.user.id, JSON.stringify(encryptedVote), voteHash, receiptId],
                function(err) {
                  if (err) {
                    db.close();
                    return res.status(500).json({ error: 'Failed to record vote' });
                  }

                  logAudit(req.user.id, 'vote_cast', 'vote', this.lastID, 
                    `Voted in poll ${pollId}`, req.ip);

                  db.close();
                  res.status(201).json({
                    message: 'Vote cast successfully',
                    receiptId,
                    voteHash,
                    timestamp
                  });
                });
            };

            if (existingVote && poll.allow_revote) {
              db.run('DELETE FROM votes WHERE poll_id = ? AND voter_id = ?',
                [pollId, req.user.id], (err) => {
                  if (err) {
                    db.close();
                    return res.status(500).json({ error: 'Failed to delete previous vote' });
                  }
                  logAudit(req.user.id, 'vote_revoked', 'vote', existingVote.id, 
                    `Revoked previous vote in poll ${pollId}`, req.ip);
                  insertVote();
                });
            } else {
              insertVote();
            }
          });
      });
  });
});

// Get vote receipt
router.get('/receipt/:receiptId', authenticateToken, (req, res) => {
  const { receiptId } = req.params;
  const db = getDatabase();

  db.get(`
    SELECT v.*, p.title as poll_title
    FROM votes v
    JOIN polls p ON v.poll_id = p.id
    WHERE v.receipt_id = ? AND v.voter_id = ?
  `, [receiptId, req.user.id], (err, vote) => {
    db.close();
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!vote) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    res.json({
      receiptId: vote.receipt_id,
      pollTitle: vote.poll_title,
      voteHash: vote.vote_hash,
      timestamp: vote.created_at,
      message: 'Your vote has been recorded and verified'
    });
  });
});

// Verify vote was recorded
router.get('/verify/:pollId', authenticateToken, (req, res) => {
  const { pollId } = req.params;
  const db = getDatabase();

  db.get(`
    SELECT receipt_id, vote_hash, created_at
    FROM votes
    WHERE poll_id = ? AND voter_id = ?
  `, [pollId, req.user.id], (err, vote) => {
    db.close();
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!vote) {
      return res.json({ verified: false, message: 'No vote found for this poll' });
    }

    res.json({
      verified: true,
      receiptId: vote.receipt_id,
      voteHash: vote.vote_hash,
      timestamp: vote.created_at,
      message: 'Your vote has been verified and recorded'
    });
  });
});

// Get poll results (if allowed)
router.get('/results/:pollId', authenticateToken, (req, res) => {
  const { pollId } = req.params;
  const db = getDatabase();

  // Check if poll allows viewing results
  db.get('SELECT status, end_date FROM polls WHERE id = ?', [pollId], (err, poll) => {
    if (err || !poll) {
      db.close();
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Only show results if poll is closed or user is admin/creator
    const canViewResults = poll.status === 'closed' || 
                          req.user.role === 'poll_admin' || 
                          req.user.role === 'vote_creator';

    if (!canViewResults) {
      db.close();
      return res.status(403).json({ error: 'Results are not available yet' });
    }

    // Get all votes for this poll and decrypt to count
    db.all('SELECT selected_options FROM votes WHERE poll_id = ?', [pollId], (err, votes) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }

      // Get all options
      db.all('SELECT id, option_text FROM poll_options WHERE poll_id = ? ORDER BY display_order',
        [pollId], (err, options) => {
          if (err) {
            db.close();
            return res.status(500).json({ error: 'Database error' });
          }

          // Initialize vote counts
          const voteCounts = {};
          options.forEach(opt => {
            voteCounts[opt.id] = 0;
          });

          // Decrypt and count votes
          const { decrypt } = require('../utils/encryption');
          votes.forEach(vote => {
            try {
              const encryptedData = JSON.parse(vote.selected_options);
              const decrypted = decrypt(encryptedData);
              const voteData = JSON.parse(decrypted);
              const selectedOptions = Array.isArray(voteData.selectedOptions) 
                ? voteData.selectedOptions 
                : [voteData.selectedOptions];
              
              selectedOptions.forEach(optId => {
                if (voteCounts[optId] !== undefined) {
                  voteCounts[optId]++;
                }
              });
            } catch (e) {
              console.error('Error decrypting vote:', e);
            }
          });

          // Format results
          const results = options.map(opt => ({
            id: opt.id,
            option_text: opt.option_text,
            vote_count: voteCounts[opt.id] || 0
          }));

          db.close();
          res.json({
            pollId,
            results,
            totalVotes: votes.length
          });
        });
    });
  });
});

module.exports = router;

