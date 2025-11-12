#!/usr/bin/env node
/*
  seed_playlists_from_itunes.js
  If local backups don't contain track rows, this script will populate MySQL
  playlists using the `data-query` terms found in `index.html` playlist cards.

  It fetches tracks from the iTunes Search API and inserts them into MySQL
  (previewUrl included) so the player can play previews.

  Usage: node tools/seed_playlists_from_itunes.js
*/
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const axios = require('axios');

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

async function getSpotifyToken(){
  if(!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null;
  const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  try{
    const resp = await axios.post('https://accounts.spotify.com/api/token', 'grant_type=client_credentials', {
      headers: { 'Authorization': `Basic ${creds}`, 'Content-Type':'application/x-www-form-urlencoded' },
      timeout: 10000
    });
    return resp.data && resp.data.access_token;
  }catch(e){ console.warn('Failed to obtain Spotify token:', e.message); return null; }
}

async function main(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  // crude regex to find playlist-card blocks
  const re = /<div[^>]*class=["'][^"']*playlist-card[^"']*["'][^>]*>/gi;
  const matches = [];
  let m;
  while((m = re.exec(html)) !== null){
    const tag = m[0];
    const idMatch = tag.match(/data-playlist-id=["']([^"']+)["']/i);
    const qMatch = tag.match(/data-query=["']([^"']+)["']/i);
    // find the following h3 content for the name
    const after = html.slice(m.index, m.index + 400);
    const nameMatch = after.match(/<h3>([^<]+)<\/h3>/i);
    const name = nameMatch ? nameMatch[1].trim() : (idMatch ? ('Playlist ' + idMatch[1]) : null);
    const pid = idMatch ? idMatch[1] : null;
    const query = qMatch ? qMatch[1] : null;
    if(pid && query) matches.push({ id: pid, name, query });
  }

  if(!matches.length){ console.log('No playlist-card entries with data-query found in index.html'); return; }

  const pool = await mysql.createPool({ host: process.env.MYSQL_HOST, port: process.env.MYSQL_PORT, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE, waitForConnections:true, connectionLimit:4 });

  const spotifyToken = await getSpotifyToken();
  for(const p of matches){
    console.log('Processing playlist:', p.name, 'query=', p.query);
    // check if playlist exists by name
    const [rows] = await pool.query('SELECT id FROM playlists WHERE name = ? LIMIT 1', [p.name]);
    let playlistId;
    if(rows && rows[0] && rows[0].id){ playlistId = rows[0].id; console.log('  using existing playlist id', playlistId); }
    else{
      const [res] = await pool.execute('INSERT INTO playlists (name, description) VALUES (?, ?)', [p.name, 'seeded from index.html query: ' + p.query]);
      playlistId = res.insertId; console.log('  created playlist id', playlistId);
    }

    let inserted = 0;
    try{
      // Ensure we reach a TARGET number of tracks per playlist (env override)
      const TARGET = Number(process.env.TARGET_TRACKS_PER_PLAYLIST || 120);
      // Count existing tracks
      const [cntRow] = await pool.query('SELECT COUNT(*) as c FROM playlist_songs WHERE playlist_id = ?', [playlistId]);
      let currentCount = cntRow && cntRow[0] ? Number(cntRow[0].c) : 0;
      console.log('  currently has', currentCount, 'tracks; target', TARGET);

      if (spotifyToken) {
        console.log('  Using Spotify search to seed (may require pagination)');
        let offset = 0;
        const pageSize = 50; // Spotify max per request
        while(currentCount < TARGET){
          const resp = await axios.get('https://api.spotify.com/v1/search', { params: { q: p.query, type: 'track', limit: pageSize, offset }, headers: { Authorization: `Bearer ${spotifyToken}` }, timeout: 15000 });
            const items = resp.data?.tracks?.items || [];
            console.log('  spotify fetched', items.length, 'tracks at offset', offset);
            if(!items.length) break;
            for(const it of items){
              if(currentCount >= TARGET) break;
              const title = it.name || 'Unknown';
              const artist = (it.artists && it.artists[0] && it.artists[0].name) || '';
              const album = it.album && it.album.name || '';
              const duration = it.duration_ms ? Math.round(it.duration_ms/1000) : null;
              const album_art = it.album && it.album.images && it.album.images[0] && it.album.images[0].url || null;
              const preview_url = it.preview_url || null;
              if(!preview_url) continue;
              const [exists] = await pool.query('SELECT id FROM playlist_songs WHERE playlist_id = ? AND song_title = ? AND song_artist = ? LIMIT 1', [playlistId, title, artist]);
              if(exists && exists[0] && exists[0].id) continue;
              await pool.execute('INSERT INTO playlist_songs (playlist_id, song_title, song_artist, song_album, song_duration, album_art, preview_url) VALUES (?, ?, ?, ?, ?, ?, ?)', [playlistId, title, artist, album, duration?String(duration):'', album_art, preview_url]);
              inserted++; currentCount++;
            }
          offset += pageSize;
          // Safety guard: avoid large infinite loops
          if(offset > 10000) break;
        }
        console.log('  inserted', inserted, 'tracks into playlist', playlistId);
      } else {
          console.log('  Spotify credentials not found in .env. Falling back to iTunes search to seed preview tracks.');
          // iTunes fallback: request a larger limit and only insert until TARGET
          try{
            const q = encodeURIComponent(p.query);
            // iTunes supports up to 200 results in one call; request that many
            const limit = Math.min(200, Math.max(50, TARGET));
            const itunesUrl = `https://itunes.apple.com/search?term=${q}&entity=song&limit=${limit}`;
            const resp = await axios.get(itunesUrl, { timeout: 20000 });
            const items = resp.data && resp.data.results ? resp.data.results : [];
            console.log('  itunes fetched', items.length, 'tracks');
            for(const it of items){
              if(currentCount >= TARGET) break;
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
              inserted++; currentCount++;
            }
            console.log('  inserted', inserted, 'tracks into playlist', playlistId);
          }catch(err){ console.warn('  iTunes fetch/insert failed for', p.query, err.message); }
      }
    }catch(err){ console.warn('  fetch/insert failed for', p.query, err.message); }
  }

  await pool.end();
  console.log('Seeding completed.');
}

main().catch(err=>{ console.error('Seed failed', err); process.exit(1); });
