#!/usr/bin/env node
// find_song_in_playlists.js
// Usage: node tools/find_song_in_playlists.js <search-term>
// Searches playlist_songs.song_title and song_artist for the term and prints matches with playlist info.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function main(){
  const args = process.argv.slice(2);
  if(args.length < 1){
    console.error('Usage: node find_song_in_playlists.js <search-term>');
    process.exit(2);
  }
  const term = args.join(' ');
  const like = `%${term}%`;

  const pool = await mysql.createPool({ host: process.env.MYSQL_HOST, port: process.env.MYSQL_PORT, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE, waitForConnections:true, connectionLimit:2 });
  try{
    const sql = `SELECT ps.id as ps_id, ps.playlist_id, p.*, ps.song_title, ps.song_artist FROM playlist_songs ps LEFT JOIN playlists p ON p.id = ps.playlist_id WHERE ps.song_title LIKE ? OR ps.song_artist LIKE ? ORDER BY ps.playlist_id LIMIT 500`;
    const [rows] = await pool.query(sql, [like, like]);
    if(!rows || rows.length === 0){
      console.log('NO_MATCHES_FOUND');
      return;
    }
    console.log('Found', rows.length, 'matches. Playlist record columns present:', Object.keys(rows[0]).filter(k=>k.startsWith('playlist_') || ['id','playlist_id','ps_id'].includes(k)));
    console.log('(Showing playlist_id | playlist_name_if_any | ps_id | song_title | song_artist)');
    rows.forEach(r=>{
      // try to find a playlist name-like field
      const nameField = ['name','title','playlist_name','label'].find(f=>r[f] !== undefined);
      const playlistName = nameField ? r[nameField] : '(unknown)';
      console.log(`${r.playlist_id} | ${playlistName} | ${r.ps_id} | ${r.song_title} | ${r.song_artist}`);
    });
  }catch(e){
    console.error('Error searching DB:', e.message);
    process.exit(1);
  }finally{
    await pool.end();
  }
}

main().catch(e=>{ console.error('fatal', e); process.exit(1); });
