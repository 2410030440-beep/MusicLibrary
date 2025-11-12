#!/usr/bin/env node
// create_empty_playlist.js
// Creates an empty playlist and prints its id.
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function main(){
  const pool = await mysql.createPool({ host: process.env.MYSQL_HOST, port: process.env.MYSQL_PORT, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE, waitForConnections:true, connectionLimit:2 });
  const name = 'Chill Vibes (Empty)';
  const [exists] = await pool.query('SELECT id FROM playlists WHERE name = ? LIMIT 1', [name]);
  if(exists && exists[0] && exists[0].id){ console.log('Existing playlist id', exists[0].id); await pool.end(); return; }
  const [res] = await pool.execute('INSERT INTO playlists (name, description) VALUES (?, ?)', [name, 'Empty placeholder created programmatically']);
  console.log('Created empty playlist id', res.insertId);
  await pool.end();
}

main().catch(err=>{ console.error(err); process.exit(1); });
