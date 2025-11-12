#!/usr/bin/env node
/*
  create_bollywood_playlist.js
  Creates a new playlist named 'Hindi Hits (Bollywood Only)' and seeds it
  with preview-enabled tracks from iTunes using a list of Bollywood artist
  and keyword queries.

  Usage: node tools/create_bollywood_playlist.js
*/
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const axios = require('axios');

async function main(){
  const pool = await mysql.createPool({ host: process.env.MYSQL_HOST, port: process.env.MYSQL_PORT, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE, waitForConnections:true, connectionLimit:4 });

  const playlistName = 'Hindi Hits (Bollywood Only)';
  // create playlist
  const [existing] = await pool.query('SELECT id FROM playlists WHERE name = ? LIMIT 1', [playlistName]);
  let playlistId;
  if(existing && existing[0] && existing[0].id){ playlistId = existing[0].id; console.log('Using existing playlist id', playlistId); }
  else{
    const [res] = await pool.execute('INSERT INTO playlists (name, description) VALUES (?, ?)', [playlistName, 'Seeded from iTunes: Bollywood/Hindi queries']);
    playlistId = res.insertId; console.log('Created playlist id', playlistId);
  }

  const TARGET = Number(process.env.TARGET_BOLLYWOOD_COUNT || 120);
  // artist/keyword queries likely to return Bollywood tracks on iTunes
  const queries = [ 'arijit singh', 'shreya ghoshal', 'a r rahman', 'lata mangeshkar', 'kishore kumar', 'kumar sanu', 'sonu nigam', 'mohammad rafi', 'udit narayan', 'alisha chinai', 'neha kakkar', 'pankaj udhas', 'pankaj', 'bollywood', 'hindi film song' ];

  const [cntRow] = await pool.query('SELECT COUNT(*) as c FROM playlist_songs WHERE playlist_id = ?', [playlistId]);
  let currentCount = cntRow && cntRow[0] ? Number(cntRow[0].c) : 0;
  console.log('Playlist currently has', currentCount, 'tracks; target', TARGET);

  for(const q of queries){
    if(currentCount >= TARGET) break;
    try{
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=200`;
      const resp = await axios.get(itunesUrl, { timeout: 20000 });
      const items = resp.data && resp.data.results ? resp.data.results : [];
      console.log('Fetched', items.length, 'results for query', q);
      for(const it of items){
        if(currentCount >= TARGET) break;
        const title = it.trackName || it.collectionName || 'Unknown';
        const artist = it.artistName || '';
        const album = it.collectionName || '';
        const duration = it.trackTimeMillis ? Math.round(it.trackTimeMillis/1000) : null;
        const album_art = it.artworkUrl100 ? it.artworkUrl100.replace('100x100','600x600') : null;
        const preview_url = it.previewUrl || null;
        if(!preview_url) continue;
        // simple language/keyword heuristics to prefer Hindi/Bollywood tracks
        const combined = [title, artist, album].filter(Boolean).join(' ').toLowerCase();
        const hindiWords = ['hindi','bollywood','film','movie','song','raag','dil','pyaar','pyar','deewani','deewana','ye','hai','mera','tera'];
        if(!hindiWords.some(w=>combined.includes(w)) && !/[\u0900-\u097F]/.test(combined) && !artist.toLowerCase().match(/arijit|lata|kishore|shreya|rahman|kumar|sonu|rafi|udit|neha|kakkar/)){
          // Skip non-matching unless we're running out of candidates
          continue;
        }
        const [exists] = await pool.query('SELECT id FROM playlist_songs WHERE playlist_id = ? AND song_title = ? AND song_artist = ? LIMIT 1', [playlistId, title, artist]);
        if(exists && exists[0] && exists[0].id) continue;
        await pool.execute('INSERT INTO playlist_songs (playlist_id, song_title, song_artist, song_album, song_duration, album_art, preview_url) VALUES (?, ?, ?, ?, ?, ?, ?)', [playlistId, title, artist, album, duration?String(duration):'', album_art, preview_url]);
        currentCount++;
      }
    }catch(err){ console.warn('Query failed', q, err.message); }
  }

  console.log('Final playlist count:', currentCount);
  await pool.end();
  console.log('Done. New playlist id:', playlistId);
}

main().catch(err=>{ console.error('Error creating bollywood playlist', err); process.exit(1); });
