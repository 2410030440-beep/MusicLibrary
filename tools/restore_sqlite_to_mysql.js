#!/usr/bin/env node
/*
  restore_sqlite_to_mysql.js
  Reads playlists and playlist_songs from a local SQLite backup (music.db.backup or music.db.bak)
  and inserts missing playlists and songs into the MySQL backend configured by .env.

  Usage: node tools/restore_sqlite_to_mysql.js

  This script is defensive: it will skip duplicates and print a summary.
*/
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const sqliteFileCandidates = [
  path.join(__dirname, '..', 'music.db.backup'),
  path.join(__dirname, '..', 'music.db.bak'),
  path.join(__dirname, '..', 'music.db')
];

let sqlitePath = null;
for (const p of sqliteFileCandidates) {
  if (fs.existsSync(p)) { sqlitePath = p; break; }
}

if (!sqlitePath) {
  console.error('No sqlite backup found. Checked:', sqliteFileCandidates.join(', '));
  process.exit(2);
}

console.log('Using sqlite file:', sqlitePath);

const Database = require('better-sqlite3');
const db = new Database(sqlitePath, { readonly: true });

const mysql = require('mysql2/promise');
async function main(){
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = process.env.MYSQL_PORT || 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'musiclibrary';

  console.log(`Connecting to MySQL ${user}@${host}:${port}/${database}`);
  const pool = await mysql.createPool({ host, port, user, password, database, waitForConnections:true, connectionLimit:5 });

  // Validate sqlite tables
  function hasTable(name){
    try{ const r = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name); return !!r; }catch(e){ return false; }
  }

  if (!hasTable('playlists') || !hasTable('playlist_songs')){
    console.error('Source sqlite missing expected tables (playlists, playlist_songs). Aborting.');
    process.exit(3);
  }

  const srcPlaylists = db.prepare('SELECT * FROM playlists ORDER BY created_at ASC').all();
  console.log('Found', srcPlaylists.length, 'playlists in sqlite');

  let totalInsertedPlaylists = 0;
  let totalInsertedSongs = 0;

  for (const p of srcPlaylists){
    const name = p.name || ('playlist_' + (p.id||Date.now()));
    const desc = p.description || null;

    // Check if playlist exists in MySQL by name
    const [found] = await pool.query('SELECT id FROM playlists WHERE name = ? LIMIT 1', [name]);
    let mysqlPlaylistId = found && found[0] && found[0].id;
    if (!mysqlPlaylistId){
      const [res] = await pool.execute('INSERT INTO playlists (name, description) VALUES (?, ?)', [name, desc]);
      mysqlPlaylistId = res.insertId;
      totalInsertedPlaylists++;
      console.log('Inserted playlist:', name, '-> id', mysqlPlaylistId);
    } else {
      console.log('Playlist exists, using id', mysqlPlaylistId, 'for', name);
    }

    // Fetch songs for this playlist
    const songs = db.prepare('SELECT * FROM playlist_songs WHERE playlist_id = ? ORDER BY added_at ASC').all(p.id);
    console.log('  Found', songs.length, 'songs for playlist', name);

    for (const s of songs){
      const title = s.song_title || s.title || 'Unknown';
      const artist = s.song_artist || s.artist || '';
      const album = s.song_album || null;
      const duration = s.song_duration || null;
      const album_art = s.album_art || s.albumArt || null;
      const preview_url = s.preview_url || s.preview || null;

      // Check for existing identical song in same playlist (based on title+artist)
      const [exists] = await pool.query('SELECT id FROM playlist_songs WHERE playlist_id = ? AND song_title = ? AND song_artist = ? LIMIT 1', [mysqlPlaylistId, title, artist]);
      if (exists && exists[0] && exists[0].id){
        // skip
        continue;
      }

      await pool.execute('INSERT INTO playlist_songs (playlist_id, song_title, song_artist, song_album, song_duration, album_art, preview_url) VALUES (?, ?, ?, ?, ?, ?, ?)', [mysqlPlaylistId, title, artist, album, duration, album_art, preview_url]);
      totalInsertedSongs++;
    }
  }

  console.log('Done. Playlists inserted:', totalInsertedPlaylists, 'Songs inserted:', totalInsertedSongs);
  await pool.end();
  db.close();
}

main().catch(err=>{ console.error('Restore failed:', err); process.exit(10); });
