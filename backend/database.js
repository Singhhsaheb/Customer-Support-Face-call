const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const db = new Database(path.join(__dirname, 'atomquest.db'));

// Initialize Database Schema
function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      role TEXT CHECK(role IN ('AGENT', 'CUSTOMER', 'ADMIN')),
      name TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      agent_id TEXT,
      status TEXT CHECK(status IN ('ACTIVE', 'ENDED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      FOREIGN KEY(agent_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      user_id TEXT,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      left_at DATETIME,
      FOREIGN KEY(session_id) REFERENCES sessions(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      sender_id TEXT,
      content TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      type TEXT CHECK(type IN ('TEXT', 'FILE')),
      FOREIGN KEY(session_id) REFERENCES sessions(id),
      FOREIGN KEY(sender_id) REFERENCES users(id)
    );
  `);
}

// Ensure at least one agent exists
function seedData() {
  const checkAgent = db.prepare('SELECT id FROM users WHERE role = ?').get('AGENT');
  if (!checkAgent) {
    db.prepare('INSERT INTO users (id, role, name) VALUES (?, ?, ?)').run(uuidv4(), 'AGENT', 'Support Agent Alice');
  }
}

initDB();
seedData();

module.exports = {
  db,
  
  createSession: (agentId) => {
    const sessionId = uuidv4();
    db.prepare('INSERT INTO sessions (id, agent_id, status) VALUES (?, ?, ?)').run(sessionId, agentId, 'ACTIVE');
    return sessionId;
  },

  getSession: (sessionId) => {
    return db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  },

  endSession: (sessionId) => {
    db.prepare('UPDATE sessions SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?').run('ENDED', sessionId);
  },

  createUser: (name, role) => {
    const id = uuidv4();
    db.prepare('INSERT INTO users (id, role, name) VALUES (?, ?, ?)').run(id, role, name);
    return id;
  },

  getAgents: () => {
    return db.prepare('SELECT * FROM users WHERE role = ?').all('AGENT');
  },

  addParticipant: (sessionId, userId) => {
    const id = uuidv4();
    db.prepare('INSERT INTO participants (id, session_id, user_id) VALUES (?, ?, ?)').run(id, sessionId, userId);
    return id;
  },

  removeParticipant: (sessionId, userId) => {
    db.prepare('UPDATE participants SET left_at = CURRENT_TIMESTAMP WHERE session_id = ? AND user_id = ? AND left_at IS NULL').run(sessionId, userId);
  },

  saveMessage: (sessionId, senderId, content, type = 'TEXT') => {
    const id = uuidv4();
    db.prepare('INSERT INTO messages (id, session_id, sender_id, content, type) VALUES (?, ?, ?, ?, ?)').run(id, sessionId, senderId, content, type);
    return id;
  },

  getMessages: (sessionId) => {
    return db.prepare('SELECT m.*, u.name as sender_name FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.session_id = ? ORDER BY m.timestamp ASC').all(sessionId);
  },
  
  getAdminMetrics: () => {
    const activeSessions = db.prepare("SELECT count(*) as count FROM sessions WHERE status = 'ACTIVE'").get().count;
    const totalSessions = db.prepare("SELECT count(*) as count FROM sessions").get().count;
    const sessions = db.prepare("SELECT * FROM sessions ORDER BY created_at DESC LIMIT 50").all();
    return { activeSessions, totalSessions, sessions };
  }
};
