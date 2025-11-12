const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World!');
});

const server = app.listen(3000, '127.0.0.1', () => {
  console.log('Test server listening at http://127.0.0.1:3000');
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

