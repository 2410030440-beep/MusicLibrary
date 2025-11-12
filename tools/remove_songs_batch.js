#!/usr/bin/env node
// remove_songs_batch.js
// Usage: node tools/remove_songs_batch.js <playlistId> <pattern1> <pattern2> ...
// This script will list matching rows for the given patterns (matching title OR artist using LIKE),
// print a summary, then delete those rows.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function main(){
  const args = process.argv.slice(2);
  if(args.length < 2){
    console.error('Usage: node remove_songs_batch.js <playlistId> <pattern1> <pattern2> ...');
    process.exit(2);
  }
  const playlistId = Number(args[0]);
  const patterns = args.slice(1);
  if(!patterns.length){
    console.error('No patterns provided.');
    process.exit(2);
  }

  const pool = await mysql.createPool({ host: process.env.MYSQL_HOST, port: process.env.MYSQL_PORT, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE, waitForConnections:true, connectionLimit:2 });

  try{
    let totalMatches = 0;
    const matches = [];
    for(const p of patterns){
      const like = `%${p}%`;
      const [rows] = await pool.query('SELECT id, song_title, song_artist FROM playlist_songs WHERE playlist_id = ? AND (song_title LIKE ? OR song_artist LIKE ?)', [playlistId, like, like]);
      if(rows && rows.length){
        for(const r of rows){
          // avoid duplicates if multiple patterns match same row
          if(!matches.find(m=>m.id===r.id)) matches.push(r);
        }
      }
    }

    totalMatches = matches.length;
    console.log('Found', totalMatches, 'matching rows for playlist', playlistId);
    if(totalMatches === 0){
      console.log('Nothing to delete.');
      return;
    }

    // Show a compact sample of matches
    console.log('Sample matches (first 20):');
    matches.slice(0,20).forEach(m=>console.log(`  id=${m.id} | ${m.song_title} --- ${m.song_artist}`));

    // Proceed with delete
    const ids = matches.map(m=>m.id);
    // Use safe parameterization in chunks to avoid huge queries
    const chunkSize = 200;
    let removed = 0;
    for(let i=0;i<ids.length;i+=chunkSize){
      const chunk = ids.slice(i,i+chunkSize);
      const placeholders = chunk.map(()=>'?').join(',');
      const sql = `DELETE FROM playlist_songs WHERE id IN (${placeholders})`;
      const [res] = await pool.execute(sql, chunk);
      removed += res.affectedRows || 0;
    }

    console.log('Deleted', removed, 'rows from playlist', playlistId);

    const [afterRow] = await pool.query('SELECT COUNT(*) as c FROM playlist_songs WHERE playlist_id = ?', [playlistId]);
    const after = (afterRow && afterRow[0] && afterRow[0].c) ? Number(afterRow[0].c) : 0;
    console.log('Playlist', playlistId, 'now has', after, 'songs');

  }catch(e){
    console.error('Error during batch remove:', e.message);
    process.exit(1);
  }finally{
    await pool.end();
  }
}

main().catch(e=>{ console.error('fatal', e); process.exit(1); });
