const { getDatabase } = require('../database/init');

function logAudit(userId, action, resourceType, resourceId, details, ipAddress) {
  const db = getDatabase();
  
  db.run(
    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, action, resourceType, resourceId, details || null, ipAddress || null],
    (err) => {
      if (err) {
        console.error('Failed to log audit:', err);
      }
      db.close();
    }
  );
}

function getAuditLogs(filters = {}) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (filters.userId) {
      query += ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters.action) {
      query += ' AND action = ?';
      params.push(filters.action);
    }

    if (filters.startDate) {
      query += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(filters.limit || 100);

    db.all(query, params, (err, rows) => {
      db.close();
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

module.exports = {
  logAudit,
  getAuditLogs
};

