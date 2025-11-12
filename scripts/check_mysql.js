require('dotenv').config({path: './.env'});
(async ()=>{
  const mysql = require('mysql2/promise');
  const cfg = { host:process.env.MYSQL_HOST, port: process.env.MYSQL_PORT?Number(process.env.MYSQL_PORT):3306, user:process.env.MYSQL_USER, password:process.env.MYSQL_PASSWORD, database:process.env.MYSQL_DATABASE };
  try{
    const conn = await mysql.createConnection(cfg);
    const [tables] = await conn.query('SHOW TABLES');
    console.log('MySQL DB:', cfg.database);
    if(!tables || tables.length===0){ console.log('No tables found'); }
    else{
      console.log('Tables:');
      for(const r of tables){ const t = Object.values(r)[0]; const [cnt] = await conn.query(`SELECT COUNT(*) as c FROM \`${t}\``); console.log(' -', t, 'rows:', cnt[0].c); }
    }
    await conn.end();
  }catch(e){ console.error('MySQL check failed:', e.message); process.exit(2); }
})();
