#!/usr/bin/env node
// augment_playlist.js
// Given a playlist id, try multiple iTunes queries to add preview-enabled tracks
// until TARGET_TRACKS_PER_PLAYLIST is reached.
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');
const mysql = require('mysql2/promise');

async function main(){
  const playlistId = Number(process.argv[2] || process.env.AUGMENT_PLAYLIST_ID || 5);
  const TARGET = Number(process.env.TARGET_TRACKS_PER_PLAYLIST || 120);
  const queries = (process.argv.slice(3).length ? process.argv.slice(3) : ['synthwave','retrowave','chillwave','electronic','downtempo','ambient','night drive','vaporwave','outrun']);

  const pool = await mysql.createPool({ host: process.env.MYSQL_HOST, port: process.env.MYSQL_PORT, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE, waitForConnections:true, connectionLimit:2 });

  const [cntRow] = await pool.query('SELECT COUNT(*) as c FROM playlist_songs WHERE playlist_id = ?', [playlistId]);
  let current = cntRow && cntRow[0] ? Number(cntRow[0].c) : 0;
  console.log('Playlist', playlistId, 'current count', current, 'target', TARGET);

  for(const q of queries){
    if(current >= TARGET) break;
    console.log('Trying query:', q);
    try{
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=200`;
      const resp = await axios.get(url, { timeout: 20000 });
      const items = resp.data && resp.data.results ? resp.data.results : [];
      console.log('  fetched', items.length, 'results');
      for(const it of items){
        if(current >= TARGET) break;
        const title = it.trackName || it.collectionName || 'Unknown';
        const artist = it.artistName || '';
        const album = it.collectionName || '';
        const duration = it.trackTimeMillis ? Math.round(it.trackTimeMillis/1000) : null;
        const album_art = it.artworkUrl100 ? it.artworkUrl100.replace('100x100','600x600') : null;
        const preview_url = it.previewUrl || null;
        if(!preview_url) continue;
        const [exists] = await pool.query('SELECT id FROM playlist_songs WHERE playlist_id = ? AND song_title = ? AND song_artist = ? LIMIT 1', [playlistId, title, artist]);
        if(exists && exists[0] && exists[0].id) continue;
        await pool.execute('INSERT INTO playlist_songs (playlist_id, song_title, song_artist, song_album, song_duration, album_art, preview_url) VALUES (?, ?, ?, ?, ?, ?, ?)', [playlistId, title, artist, album, duration?String(duration):'', album_art, preview_url]);
        current++;
      }
      console.log('  now current count', current);
    }catch(e){ console.warn('  query failed', q, e.message); }
  }

  console.log('Done. final count for playlist', playlistId, current);
  await pool.end();
}

main().catch(e=>{ console.error('augment failed', e.message); process.exit(1); });
