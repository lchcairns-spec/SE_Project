const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'voting.db');

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

function initDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
    });

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Create tables
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'voter',
          two_factor_secret TEXT,
          two_factor_enabled INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          verified INTEGER DEFAULT 0
        )
      `);

      // Polls table
      db.run(`
        CREATE TABLE IF NOT EXISTS polls (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          creator_id INTEGER NOT NULL,
          status TEXT DEFAULT 'draft',
          poll_type TEXT DEFAULT 'single',
          allow_revote INTEGER DEFAULT 0,
          start_date DATETIME,
          end_date DATETIME,
          target_students TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (creator_id) REFERENCES users(id)
        )
      `);

      // Poll options table
      db.run(`
        CREATE TABLE IF NOT EXISTS poll_options (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          poll_id INTEGER NOT NULL,
          option_text TEXT NOT NULL,
          display_order INTEGER DEFAULT 0,
          FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
        )
      `);

      // Votes table (encrypted ballot store)
      db.run(`
        CREATE TABLE IF NOT EXISTS votes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          poll_id INTEGER NOT NULL,
          voter_id INTEGER NOT NULL,
          selected_options TEXT NOT NULL,
          vote_hash TEXT NOT NULL,
          receipt_id TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (poll_id) REFERENCES polls(id),
          FOREIGN KEY (voter_id) REFERENCES users(id),
          UNIQUE(poll_id, voter_id)
        )
      `);

      // Audit logs table
      db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          action TEXT NOT NULL,
          resource_type TEXT,
          resource_id INTEGER,
          details TEXT,
          ip_address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      // Invitations table
      db.run(`
        CREATE TABLE IF NOT EXISTS invitations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          poll_id INTEGER NOT NULL,
          invite_token TEXT UNIQUE NOT NULL,
          email TEXT,
          created_by INTEGER NOT NULL,
          used INTEGER DEFAULT 0,
          expires_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (poll_id) REFERENCES polls(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);

      // Create indexes
      db.run('CREATE INDEX IF NOT EXISTS idx_votes_poll ON votes(poll_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes(voter_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)');

      // Create default admin user (password: admin123)
      // Note: In production, change this password immediately
      const bcrypt = require('bcryptjs');
      bcrypt.hash('admin123', 10, (err, hash) => {
        if (err) {
          console.error('Error hashing admin password:', err);
        } else {
          db.run(`
            INSERT OR IGNORE INTO users (email, password_hash, role, verified)
            VALUES ('admin@admin.com', ?, 'poll_admin', 1)
          `, [hash], (err) => {
            if (err) console.error('Error creating default admin:', err);
          });
        }

        db.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('Database initialized successfully');
            resolve();
          }
        });
      });
    });
  });
}

function getDatabase() {
  return new sqlite3.Database(DB_PATH);
}

module.exports = { initDatabase, getDatabase, DB_PATH };

