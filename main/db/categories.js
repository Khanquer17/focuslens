const { getDb } = require('./database');
const path = require('path');
const fs = require('fs');

function seedDefaults() {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as cnt FROM category_mappings').get();
  if (count.cnt > 0) return;

  const defaultsPath = path.join(__dirname, '..', 'defaults', 'categories.json');
  const defaults = JSON.parse(fs.readFileSync(defaultsPath, 'utf-8'));

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO category_mappings (match_type, match_value, category, is_default)
    VALUES (?, ?, ?, 1)
  `);

  const insertMany = db.transaction((mappings) => {
    for (const m of mappings) {
      stmt.run(m.match_type, m.match_value, m.category);
    }
  });

  insertMany(defaults);
  console.log(`[Categories] Seeded ${defaults.length} default mappings`);
}

function getAll() {
  const db = getDb();
  return db.prepare('SELECT * FROM category_mappings ORDER BY category, match_value').all();
}

function findByApp(bundleId) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM category_mappings WHERE match_type = ? AND match_value = ? ORDER BY is_default ASC LIMIT 1'
  ).get('app', bundleId);
}

function findByDomain(domain) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM category_mappings WHERE match_type = ? AND match_value = ? ORDER BY is_default ASC LIMIT 1'
  ).get('domain', domain);
}

function update(id, category) {
  const db = getDb();
  db.prepare('UPDATE category_mappings SET category = ?, is_default = 0 WHERE id = ?').run(category, id);
}

function add({ matchType, matchValue, category }) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO category_mappings (match_type, match_value, category, is_default)
    VALUES (?, ?, ?, 0)
    ON CONFLICT(match_type, match_value) DO UPDATE SET category = excluded.category, is_default = 0
  `).run(matchType, matchValue, category);
}

function remove(id) {
  const db = getDb();
  db.prepare('DELETE FROM category_mappings WHERE id = ?').run(id);
}

module.exports = { seedDefaults, getAll, findByApp, findByDomain, update, add, remove };
