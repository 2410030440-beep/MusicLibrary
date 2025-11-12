# Music Library

A modern, responsive music library web application with search, playlists, history tracking, and AI chat assistance.

## Features

- 🎵 **Music Search** - Search for songs, artists, and playlists
- 📚 **My Library** - Manage your personal music collection
- 🎨 **Playlists** - Create and organize custom playlists
- 📜 **History** - Track your listening history
- 🎨 **Artists** - Browse and discover artists
- 🤖 **AI Chat** - Get music recommendations from AI assistant
- 📱 **Responsive Design** - Works on desktop and mobile

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript (Vanilla JS + React for Library page)
- **Backend:** Node.js with Express
- **Database:** SQLite (local) / MySQL
- **APIs:** YouTube, Spotify (optional), AI chat integration

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/2410030440-beep/MusicLibrary.git
   cd MusicLibrary
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file (optional, for API keys):
   ```env
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   YOUTUBE_API_KEY=your_youtube_api_key
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. Start the server:
   ```bash
   npm run dev
   ```

5. Open your browser to: `http://127.0.0.1:5173`

## Usage

- The server starts automatically on port `5173` (configurable via `PORT` env variable)
- Browser auto-opens when you run `npm run dev`
- All music data is stored locally in SQLite database

## Project Structure

```
MusicLibrary/
├── index.html          # Main app page
├── server.js           # Express server
├── database.js         # Database operations
├── script.js           # Main frontend logic
├── styles.css          # Application styles
├── ml-like.js          # Like/favorite functionality
├── served_script.js    # Player and playlist logic
├── MyLibraryApp.jsx    # React component for Library page
└── tools/              # Database utility scripts
```

## Scripts

- `npm run dev` - Start development server
- `npm start` - Start production server

## License

Personal project - all rights reserved.

## Author

VINNAKOTA CHERISHMA PRIYA
