/* Simple Express server that serves static files and proxies Spotify Search */
const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv');
// Always load .env from the project folder (same dir as this file),
// even if the server is started from a different working directory.
dotenv.config({ path: path.join(__dirname, '.env') });

// Initialize database (this will create tables automatically)
const db = require('./database');

const app = express();
app.use(express.json());
app.use(cors({ origin: true }));

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 5173);
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const YT_API_KEY = process.env.YOUTUBE_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY || '';
const JAMENDO_CLIENT_ID = process.env.JAMENDO_CLIENT_ID || '';
const AUDIUS_API = 'https://discoveryprovider.audius.co/v1';

let tokenCache = {
  accessToken: null,
  expiresAt: 0,
};

async function getSpotifyToken() {
  const now = Date.now();
  if (tokenCache.accessToken && now < tokenCache.expiresAt - 5000) {
    return tokenCache.accessToken;
  }
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.warn('Spotify API keys not configured, using mock data');
    return null;
  }
  const authHeader = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');

  const resp = await axios.post('https://accounts.spotify.com/api/token', params, {
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  const { access_token, expires_in } = resp.data;
  tokenCache.accessToken = access_token;
  tokenCache.expiresAt = Date.now() + (expires_in * 1000);
  return access_token;
}

app.get('/api/spotify/search', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.status(400).json({ error: 'Missing q parameter' });
  if (!YT_API_KEY) return res.status(503).json({ error: 'missing_api_key', detail: 'Set YOUTUBE_API_KEY in .env' });
  try {
    const url = 'https://www.googleapis.com/youtube/v3/search';
    const resp = await axios.get(url, {
      params: {
        key: YT_API_KEY,
        part: 'snippet',
        q: q + ' official audio',
        type: 'video',
        maxResults: 25,
        videoCategoryId: 10,
        safeSearch: 'moderate'
      }
    });
    const items = (resp.data?.items || []).map(it => ({
      videoId: it.id?.videoId,
      name: it.snippet?.title,
      artists: [{ name: it.snippet?.channelTitle }],
      album: { 
        name: it.snippet?.channelTitle,
        images: [{ url: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.default?.url }]
      },
      duration_ms: 240000,
      preview_url: null
    }));
    res.json({ tracks: { items } });
  } catch (err) {
    const status = err.response?.status || 500;
    const detail = err.response?.data || err.message;
    console.error('YouTube /api/spotify/search error:', detail);
    res.status(status).json({ error: 'youtube_search_failed', detail: JSON.stringify(detail) });
  }
});

// Search artists
app.get('/api/spotify/artists', async (req, res) => {
  const q = (req.query.q || 'a').toString();
  try {
    const token = await getSpotifyToken();
    if (!token) {
      // Return mock data when Spotify is not configured
      return res.json({
        artists: {
          items: [
            { id: '1', name: 'Luna Rhodes', images: [{ url: 'https://picsum.photos/seed/lunarho/600/600' }] },
            { id: '2', name: 'Echo Rivers', images: [{ url: 'https://picsum.photos/seed/echoriv/600/600' }] },
            { id: '3', name: 'Maya Storm', images: [{ url: 'https://picsum.photos/seed/mayasto/600/600' }] }
          ]
        }
      });
    }
    const resp = await axios.get('https://api.spotify.com/v1/search', {
      params: { q, type: 'artist', limit: 24 },
      headers: { Authorization: `Bearer ${token}` },
    });
    res.json(resp.data);
  } catch (err) {
    console.error('Spotify artists error:', err.message);
    // Return mock data on error
    res.json({
      artists: {
        items: [
          { id: '1', name: 'Luna Rhodes', images: [{ url: 'https://picsum.photos/seed/lunarho/600/600' }] },
          { id: '2', name: 'Echo Rivers', images: [{ url: 'https://picsum.photos/seed/echoriv/600/600' }] },
          { id: '3', name: 'Maya Storm', images: [{ url: 'https://picsum.photos/seed/mayasto/600/600' }] }
        ]
      }
    });
  }
});

// Featured playlists (public, no user auth needed)
app.get('/api/spotify/playlists/featured', async (req, res) => {
  const country = (req.query.country || 'US').toString();
  try {
    const token = await getSpotifyToken();
    if (!token) {
      // Return mock data when Spotify is not configured
      return res.json({
        message: 'Featured Playlists',
        playlists: {
          items: [
            { id: '1', name: 'Morning Focus', description: 'Start your day with focus', images: [{ url: 'https://picsum.photos/seed/focus/600/600' }] },
            { id: '2', name: 'Weekend Party', description: 'Weekend vibes', images: [{ url: 'https://picsum.photos/seed/party/600/600' }] },
            { id: '3', name: 'Road Trip', description: 'Perfect for driving', images: [{ url: 'https://picsum.photos/seed/road/600/600' }] }
          ]
        }
      });
    }
    const resp = await axios.get('https://api.spotify.com/v1/browse/featured-playlists', {
      params: { country, limit: 24 },
      headers: { Authorization: `Bearer ${token}` },
    });
    res.json(resp.data);
  } catch (err) {
    console.error('Spotify playlists error:', err.message);
    // Return mock data on error
    res.json({
      message: 'Featured Playlists',
      playlists: {
        items: [
          { id: '1', name: 'Morning Focus', description: 'Start your day with focus', images: [{ url: 'https://picsum.photos/seed/focus/600/600' }] },
          { id: '2', name: 'Weekend Party', description: 'Weekend vibes', images: [{ url: 'https://picsum.photos/seed/party/600/600' }] },
          { id: '3', name: 'Road Trip', description: 'Perfect for driving', images: [{ url: 'https://picsum.photos/seed/road/600/600' }] }
        ]
      }
    });
  }
});

// Google Gemini AI chat endpoint
app.post('/api/chat/ask', async (req, res) => {
  const msg = (req.body?.message || '').toString().trim();
  if (!msg) return res.json({ reply: 'Hello! I can help you discover music. Try asking me to recommend songs, artists, or playlists!' });
  
  if (!GEMINI_API_KEY) {
    const reply = msg ? `You said: "${msg}" — I can suggest tracks if you search above.` : 'Hello! Try asking for Hindi songs or an artist.';
    return res.json({ reply });
  }

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: `You are a helpful music assistant for a music library app. The user said: "${msg}". 
            
Give a friendly, concise response (2-3 sentences max). If they ask about music, recommend songs/artists. If they ask to play something, suggest they use the search feature. Be conversational and enthusiastic about music! 🎵`
          }]
        }]
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I had trouble understanding that. Try asking about music recommendations!';
    res.json({ reply: reply.trim() });
  } catch (err) {
    console.error('Gemini API error:', err.response?.data || err.message);
    res.json({ reply: `I can help with music! Try asking me to recommend songs, artists, or playlists. 🎵` });
  }
});

// Gemini Music Search with Google Search grounding
app.post('/api/gemini-search', async (req, res) => {
  const query = (req.body?.query || '').toString().trim();
  if (!query) return res.status(400).json({ error: 'missing_query' });
  
  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: 'missing_api_key', detail: 'Set GEMINI_API_KEY in .env' });
  }

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: `Find music tracks related to: "${query}". Return up to 10 results with titles and artist/source information.`
          }]
        }],
        tools: [{
          googleSearch: {}
        }]
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const groundingMetadata = response.data?.candidates?.[0]?.groundingMetadata;
    if (groundingMetadata && groundingMetadata.groundingChunks) {
      const results = groundingMetadata.groundingChunks
        .filter(chunk => chunk.web)
        .slice(0, 10)
        .map(chunk => ({
          title: chunk.web.title || 'Unknown Track',
          snippet: chunk.web.uri || 'No description',
          uri: chunk.web.uri
        }));
      
      return res.json({ results });
    }

    res.json({ results: [] });
  } catch (err) {
    console.error('Gemini search error:', err.response?.data || err.message);
    res.status(500).json({ error: 'search_failed', detail: err.message });
  }
});

// YouTube search (requires YOUTUBE_API_KEY)
app.get('/api/youtube/search', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.status(400).json({ error: 'missing_query' });
  if (!YT_API_KEY) return res.status(503).json({ error: 'missing_api_key', detail: 'Set YOUTUBE_API_KEY in .env' });
  try {
    // First: search multiple candidates
    const searchResp = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        key: YT_API_KEY,
        part: 'snippet',
        q,
        type: 'video',
        maxResults: 8,
        videoCategoryId: 10, // Music
        safeSearch: 'moderate'
      }
    });
    const items = searchResp.data?.items || [];
    if (!items.length) return res.json({ items: [] });

    // Get details to ensure videos are embeddable
    const ids = items.map(it => it.id?.videoId).filter(Boolean);
    const videosResp = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        key: YT_API_KEY,
        part: 'status,snippet,contentDetails',
        id: ids.join(',')
      }
    });
    const videoMap = new Map();
    for (const v of (videosResp.data?.items || [])) {
      videoMap.set(v.id, v);
    }

    // Filter for embeddable, public videos
    const embeddable = items
      .map(it => {
        const vid = videoMap.get(it.id?.videoId);
        return vid ? { it, vid } : null;
      })
      .filter(x => !!x)
      .filter(({ vid }) => vid.status?.embeddable && vid.status?.privacyStatus === 'public');

    // Prefer titles likely to be the official audio
    const scored = embeddable
      .map(({ it, vid }) => {
        const title = (vid.snippet?.title || it.snippet?.title || '').toLowerCase();
        let score = 0;
        if (title.includes('official audio')) score += 3;
        if (title.includes('lyrics')) score += 1;
        if (title.includes('official video')) score += 1;
        return { it, vid, score };
      })
      .sort((a,b) => b.score - a.score);

    const best = (scored[0]?.vid?.id) || (embeddable[0]?.vid?.id) || ids[0];

    res.json({
      items: items.map(it => ({
        videoId: it.id?.videoId,
        title: it.snippet?.title,
        channelTitle: it.snippet?.channelTitle,
        thumbnails: it.snippet?.thumbnails
      })),
      best: { videoId: best }
    });
  } catch (err) {
    const status = err.response?.status || 500;
    const detail = err.response?.data || err.message;
    console.error('YouTube /api/youtube/search error:', detail);
    res.status(status).json({ error: 'youtube_search_failed', detail: JSON.stringify(detail) });
  }
});

// Jamendo search for full-length Creative Commons tracks
app.get('/api/jamendo/search', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.status(400).json({ error: 'missing_query' });
  if (!JAMENDO_CLIENT_ID) return res.status(503).json({ error: 'missing_client_id', detail: 'Set JAMENDO_CLIENT_ID in .env' });
  try {
    const url = 'https://api.jamendo.com/v3.0/tracks/';
    const resp = await axios.get(url, {
      params: {
        client_id: JAMENDO_CLIENT_ID,
        format: 'json',
        search: q,
        limit: 10,
        include: 'musicinfo',
        audioformat: 'mp31',
        imagesize: 300
      }
    });
    // Map to compact shape
    const results = (resp.data?.results || []).map(it => ({
      title: it.name,
      artist: it.artist_name,
      album: it.album_name,
      duration: it.duration,
      albumArt: it.image,
      audio: it.audio
    }));
    res.json({ items: results });
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ error: 'jamendo_search_failed', detail: err.message });
  }
});

// Audius: full-length tracks without API key (decentralized music)
app.get('/api/audius/search', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.status(400).json({ error: 'missing_query' });
  try {
    const resp = await axios.get(`${AUDIUS_API}/tracks/search`, {
      params: { query: q, limit: 10, app_name: 'MusicLibrary' }
    });
    const items = (resp.data?.data || []).map(t => ({
      id: t.id || t.track_id || t.permalink || '',
      title: t.title || 'Unknown Title',
      artist: t.user?.name || t.user?.handle || 'Unknown Artist',
      duration: t.duration || 0,
      albumArt: (t.artwork?.['1000x1000']) || (t.artwork?.['480x480']) || (t.artwork?.['150x150']) || '',
    }));
    res.json({ items });
  } catch (err) {
    const status = err.response?.status || 500;
    const detail = err.response?.data || err.message;
    console.error('Audius /api/audius/search error:', detail);
    res.status(status).json({ error: 'audius_search_failed', detail: JSON.stringify(detail) });
  }
});

// Proxy Audius stream to avoid CORS issues
app.get('/api/audius/stream', async (req, res) => {
  const id = (req.query.id || '').toString().trim();
  if (!id) return res.status(400).json({ error: 'missing_id' });
  try {
    const url = `${AUDIUS_API}/tracks/${encodeURIComponent(id)}/stream`;
    const response = await axios.get(url, { params: { app_name: 'MusicLibrary' }, responseType: 'stream' });
    res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mpeg');
    response.data.pipe(res);
  } catch (err) {
    const status = err.response?.status || 500;
    const detail = err.response?.data || err.message;
    console.error('Audius /api/audius/stream error:', detail);
    res.status(status).json({ error: 'audius_stream_failed', detail: JSON.stringify(detail) });
  }
});

// Google Books API - Search for music books
app.get('/api/books/search', async (req, res) => {
  const q = (req.query.q || 'music theory').toString().trim();
  if (!GOOGLE_BOOKS_API_KEY) {
    return res.status(503).json({ error: 'missing_api_key', detail: 'Set GOOGLE_BOOKS_API_KEY in .env' });
  }
  try {
    const response = await axios.get('https://www.googleapis.com/books/v1/volumes', {
      params: {
        q: q + ' music',
        key: GOOGLE_BOOKS_API_KEY,
        maxResults: 20,
        orderBy: 'relevance',
        printType: 'books'
      }
    });
    
    const books = (response.data?.items || []).map(item => {
      const volumeInfo = item.volumeInfo || {};
      const saleInfo = item.saleInfo || {};
      
      return {
        id: item.id,
        title: volumeInfo.title || 'Unknown Title',
        authors: volumeInfo.authors || ['Unknown Author'],
        description: volumeInfo.description || 'No description available',
        thumbnail: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || volumeInfo.imageLinks?.smallThumbnail?.replace('http:', 'https:') || '',
        price: saleInfo.listPrice ? `${saleInfo.listPrice.currencyCode} ${saleInfo.listPrice.amount}` : 'Price not available',
        buyLink: saleInfo.buyLink || volumeInfo.infoLink || '',
        rating: volumeInfo.averageRating || 0,
        ratingsCount: volumeInfo.ratingsCount || 0,
        publishedDate: volumeInfo.publishedDate || 'Unknown',
        pageCount: volumeInfo.pageCount || 0
      };
    });
    
    res.json({ books });
  } catch (err) {
    const status = err.response?.status || 500;
    const detail = err.response?.data || err.message;
    console.error('Google Books /api/books/search error:', detail);
    res.status(status).json({ error: 'books_search_failed', detail: JSON.stringify(detail) });
  }
});

// Simple health check (must be before wildcard route)
app.get('/health', (req, res) => res.json({ ok: true, host: HOST, port: PORT }));

// ============ DATABASE API ENDPOINTS ============

// Playlists endpoints
app.get('/api/playlists', async (req, res) => {
  try {
    const playlists = await db.getAllPlaylists();
    // Add song count to each playlist
    const playlistsWithCount = await Promise.all(playlists.map(async p => ({
      ...p,
      song_count: await db.getSongCountInPlaylist(p.id)
    })));
    res.json({ playlists: playlistsWithCount });
  } catch (err) {
    console.error('Error fetching playlists:', err);
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

app.post('/api/playlists', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Playlist name is required' });
    }
    const result = await db.createPlaylist(name, description || '');
    res.json({ success: true, playlist_id: result.lastInsertRowid || result.insertId || null });
  } catch (err) {
    console.error('Error creating playlist:', err);
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

app.get('/api/playlists/:id', async (req, res) => {
  try {
    const playlist = await db.getPlaylistById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    const songs = await db.getPlaylistSongs(req.params.id);
    res.json({ playlist, songs });
  } catch (err) {
    console.error('Error fetching playlist:', err);
    res.status(500).json({ error: 'Failed to fetch playlist' });
  }
});

app.delete('/api/playlists/:id', async (req, res) => {
  try {
    await db.deletePlaylist(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting playlist:', err);
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
});

app.put('/api/playlists/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Playlist name is required' });
    }
    await db.updatePlaylist(req.params.id, name, description || '');
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating playlist:', err);
    res.status(500).json({ error: 'Failed to update playlist' });
  }
});

// Playlist songs endpoints
app.post('/api/playlists/:id/songs', async (req, res) => {
  try {
    const { song_title, song_artist, song_album, song_duration, album_art, preview_url } = req.body;
    if (!song_title || !song_artist) {
      return res.status(400).json({ error: 'Song title and artist are required' });
    }
    await db.addSongToPlaylist(req.params.id, song_title, song_artist, song_album || '', song_duration || '', album_art || '', preview_url || '');
    res.json({ success: true });
  } catch (err) {
    console.error('Error adding song to playlist:', err);
    res.status(500).json({ error: 'Failed to add song to playlist' });
  }
});

app.delete('/api/playlists/songs/:songId', async (req, res) => {
  try {
    await db.removeSongFromPlaylist(req.params.songId);
    res.json({ success: true });
  } catch (err) {
    console.error('Error removing song from playlist:', err);
    res.status(500).json({ error: 'Failed to remove song' });
  }
});

// Favorites endpoints
app.get('/api/favorites', async (req, res) => {
  try {
    const favorites = await db.getAllFavorites();
    res.json({ favorites });
  } catch (err) {
    console.error('Error fetching favorites:', err);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

app.post('/api/favorites', async (req, res) => {
  try {
    const { song_title, song_artist, song_album, song_duration, album_art, preview_url } = req.body;
    if (!song_title || !song_artist) {
      return res.status(400).json({ error: 'Song title and artist are required' });
    }
    await db.addFavorite(song_title, song_artist, song_album || '', song_duration || '', album_art || '', preview_url || '');
    res.json({ success: true });
  } catch (err) {
    console.error('Error adding favorite:', err);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

app.delete('/api/favorites', async (req, res) => {
  try {
    const { song_title, song_artist } = req.body;
    if (!song_title || !song_artist) {
      return res.status(400).json({ error: 'Song title and artist are required' });
    }
    await db.removeFavorite(song_title, song_artist);
    res.json({ success: true });
  } catch (err) {
    console.error('Error removing favorite:', err);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

app.get('/api/favorites/check', async (req, res) => {
  try {
    const { title, artist } = req.query;
    if (!title || !artist) {
      return res.status(400).json({ error: 'Title and artist are required' });
    }
    const favorite = await db.isFavorite(title, artist);
    res.json({ is_favorite: !!favorite });
  } catch (err) {
    console.error('Error checking favorite:', err);
    res.status(500).json({ error: 'Failed to check favorite' });
  }
});

// History endpoints
app.get('/api/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = await db.getHistory(limit);
    res.json({ history });
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Compatibility alias: fetch history by userId (current schema is global history)
app.get('/api/history/:userId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    // Current DB schema does not partition listen_history by user; return global for now
    const history = await db.getHistory(limit);
    res.json({ history, userId: req.params.userId });
  } catch (err) {
    console.error('Error fetching history by user:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.post('/api/history', async (req, res) => {
  try {
    const { song_title, song_artist, song_album, song_duration, album_art, preview_url } = req.body;
    if (!song_title || !song_artist) {
      return res.status(400).json({ error: 'Song title and artist are required' });
    }
    await db.addToHistory(song_title, song_artist, song_album || '', song_duration || '', album_art || '', preview_url || '');
    res.json({ success: true });
  } catch (err) {
    console.error('Error adding to history:', err);
    res.status(500).json({ error: 'Failed to add to history' });
  }
});
// Delete a specific history entry by id
app.delete('/api/history/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    await db.removeHistoryItem(id);
    res.json({ success: true, message: 'Song removed from history' });
  } catch (err) {
    console.error('Error removing history item:', err);
    res.status(500).json({ error: 'Failed to remove history item' });
  }
});

// Clear entire history
app.delete('/api/history', async (req, res) => {
  try {
    await db.clearHistory();
    res.json({ success: true });
  } catch (err) {
    console.error('Error clearing history:', err);
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

// Compatibility alias: clear history by userId (current schema is global history)
app.delete('/api/history/clear/:userId', async (req, res) => {
  try {
    await db.clearHistory();
    res.json({ success: true, userId: req.params.userId });
  } catch (err) {
    console.error('Error clearing history by user:', err);
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

// Ratings endpoints
app.post('/api/ratings', async (req, res) => {
  try {
    const { song_title, song_artist, rating } = req.body;
    if (!song_title || !song_artist || !rating) {
      return res.status(400).json({ error: 'Song title, artist, and rating are required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    await db.addRating(song_title, song_artist, rating);
    res.json({ success: true });
  } catch (err) {
    console.error('Error adding rating:', err);
    res.status(500).json({ error: 'Failed to add rating' });
  }
});

app.get('/api/ratings', async (req, res) => {
  try {
    const { title, artist } = req.query;
    if (title && artist) {
      const result = await db.getRating(title, artist);
      res.json({ rating: result ? result.rating : null });
    } else {
      const ratings = await db.getAllRatings();
      res.json({ ratings });
    }
  } catch (err) {
    console.error('Error fetching ratings:', err);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

// ============ LIKE (Favorites per user) ============
// Toggle like/unlike for a song for a given user
app.post('/api/like', async (req, res) => {
  console.log('Received like request:', req.body);
  try {
    const user_id = (req.body?.user_id || 'guest').toString();
    const action = (req.body?.action || '').toString().toLowerCase();
    const song_title = (req.body?.song_title || '').toString();
    const song_artist = (req.body?.song_artist || '').toString();
    const song_album = (req.body?.song_album || '').toString();
    const song_duration = (req.body?.song_duration || '').toString();
    const album_art = (req.body?.album_art || '').toString();
    const preview_url = (req.body?.preview_url || '').toString();
    
    console.log('Processed request data:', {
      user_id,
      action,
      song_title,
      song_artist,
      song_album
    });

    if (!song_title || !song_artist) {
      return res.status(400).json({ error: 'Song title and artist are required' });
    }

    // Determine current like state
    console.log('Checking if song is already liked');
    const exists = await db.isLikedSong(user_id, song_title, song_artist);
    console.log('Song liked status:', exists);

    let liked = false;
    try {
      if (action === 'like' || (!action && !exists)) {
        console.log('Adding song to liked songs');
        await db.addLikedSong(user_id, song_title, song_artist, song_album, song_duration, album_art, preview_url);
        liked = true;
        console.log('Song successfully added to liked songs');
      } else if (action === 'unlike' || (!action && exists)) {
        console.log('Removing song from liked songs');
        await db.removeLikedSong(user_id, song_title, song_artist);
        liked = false;
        console.log('Song successfully removed from liked songs');
      } else {
        // No change
        liked = !!exists;
        console.log('No change needed - current liked status:', liked);
      }
      
      console.log('Like operation completed:', {
        action: action || (exists ? 'unlike' : 'like'),
        title: song_title,
        artist: song_artist,
        wasLiked: !!exists,
        nowLiked: liked
      });
    } catch (err) {
      console.error('Database operation failed:', err);
      throw err; // Let the error handler deal with it
    }

    res.json({ success: true, liked });
  } catch (err) {
    console.error('Error toggling like:', err);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Get liked songs for a user
app.get('/api/likes', async (req, res) => {
  try {
    const user_id = (req.query.user_id || 'guest').toString();
    const rows = await db.getLikedSongs(user_id);
    res.json({ likes: rows });
  } catch (err) {
    console.error('Error fetching likes:', err);
    res.status(500).json({ error: 'Failed to fetch likes' });
  }
});

// Serve static files (SPA)
const staticDir = __dirname;
app.use(express.static(staticDir));

app.get('*', (req, res, next) => {
  // Only serve index.html for non-API requests
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(staticDir, 'index.html'));
});

// Wait for database to initialize before starting the server
(async () => {
  try {
    await db.waitForInit();
  } catch (err) {
    console.error('❌ Database initialization failed:', err);
    process.exit(1);
  }
  
  const server = app.listen(PORT, HOST, () => {
    const url = `http://${HOST}:${PORT}`;
    console.log(`\n✨ Server is running!`);
    console.log(`🌐 Open your browser and visit: ${url}\n`);
    console.log(`📝 Keep this terminal open to keep the server running!\n`);
    // Auto-open the default browser unless NO_BROWSER is set
    if (!process.env.NO_BROWSER) {
      try {
        const child_process = require('child_process');
        if (process.platform === 'win32') {
          // Windows: use start command
          child_process.exec(`start ${url}`, (err) => { 
            if (err) {
              console.log('Note: Could not auto-open browser:', err.message);
            } else {
              console.log('🌐 Opening browser...');
            }
          });
        } else if (process.platform === 'darwin') {
          // macOS
          child_process.exec(`open "${url}"`);
        } else {
          // Linux
          child_process.exec(`xdg-open "${url}"`);
        }
      } catch (err) {
        // Do not crash the server if opening the browser fails
        console.log('Note: Could not auto-open browser');
      }
    }
  });

  server.on('error', (err) => {
    console.error('❌ Server error:', err);
    process.exit(1);
  });
})().catch(err => {
  console.error('❌ Fatal server startup error:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
});

