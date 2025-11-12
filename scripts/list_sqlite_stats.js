const path = require('path');
const fs = require('fs');

const candidates = [
  'music.db',
  'music.db.backup',
  'music.db.bak',
  'music.db.pre-restore.20251101_220331.sqlite'
];

function countRows(db, table){
  try{ const r = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get(); return r.c||0; }catch(e){ return 0; }
}

function inspect(file){
  const f = path.join(__dirname, '..', file);
  if(!fs.existsSync(f)) return null;
  try{
    const Database = require('better-sqlite3');
    const db = new Database(f, { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name);
    const stats = {};
    for(const t of tables){ stats[t] = countRows(db, t); }
    const total = Object.values(stats).reduce((a,b)=>a+(b||0),0);
    db.close();
    return { file, tables, stats, total };
  }catch(e){ return { file, error: e.message } }
}

const results = candidates.map(inspect).filter(Boolean);
console.log(JSON.stringify(results, null, 2));
