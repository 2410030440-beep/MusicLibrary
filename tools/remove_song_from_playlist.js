#!/usr/bin/env node
// remove_song_from_playlist.js
// Usage: node tools/remove_song_from_playlist.js <playlistId> <songTitle> <songArtist>
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function main(){
  const args = process.argv.slice(2);
  if(args.length < 3){
    console.error('Usage: node remove_song_from_playlist.js <playlistId> <songTitle> <songArtist>');
    process.exit(2);
  }
  const playlistId = Number(args[0]);
  const title = args[1];
  const artist = args[2];

  const pool = await mysql.createPool({ host: process.env.MYSQL_HOST, port: process.env.MYSQL_PORT, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE, waitForConnections:true, connectionLimit:2 });

  try{
    const [beforeRow] = await pool.query('SELECT COUNT(*) as c FROM playlist_songs WHERE playlist_id = ? AND song_title = ? AND song_artist LIKE ?', [playlistId, title, artist]);
    const before = (beforeRow && beforeRow[0] && beforeRow[0].c) ? Number(beforeRow[0].c) : 0;
    console.log('Matches found before delete:', before);
    if(before === 0){
      console.log('No matching rows found. Nothing to delete.');
      await pool.end();
      return;
    }

    const [res] = await pool.execute('DELETE FROM playlist_songs WHERE playlist_id = ? AND song_title = ? AND song_artist LIKE ?', [playlistId, title, artist]);
    console.log('Delete result:', res.affectedRows, 'rows removed');

    const [afterRow] = await pool.query('SELECT COUNT(*) as c FROM playlist_songs WHERE playlist_id = ?', [playlistId]);
    const after = (afterRow && afterRow[0] && afterRow[0].c) ? Number(afterRow[0].c) : 0;
    console.log('Playlist', playlistId, 'now has', after, 'songs');
  }catch(e){
    console.error('Error removing song:', e.message);
    process.exit(1);
  }finally{
    await pool.end();
  }
}

main().catch(e=>{ console.error('fatal', e); process.exit(1); });
