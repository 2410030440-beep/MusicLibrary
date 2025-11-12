const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });

const USE_MYSQL = !!(process.env.MYSQL_HOST || (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mysql')));

let impl = null;
let initPromise = null;

async function initSqlite() {
  const Database = require('better-sqlite3');
  const dbPath = path.join(__dirname, 'music.db');
  // ensure folder exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  // Create tables (SQLite)
  db.exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS playlist_songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      song_title TEXT NOT NULL,
      song_artist TEXT NOT NULL,
      song_album TEXT,
      song_duration TEXT,
      album_art TEXT,
      preview_url TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_title TEXT NOT NULL,
      song_artist TEXT NOT NULL,
      song_album TEXT,
      song_duration TEXT,
      album_art TEXT,
      preview_url TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS listen_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_title TEXT NOT NULL,
      song_artist TEXT NOT NULL,
      song_album TEXT,
      song_duration TEXT,
      album_art TEXT,
      preview_url TEXT,
      played_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_title TEXT NOT NULL,
      song_artist TEXT NOT NULL,
      rating INTEGER CHECK(rating >= 1 AND rating <= 5),
      rated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(song_title, song_artist)
    )
  `);

  // Liked songs with per-user support (SQLite)
  db.exec(`
    CREATE TABLE IF NOT EXISTS liked_songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      song_title TEXT NOT NULL,
      song_artist TEXT NOT NULL,
      song_album TEXT,
      song_duration TEXT,
      album_art TEXT,
      preview_url TEXT,
      liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, song_title, song_artist)
    )
  `);

  console.log('✅ SQLite database initialized');

  // Provide async wrapper functions for the server to call uniformly
  impl = {
    async createPlaylist(name, description){ const info = db.prepare('INSERT INTO playlists (name, description) VALUES (?, ?)').run(name, description); return { lastInsertRowid: info.lastInsertRowid }; },
    async getAllPlaylists(){ return db.prepare('SELECT * FROM playlists ORDER BY created_at DESC').all(); },
    async getPlaylistById(id){ return db.prepare('SELECT * FROM playlists WHERE id = ?').get(id); },
    async deletePlaylist(id){ return db.prepare('DELETE FROM playlists WHERE id = ?').run(id); },
    async updatePlaylist(id, name, description){ return db.prepare('UPDATE playlists SET name = ?, description = ? WHERE id = ?').run(name, description, id); },
    async addSongToPlaylist(playlistId, song_title, song_artist, song_album, song_duration, album_art, preview_url){ return db.prepare(`INSERT INTO playlist_songs (playlist_id, song_title, song_artist, song_album, song_duration, album_art, preview_url) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(playlistId, song_title, song_artist, song_album, song_duration, album_art, preview_url); },
    async getPlaylistSongs(playlistId){ return db.prepare('SELECT * FROM playlist_songs WHERE playlist_id = ? ORDER BY added_at DESC').all(playlistId); },
    async removeSongFromPlaylist(songId){ return db.prepare('DELETE FROM playlist_songs WHERE id = ?').run(songId); },
    async getSongCountInPlaylist(playlistId){ const r = db.prepare('SELECT COUNT(*) as count FROM playlist_songs WHERE playlist_id = ?').get(playlistId); return r.count; },
    async addFavorite(song_title, song_artist, song_album, song_duration, album_art, preview_url){ return db.prepare('INSERT INTO favorites (song_title, song_artist, song_album, song_duration, album_art, preview_url) VALUES (?, ?, ?, ?, ?, ?)').run(song_title, song_artist, song_album, song_duration, album_art, preview_url); },
    async getAllFavorites(){ return db.prepare('SELECT * FROM favorites ORDER BY added_at DESC').all(); },
    async removeFavorite(song_title, song_artist){ return db.prepare('DELETE FROM favorites WHERE song_title = ? AND song_artist = ?').run(song_title, song_artist); },
    async isFavorite(song_title, song_artist){ return db.prepare('SELECT id FROM favorites WHERE song_title = ? AND song_artist = ? LIMIT 1').get(song_title, song_artist); },
    async addToHistory(song_title, song_artist, song_album, song_duration, album_art, preview_url){ return db.prepare('INSERT INTO listen_history (song_title, song_artist, song_album, song_duration, album_art, preview_url) VALUES (?, ?, ?, ?, ?, ?)').run(song_title, song_artist, song_album, song_duration, album_art, preview_url); },
    async getHistory(limit){ return db.prepare('SELECT * FROM listen_history ORDER BY played_at DESC LIMIT ?').all(limit); },
    async clearHistory(){ return db.prepare('DELETE FROM listen_history').run(); },
    async removeHistoryItem(id){ return db.prepare('DELETE FROM listen_history WHERE id = ?').run(id); },
    async addRating(song_title, song_artist, rating){ return db.prepare('INSERT INTO ratings (song_title, song_artist, rating) VALUES (?, ?, ?) ON CONFLICT(song_title, song_artist) DO UPDATE SET rating = excluded.rating, rated_at = CURRENT_TIMESTAMP').run(song_title, song_artist, rating); },
    async getRating(song_title, song_artist){ return db.prepare('SELECT rating FROM ratings WHERE song_title = ? AND song_artist = ?').get(song_title, song_artist); },
    async getAllRatings(){ return db.prepare('SELECT * FROM ratings ORDER BY rated_at DESC').all(); },
    // Liked songs API (SQLite)
    async addLikedSong(user_id, song_title, song_artist, song_album, song_duration, album_art, preview_url){
      return db.prepare('INSERT OR IGNORE INTO liked_songs (user_id, song_title, song_artist, song_album, song_duration, album_art, preview_url) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(user_id, song_title, song_artist, song_album, song_duration, album_art, preview_url);
    },
    async removeLikedSong(user_id, song_title, song_artist){
      return db.prepare('DELETE FROM liked_songs WHERE user_id = ? AND song_title = ? AND song_artist = ?')
        .run(user_id, song_title, song_artist);
    },
    async isLikedSong(user_id, song_title, song_artist){
      return db.prepare('SELECT id FROM liked_songs WHERE user_id = ? AND song_title = ? AND song_artist = ? LIMIT 1')
        .get(user_id, song_title, song_artist);
    },
    async getLikedSongs(user_id){
      return db.prepare('SELECT * FROM liked_songs WHERE user_id = ? ORDER BY liked_at DESC').all(user_id);
    }
  };
}

async function initMysql(){
  const mysql = require('mysql2/promise');
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'musiclibrary';

  const pool = mysql.createPool({ host, port, user, password, database, waitForConnections: true, connectionLimit: 10 });

  // Create database if not exists (connect to server first)
  try{
    const admin = await mysql.createConnection({ host, port, user, password });
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    await admin.end();
  }catch(e){ /* ignore */ }

  // Create tables (MySQL syntax)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS playlists (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS playlist_songs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      playlist_id INT NOT NULL,
      song_title VARCHAR(512) NOT NULL,
      song_artist VARCHAR(255) NOT NULL,
      song_album VARCHAR(255),
      song_duration VARCHAR(50),
      album_art VARCHAR(1024),
      preview_url VARCHAR(1024),
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INT AUTO_INCREMENT PRIMARY KEY,
      song_title VARCHAR(512) NOT NULL,
      song_artist VARCHAR(255) NOT NULL,
      song_album VARCHAR(255),
      song_duration VARCHAR(50),
      album_art VARCHAR(1024),
      preview_url VARCHAR(1024),
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS listen_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      song_title VARCHAR(512) NOT NULL,
      song_artist VARCHAR(255) NOT NULL,
      song_album VARCHAR(255),
      song_duration VARCHAR(50),
      album_art VARCHAR(1024),
      preview_url VARCHAR(1024),
      played_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ratings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      song_title VARCHAR(512) NOT NULL,
      song_artist VARCHAR(255) NOT NULL,
      rating INT,
      rated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_song (song_title, song_artist)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS liked_songs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      song_title VARCHAR(255) NOT NULL,
      song_artist VARCHAR(255) NOT NULL,
      song_album VARCHAR(255),
      song_duration VARCHAR(50),
      album_art VARCHAR(512),
      preview_url VARCHAR(512),
      liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_song (user_id(64), song_title(255), song_artist(255))
    )
  `);

  console.log('✅ MySQL database initialized');

  impl = {
    async createPlaylist(name, description){ const [res] = await pool.execute('INSERT INTO playlists (name, description) VALUES (?, ?)', [name, description]); return { lastInsertRowid: res.insertId }; },
    async getAllPlaylists(){ const [rows] = await pool.query('SELECT * FROM playlists ORDER BY created_at DESC'); return rows; },
    async getPlaylistById(id){ const [rows] = await pool.query('SELECT * FROM playlists WHERE id = ?', [id]); return rows[0]; },
    async deletePlaylist(id){ return pool.execute('DELETE FROM playlists WHERE id = ?', [id]); },
    async updatePlaylist(id, name, description){ return pool.execute('UPDATE playlists SET name = ?, description = ? WHERE id = ?', [name, description, id]); },
    async addSongToPlaylist(playlistId, song_title, song_artist, song_album, song_duration, album_art, preview_url){ return pool.execute('INSERT INTO playlist_songs (playlist_id, song_title, song_artist, song_album, song_duration, album_art, preview_url) VALUES (?, ?, ?, ?, ?, ?, ?)', [playlistId, song_title, song_artist, song_album, song_duration, album_art, preview_url]); },
    async getPlaylistSongs(playlistId){ const [rows] = await pool.query('SELECT * FROM playlist_songs WHERE playlist_id = ? ORDER BY added_at DESC', [playlistId]); return rows; },
    async removeSongFromPlaylist(songId){ return pool.execute('DELETE FROM playlist_songs WHERE id = ?', [songId]); },
    async getSongCountInPlaylist(playlistId){ const [rows] = await pool.query('SELECT COUNT(*) as count FROM playlist_songs WHERE playlist_id = ?', [playlistId]); return rows[0].count; },
    async addFavorite(song_title, song_artist, song_album, song_duration, album_art, preview_url){ return pool.execute('INSERT INTO favorites (song_title, song_artist, song_album, song_duration, album_art, preview_url) VALUES (?, ?, ?, ?, ?, ?)', [song_title, song_artist, song_album, song_duration, album_art, preview_url]); },
    async getAllFavorites(){ const [rows] = await pool.query('SELECT * FROM favorites ORDER BY added_at DESC'); return rows; },
    async removeFavorite(song_title, song_artist){ return pool.execute('DELETE FROM favorites WHERE song_title = ? AND song_artist = ?', [song_title, song_artist]); },
    async isFavorite(song_title, song_artist){ const [rows] = await pool.query('SELECT id FROM favorites WHERE song_title = ? AND song_artist = ? LIMIT 1', [song_title, song_artist]); return rows[0]; },
    async addToHistory(song_title, song_artist, song_album, song_duration, album_art, preview_url){ return pool.execute('INSERT INTO listen_history (song_title, song_artist, song_album, song_duration, album_art, preview_url) VALUES (?, ?, ?, ?, ?, ?)', [song_title, song_artist, song_album, song_duration, album_art, preview_url]); },
  async getHistory(limit){ const [rows] = await pool.query('SELECT * FROM listen_history ORDER BY played_at DESC LIMIT ?', [limit]); return rows; },
  async clearHistory(){ return pool.execute('DELETE FROM listen_history'); },
  async removeHistoryItem(id){ return pool.execute('DELETE FROM listen_history WHERE id = ?', [id]); },
    async addRating(song_title, song_artist, rating){ return pool.execute('INSERT INTO ratings (song_title, song_artist, rating) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE rating = VALUES(rating), rated_at = CURRENT_TIMESTAMP', [song_title, song_artist, rating]); },
    async getRating(song_title, song_artist){ const [rows] = await pool.query('SELECT rating FROM ratings WHERE song_title = ? AND song_artist = ? LIMIT 1', [song_title, song_artist]); return rows[0]; },
    async getAllRatings(){ const [rows] = await pool.query('SELECT * FROM ratings ORDER BY rated_at DESC'); return rows; },
    // Liked songs API (MySQL)
    async addLikedSong(user_id, song_title, song_artist, song_album, song_duration, album_art, preview_url){
      return pool.execute(
        'INSERT IGNORE INTO liked_songs (user_id, song_title, song_artist, song_album, song_duration, album_art, preview_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [user_id, song_title, song_artist, song_album, song_duration, album_art, preview_url]
      );
    },
    async removeLikedSong(user_id, song_title, song_artist){
      return pool.execute('DELETE FROM liked_songs WHERE user_id = ? AND song_title = ? AND song_artist = ?', [user_id, song_title, song_artist]);
    },
    async isLikedSong(user_id, song_title, song_artist){
      const [rows] = await pool.query('SELECT id FROM liked_songs WHERE user_id = ? AND song_title = ? AND song_artist = ? LIMIT 1', [user_id, song_title, song_artist]);
      return rows[0];
    },
    async getLikedSongs(user_id){
      const [rows] = await pool.query('SELECT * FROM liked_songs WHERE user_id = ? ORDER BY liked_at DESC', [user_id]);
      return rows;
    }
  };
}

// Initialize the selected backend
async function initialize(){
  if(USE_MYSQL){
    try {
      await initMysql();
    } catch(err) {
      console.warn('⚠️  MySQL init failed:', err.message);
      console.log('🔄 Falling back to SQLite...');
      await initSqlite();
    }
  } else {
    await initSqlite();
  }
}

// Start initialization immediately
initPromise = initialize().catch(err => { console.error('DB init error', err); process.exit(1); });

// Helper to ensure init is complete
async function waitForInit() {
  if (initPromise) await initPromise;
  if (!impl) throw new Error('Database not initialized');
}

module.exports = {
  waitForInit,
  // Expose async API functions that wait for init
  createPlaylist: async (...args) => { await waitForInit(); return impl.createPlaylist(...args); },
  getAllPlaylists: async (...args) => { await waitForInit(); return impl.getAllPlaylists(...args); },
  getPlaylistById: async (...args) => { await waitForInit(); return impl.getPlaylistById(...args); },
  deletePlaylist: async (...args) => { await waitForInit(); return impl.deletePlaylist(...args); },
  updatePlaylist: async (...args) => { await waitForInit(); return impl.updatePlaylist(...args); },
  addSongToPlaylist: async (...args) => { await waitForInit(); return impl.addSongToPlaylist(...args); },
  getPlaylistSongs: async (...args) => { await waitForInit(); return impl.getPlaylistSongs(...args); },
  removeSongFromPlaylist: async (...args) => { await waitForInit(); return impl.removeSongFromPlaylist(...args); },
  getSongCountInPlaylist: async (...args) => { await waitForInit(); return impl.getSongCountInPlaylist(...args); },
  addFavorite: async (...args) => { await waitForInit(); return impl.addFavorite(...args); },
  getAllFavorites: async (...args) => { await waitForInit(); return impl.getAllFavorites(...args); },
  removeFavorite: async (...args) => { await waitForInit(); return impl.removeFavorite(...args); },
  isFavorite: async (...args) => { await waitForInit(); return impl.isFavorite(...args); },
  addToHistory: async (...args) => { await waitForInit(); return impl.addToHistory(...args); },
  getHistory: async (...args) => { await waitForInit(); return impl.getHistory(...args); },
  clearHistory: async (...args) => { await waitForInit(); return impl.clearHistory(...args); },
  removeHistoryItem: async (...args) => { await waitForInit(); return impl.removeHistoryItem(...args); },
  addRating: async (...args) => { await waitForInit(); return impl.addRating(...args); },
  getRating: async (...args) => { await waitForInit(); return impl.getRating(...args); },
  getAllRatings: async (...args) => { await waitForInit(); return impl.getAllRatings(...args); }
  ,
    // Liked songs exports
  addLikedSong: async (...args) => { 
    await waitForInit(); 
    console.log('DB: Adding liked song:', ...args); 
    const result = await impl.addLikedSong(...args);
    console.log('DB: Add liked song result:', result);
    return result;
  },
  removeLikedSong: async (...args) => { 
    await waitForInit(); 
    console.log('DB: Removing liked song:', ...args);
    const result = await impl.removeLikedSong(...args);
    console.log('DB: Remove liked song result:', result);
    return result;
  },
  isLikedSong: async (...args) => { 
    await waitForInit(); 
    console.log('DB: Checking if song is liked:', ...args);
    const result = await impl.isLikedSong(...args);
    console.log('DB: Is liked song result:', result);
    return result;
  },
  getLikedSongs: async (...args) => { 
    await waitForInit(); 
    console.log('DB: Getting liked songs:', ...args);
    const result = await impl.getLikedSongs(...args);
    console.log('DB: Get liked songs result count:', result?.length);
    return result;
  }
};








