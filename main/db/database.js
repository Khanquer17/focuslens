const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let db = null;

function getDbPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'focuslens.db');
}

function init() {
  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  // Log session count to confirm data persistence
  const count = db.prepare('SELECT COUNT(*) as n FROM usage_sessions').get();
  console.log(`[DB] Initialized at ${dbPath} — ${count.n} sessions in database`);
  return db;
}

function getDb() {
  if (!db) {
    console.log('[DB] Lazy-initializing database...');
    init();
  }
  return db;
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { init, getDb, close };
