#!/usr/bin/env node
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

const candidates = [path.join(__dirname,'..','music.db.backup'), path.join(__dirname,'..','music.db.bak'), path.join(__dirname,'..','music.db')];
let p = candidates.find(x=>fs.existsSync(x));
if(!p){ console.error('No sqlite file found'); process.exit(2);} 
const db = new Database(p, {readonly:true});
console.log('Inspecting', p);
const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all();
console.log('Tables:');
tables.forEach(t=>{
  console.log('-', t.name);
});

if(tables.some(t=>t.name==='playlist_songs')){
  console.log('\nSample rows from playlist_songs:');
  const rows = db.prepare('SELECT * FROM playlist_songs LIMIT 5').all();
  console.log(rows);
}

if(tables.some(t=>t.name==='playlists')){
  console.log('\nSample rows from playlists:');
  const rows = db.prepare('SELECT * FROM playlists LIMIT 5').all();
  console.log(rows);
}

db.close();
