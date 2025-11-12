#!/usr/bin/env node
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
async function main(){
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = process.env.MYSQL_PORT || 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'musiclibrary';
  const pool = await mysql.createPool({ host, port, user, password, database, connectionLimit:2 });
  try{
    const [playlists] = await pool.query('SELECT COUNT(*) as c FROM playlists');
    console.log('playlists count:', playlists[0].c);
    const [songs] = await pool.query('SELECT COUNT(*) as c FROM playlist_songs');
    console.log('playlist_songs count:', songs[0].c);
    const [sample] = await pool.query('SELECT * FROM playlist_songs LIMIT 5');
    console.log('sample songs:', sample);
  }catch(e){ console.error('mysql inspect error', e.message); }
  await pool.end();
}
main();
