const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'music.db');
const db = new Database(dbPath);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';").all();
console.log('DB file:', dbPath);
console.log('Tables:', tables.map(t => t.name));
for (const t of tables) {
  const name = t.name;
  try {
    const c = db.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get();
    console.log(name, 'rows:', c.c);
  } catch (err) {
    console.log(name, '(count failed:', err.message, ')');
  }
}

db.close();
