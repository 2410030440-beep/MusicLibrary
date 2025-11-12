/**
 * Migration script to copy data from SQLite to MySQL
 * This safely backs up SQLite DB and copies all data to MySQL
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function migrate() {
  console.log('🚀 Starting SQLite to MySQL migration...\n');

  // Step 1: Backup SQLite database
  const sqlitePath = path.join(__dirname, '..', 'music.db');
  const backupPath = path.join(__dirname, '..', 'music.db.backup');

  if (!fs.existsSync(sqlitePath)) {
    console.log('❌ SQLite database not found at:', sqlitePath);
    console.log('   Nothing to migrate.');
    return;
  }

  console.log('📦 Creating backup of SQLite database...');
  fs.copyFileSync(sqlitePath, backupPath);
  console.log('✅ Backup created:', backupPath);

  // Step 2: Connect to SQLite
  const Database = require('better-sqlite3');
  const sqliteDb = new Database(sqlitePath, { readonly: true });
  console.log('✅ Connected to SQLite database\n');

  // Step 3: Connect to MySQL
  const mysql = require('mysql2/promise');
  const mysqlConnection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'music_library'
  });
  console.log('✅ Connected to MySQL database\n');

  const stats = {
    playlists: 0,
    playlist_songs: 0,
    favorites: 0,
    listen_history: 0,
    ratings: 0,
    liked_songs: 0
  };

  try {
    // Step 4: Migrate playlists
    console.log('📋 Migrating playlists...');
    const playlists = sqliteDb.prepare('SELECT * FROM playlists').all();
    
    for (const playlist of playlists) {
      const [result] = await mysqlConnection.execute(
        'INSERT INTO playlists (name, description, created_at) VALUES (?, ?, ?)',
        [playlist.name, playlist.description, playlist.created_at]
      );
      
      const newPlaylistId = result.insertId;
      
      // Migrate songs for this playlist
      const songs = sqliteDb.prepare('SELECT * FROM playlist_songs WHERE playlist_id = ?').all(playlist.id);
      
      for (const song of songs) {
        await mysqlConnection.execute(
          'INSERT INTO playlist_songs (playlist_id, song_title, song_artist, song_album, song_duration, album_art, preview_url, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [newPlaylistId, song.song_title, song.song_artist, song.song_album, song.song_duration, song.album_art, song.preview_url, song.added_at]
        );
        stats.playlist_songs++;
      }
      
      stats.playlists++;
      console.log(`   ✓ Migrated playlist: ${playlist.name} (${songs.length} songs)`);
    }

    // Step 5: Migrate favorites
    console.log('\n❤️  Migrating favorites...');
    const favorites = sqliteDb.prepare('SELECT * FROM favorites').all();
    
    for (const fav of favorites) {
      await mysqlConnection.execute(
        'INSERT INTO favorites (song_title, song_artist, song_album, song_duration, album_art, preview_url, added_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [fav.song_title, fav.song_artist, fav.song_album, fav.song_duration, fav.album_art, fav.preview_url, fav.added_at]
      );
      stats.favorites++;
    }
    console.log(`   ✓ Migrated ${stats.favorites} favorites`);

    // Step 6: Migrate listen history
    console.log('\n🎧 Migrating listen history...');
    const history = sqliteDb.prepare('SELECT * FROM listen_history').all();
    
    for (const item of history) {
      await mysqlConnection.execute(
        'INSERT INTO listen_history (song_title, song_artist, song_album, song_duration, album_art, preview_url, played_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [item.song_title, item.song_artist, item.song_album, item.song_duration, item.album_art, item.preview_url, item.played_at]
      );
      stats.listen_history++;
    }
    console.log(`   ✓ Migrated ${stats.listen_history} history items`);

    // Step 7: Migrate ratings
    console.log('\n⭐ Migrating ratings...');
    const ratings = sqliteDb.prepare('SELECT * FROM ratings').all();
    
    for (const rating of ratings) {
      await mysqlConnection.execute(
        'INSERT INTO ratings (song_title, song_artist, rating, rated_at) VALUES (?, ?, ?, ?)',
        [rating.song_title, rating.song_artist, rating.rating, rating.rated_at]
      );
      stats.ratings++;
    }
    console.log(`   ✓ Migrated ${stats.ratings} ratings`);

    // Step 8: Migrate liked songs (per-user likes)
    console.log('\n💗 Migrating liked songs...');
    let liked = [];
    try { liked = sqliteDb.prepare('SELECT * FROM liked_songs').all(); } catch(e){ liked = []; }
    for (const row of liked) {
      // Use INSERT IGNORE to avoid duplicate rows when migrating repeatedly
      await mysqlConnection.execute(
        'INSERT IGNORE INTO liked_songs (user_id, song_title, song_artist, song_album, song_duration, album_art, preview_url, liked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [row.user_id, row.song_title, row.song_artist, row.song_album, row.song_duration, row.album_art, row.preview_url, row.liked_at]
      );
      stats.liked_songs++;
    }
    console.log(`   ✓ Migrated ${stats.liked_songs} liked songs`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    sqliteDb.close();
    await mysqlConnection.end();
  }

  // Step 9: Summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ Migration completed successfully!');
  console.log('='.repeat(50));
  console.log(`📊 Migration Summary:`);
  console.log(`   Playlists:       ${stats.playlists}`);
  console.log(`   Playlist Songs:  ${stats.playlist_songs}`);
  console.log(`   Favorites:       ${stats.favorites}`);
  console.log(`   Listen History:  ${stats.listen_history}`);
  console.log(`   Ratings:         ${stats.ratings}`);
  console.log(`   Liked Songs:     ${stats.liked_songs}`);
  console.log(`\n💾 SQLite backup saved at: ${backupPath}`);
  console.log(`\n🎉 Your data is now in MySQL!`);
}

// Run migration
migrate().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
