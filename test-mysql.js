// Quick test to verify MySQL connection
const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

async function testMySQL() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'music_library'
    });

    console.log('✅ Successfully connected to MySQL!');
    console.log(`📊 Database: ${process.env.MYSQL_DATABASE || 'music_library'}`);
    
    // List tables
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`\n📋 Tables in database:`);
    tables.forEach(row => {
      const tableName = Object.values(row)[0];
      console.log(`   - ${tableName}`);
    });

    // Check playlists table
    const [playlists] = await connection.query('SELECT * FROM playlists');
    console.log(`\n🎵 Playlists (${playlists.length} total):`);
    if (playlists.length > 0) {
      playlists.forEach(p => console.log(`   - ${p.name}`));
    } else {
      console.log('   (empty)');
    }

    await connection.end();
    console.log('\n✅ MySQL connection test complete!');
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    process.exit(1);
  }
}

testMySQL();
