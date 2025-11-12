// Quick test to inspect local SQLite database (music.db)
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'music.db');
const db = new Database(dbPath, { readonly: true });

function tables() {
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  return rows.map(r => r.name);
}

function count(table){
  try{
    const r = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get();
    return r.c;
  }catch(e){
    return null;
  }
}

console.log('SQLite DB:', dbPath);
const tbls = tables();
console.log('Tables:');
if(tbls.length===0) console.log('  (none)');
for(const t of tbls){
  console.log(`  - ${t} (${count(t)} rows)`);
}

// Print top 3 rows of listen_history if present
if(tbls.includes('listen_history')){
  console.log('\nSample listen_history rows:');
  const rows = db.prepare('SELECT id, song_title, song_artist, played_at FROM listen_history ORDER BY played_at DESC LIMIT 3').all();
  rows.forEach(r => console.log(`  [${r.id}] ${r.song_title} — ${r.song_artist} @ ${r.played_at}`));
}

// Print playlist count
if(tbls.includes('playlists')){
  const pcount = count('playlists');
  console.log(`\nPlaylists: ${pcount}`);
}

db.close();
