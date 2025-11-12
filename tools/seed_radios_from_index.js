#!/usr/bin/env node
/*
  seed_radios_from_index.js
  Create DB playlists for radio cards (playlist-card.radio-card in index.html)
  and seed them from iTunes (previewUrl) up to TARGET_TRACKS_PER_PLAYLIST.
  Usage: node tools/seed_radios_from_index.js
*/
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const axios = require('axios');

async function main(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  // find radio-card blocks
  const re = /<div[^>]*class=["'][^"']*playlist-card[^"']*radio-card[^"']*["'][^>]*>/gi;
  const matches = [];
  let m;
  while((m = re.exec(html)) !== null){
    const tag = m[0];
    const qMatch = tag.match(/data-query=["']([^"']+)["']/i);
    // find the following h3 content for the name
    const after = html.slice(m.index, m.index + 400);
    const nameMatch = after.match(/<h3>([^<]+)<\/h3>/i);
    const name = nameMatch ? nameMatch[1].trim() : null;
    const query = qMatch ? qMatch[1] : null;
    if(query && name) matches.push({ name, query });
  }

  if(!matches.length){ console.log('No radio-card entries found in index.html'); return; }

  const pool = await mysql.createPool({ host: process.env.MYSQL_HOST, port: process.env.MYSQL_PORT, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE, waitForConnections:true, connectionLimit:4 });
  const TARGET = Number(process.env.TARGET_TRACKS_PER_PLAYLIST || 120);

  for(const r of matches){
    console.log('Processing radio:', r.name, 'query=', r.query);
    const [rows] = await pool.query('SELECT id FROM playlists WHERE name = ? LIMIT 1', [r.name]);
    let playlistId;
    if(rows && rows[0] && rows[0].id){ playlistId = rows[0].id; console.log('  using existing playlist id', playlistId); }
    else{ const [res] = await pool.execute('INSERT INTO playlists (name, description) VALUES (?, ?)', [r.name, 'radio seeded from index.html query: ' + r.query]); playlistId = res.insertId; console.log('  created playlist id', playlistId); }

    const [cntRow] = await pool.query('SELECT COUNT(*) as c FROM playlist_songs WHERE playlist_id = ?', [playlistId]);
    let current = cntRow && cntRow[0] ? Number(cntRow[0].c) : 0;
    console.log('  currently has', current, 'tracks; target', TARGET);

    try{
      const q = encodeURIComponent(r.query);
      const limit = Math.min(200, Math.max(50, TARGET));
      const itunesUrl = `https://itunes.apple.com/search?term=${q}&entity=song&limit=${limit}`;
      const resp = await axios.get(itunesUrl, { timeout: 20000 });
      const items = resp.data && resp.data.results ? resp.data.results : [];
      console.log('  itunes fetched', items.length, 'tracks');
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
      console.log('  inserted up to target, now current', current);
    }catch(err){ console.warn('  iTunes fetch/insert failed for', r.query, err.message); }
  }

  await pool.end();
  console.log('Radio seeding completed.');
}

main().catch(err=>{ console.error('Seed radios failed', err); process.exit(1); });
