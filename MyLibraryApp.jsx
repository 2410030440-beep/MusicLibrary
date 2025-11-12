/*
MyLibraryApp.jsx
Single-file React component (functional, hooks) for Music Library & Album Management
- Tailwind CSS classes assumed present in the host page
- Firestore is used when `window.__firebase_config` is provided
- Firestore collection: artifacts/{__app_id || 'musiclibrary'}/users/{__user_id || 'guest'}/playlists
- Playlist document: { name: string, songs: [{ id: songId, memory: string }] }

Usage notes:
- This file exports a React component `MyLibraryApp` as default.
- To run in a real app, import it into your React app and render <MyLibraryApp />.
- If you want to mount it directly in `index.html` served by this project, you'll need a small build step (e.g. bundler) or load React and ReactDOM from CDN and transpile JSX; that's outside the scope of this single file.

Security: client writes to Firestore require proper rules and auth. This file expects the runtime environment to handle auth (for local/demo use it will write unauthenticated).
*/

import React, { useEffect, useState, useRef } from 'react';

// Your library songs will be fetched from storage
export const LIBRARY_TRACKS = [];

// Utility to format seconds to mm:ss
function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Neon gradient helpers
const neonBtn = 'bg-gradient-to-r from-pink-500 to-purple-700 text-white font-semibold shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-transform rounded-lg px-4 py-2';
const cardGlow = 'shadow-[0_8px_30px_rgba(156,39,176,0.25)] hover:shadow-[0_16px_60px_rgba(156,39,176,0.4)]';

export default function MyLibraryApp({ appId = window.__app_id || 'musiclibrary', userId = window.__user_id || window.__initial_auth_token || 'guest' }) {
  const [albums, setAlbums] = useState([]); // {id, name, songs: [{id,memory}]} 
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddSong, setQuickAddSong] = useState(null);
  const [memoryOpenFor, setMemoryOpenFor] = useState(null); // songId for which memory editor visible
  const firestoreRef = useRef(null);
  const unsubRef = useRef(null);

  // Initialize Firestore dynamically if config present
  useEffect(() => {
    let active = true;
    async function init() {
      try {
        if (!window.__firebase_config) {
          // No Firestore config; fallback to server/localStorage only
          setLoading(false);
          return;
        }
        // dynamic import modular SDK
        const [{ initializeApp }, { getFirestore, collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc, getDoc }] = await Promise.all([
          import('https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js'),
          import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js')
        ]);
        const app = initializeApp(window.__firebase_config);
        const db = getFirestore(app);
        firestoreRef.current = { db, collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc, getDoc };

        // subscribe to realtime collection
        const col = collection(db, `artifacts/${appId}/users/${userId}/playlists`);
        const q = query(col, orderBy('name'));
        const unsub = onSnapshot(q, snap => {
          const list = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
          // ensure songs array shape
          const normalized = list.map(l => ({ id: l.id, name: l.name || 'Untitled', songs: Array.isArray(l.songs) ? l.songs : (l.songIds || []) }));
          setAlbums(normalized);
          setLoading(false);
        }, err => {
          console.warn('Firestore onSnapshot error', err);
          setLoading(false);
        });
        unsubRef.current = unsub;

        // seed starter playlists if empty
        setTimeout(async () => {
          if (!active) return;
          const snap = await (await db).getDocs ? null : null; // noop — keep safe
          // We don't do a blocking seed here because onSnapshot will return current state; if it's empty, let user create albums.
        }, 400);
      } catch (err) {
        console.warn('Firestore not available or failed to init', err);
        setLoading(false);
      }
    }
    init();
    return () => { active = false; if (unsubRef.current) try { unsubRef.current(); } catch {} };
  }, [appId, userId]);

  // Create album (Firestore if available else localStorage fallback)
  async function handleCreateAlbum() {
    const name = (newAlbumName || '').trim();
    if (!name) return;
    setCreating(true);
    try {
      if (firestoreRef.current) {
        await firestoreRef.current.addDoc(firestoreRef.current.collection(firestoreRef.current.db, `artifacts/${appId}/users/${userId}/playlists`), { name, songs: [] });
        setNewAlbumName('');
        setCreating(false);
        return;
      }
      // local fallback
      const raw = localStorage.getItem('ml_albums_v1') || '[]';
      const arr = JSON.parse(raw);
      const id = 'local_' + Date.now();
      arr.push({ id, name, songs: [] });
      localStorage.setItem('ml_albums_v1', JSON.stringify(arr));
      setAlbums(prev => [...prev, { id, name, songs: [] }]);
      setNewAlbumName('');
    } catch (err) {
      console.error(err);
    } finally { setCreating(false); }
  }

  // Add song to album
  async function addSongToAlbum(albumId, songId) {
    try {
      // check Firestore
      if (firestoreRef.current) {
        const { doc, updateDoc, arrayUnion } = firestoreRef.current;
        const dref = doc(firestoreRef.current.db, `artifacts/${appId}/users/${userId}/playlists/${albumId}`);
        // add {id: songId, memory: ''}
        await updateDoc(dref, { songs: arrayUnion({ id: songId, memory: '' }) });
        return true;
      }
      // local fallback
      const raw = localStorage.getItem('ml_albums_v1') || '[]';
      const arr = JSON.parse(raw);
      const idx = arr.findIndex(a => String(a.id) === String(albumId));
      if (idx === -1) return false;
      if (!arr[idx].songs) arr[idx].songs = [];
      if (!arr[idx].songs.some(s => s.id === songId)) arr[idx].songs.push({ id: songId, memory: '' });
      localStorage.setItem('ml_albums_v1', JSON.stringify(arr));
      setAlbums(arr);
      return true;
    } catch (err) { console.error('addSongToAlbum', err); return false; }
  }

  // Remove song from album
  async function removeSongFromAlbum(albumId, songId) {
    try {
      if (firestoreRef.current) {
        const { doc, updateDoc, arrayRemove } = firestoreRef.current;
        const dref = doc(firestoreRef.current.db, `artifacts/${appId}/users/${userId}/playlists/${albumId}`);
        await updateDoc(dref, { songs: arrayRemove({ id: songId, memory: '' }) });
        return true;
      }
      const raw = localStorage.getItem('ml_albums_v1') || '[]';
      const arr = JSON.parse(raw);
      const idx = arr.findIndex(a => String(a.id) === String(albumId));
      if (idx === -1) return false;
      arr[idx].songs = (arr[idx].songs || []).filter(s => s.id !== songId);
      localStorage.setItem('ml_albums_v1', JSON.stringify(arr));
      setAlbums(arr);
      return true;
    } catch (err) { console.error('removeSongFromAlbum', err); return false; }
  }

  // Update memory for song in album
  async function updateSongMemory(albumId, songId, memoryText) {
    try {
      if (firestoreRef.current) {
        // Firestore doesn't offer array item patching easily; read-document then update songs array
        const { doc, getDoc, updateDoc } = firestoreRef.current;
        const dref = doc(firestoreRef.current.db, `artifacts/${appId}/users/${userId}/playlists/${albumId}`);
        const snap = await getDoc(dref);
        if (!snap.exists()) return false;
        const data = snap.data() || {};
        const songs = Array.isArray(data.songs) ? data.songs.slice() : [];
        const idx = songs.findIndex(s => s.id === songId);
        if (idx === -1) return false;
        songs[idx] = { ...songs[idx], memory: memoryText };
        await updateDoc(dref, { songs });
        return true;
      }
      const raw = localStorage.getItem('ml_albums_v1') || '[]';
      const arr = JSON.parse(raw);
      const idx = arr.findIndex(a => String(a.id) === String(albumId));
      if (idx === -1) return false;
      const sidx = (arr[idx].songs||[]).findIndex(s => s.id === songId);
      if (sidx === -1) return false;
      arr[idx].songs[sidx].memory = memoryText;
      localStorage.setItem('ml_albums_v1', JSON.stringify(arr));
      setAlbums(arr);
      return true;
    } catch (err) { console.error('updateSongMemory', err); return false; }
  }

  // Rename album
  async function renameAlbum(albumId, newName) {
    try {
      if (firestoreRef.current) {
        const { doc, updateDoc } = firestoreRef.current;
        const dref = doc(firestoreRef.current.db, `artifacts/${appId}/users/${userId}/playlists/${albumId}`);
        await updateDoc(dref, { name: newName });
        return true;
      }
      const raw = localStorage.getItem('ml_albums_v1') || '[]';
      const arr = JSON.parse(raw);
      const idx = arr.findIndex(a => String(a.id) === String(albumId));
      if (idx === -1) return false;
      arr[idx].name = newName;
      localStorage.setItem('ml_albums_v1', JSON.stringify(arr));
      setAlbums(arr);
      return true;
    } catch (err) { console.error(err); return false; }
  }

  // Delete album
  async function deleteAlbum(albumId) {
    try {
      if (firestoreRef.current) {
        const { doc, deleteDoc } = firestoreRef.current;
        await deleteDoc(doc(firestoreRef.current.db, `artifacts/${appId}/users/${userId}/playlists/${albumId}`));
        return true;
      }
      const raw = localStorage.getItem('ml_albums_v1') || '[]';
      const arr = JSON.parse(raw);
      const updated = arr.filter(a => String(a.id) !== String(albumId));
      localStorage.setItem('ml_albums_v1', JSON.stringify(updated));
      setAlbums(updated);
      return true;
    } catch (err) { console.error(err); return false; }
  }

  // UI render helpers
  function AlbumCard({ a }) {
    // Render album card using the same styles as playlist/radio cards so boxes are larger
    return (
      <div className="playlist-card" onClick={() => setSelectedAlbum(a)}>
        <div className="playlist-cover" style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)' }}></div>
        <h3>{a.name}</h3>
        <p>{(a.songs||[]).length} songs</p>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="btn-primary-sm" onClick={(e)=>{ e.stopPropagation(); setSelectedAlbum(a); }}>Open</button>
          <button className="btn-secondary" onClick={async (e)=>{ e.stopPropagation(); const nm = prompt('Rename album', a.name); if(nm) await renameAlbum(a.id, nm); }}>Rename</button>
          <button className="btn-danger" onClick={async (e)=>{ e.stopPropagation(); if(confirm('Delete album?')) await deleteAlbum(a.id); }}>Delete</button>
        </div>
      </div>
    );
  }

  function SongRow({ song, albumObj }) {
    const [editing, setEditing] = useState(false);
    const [memory, setMemory] = useState(() => {
      if (!albumObj) return '';
      const s = (albumObj.songs||[]).find(x => x.id === song.id);
      return s ? (s.memory || '') : '';
    });
    useEffect(() => { if (!albumObj) return; const s = (albumObj.songs||[]).find(x => x.id === song.id); setMemory(s ? s.memory || '' : ''); }, [albumObj]);
    return (
      <div className="p-3 border-b border-purple-900 flex items-start gap-3">
        <div className="w-12 h-12 rounded-md bg-gradient-to-br from-pink-500 to-purple-700 flex items-center justify-center text-white font-bold">♪</div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-medium">{song.title}</div>
              <div className="text-gray-300 text-sm">{song.artist} • {fmt(song.duration)}</div>
            </div>
            <div className="flex items-center gap-2">
              <button title="Memory" className="p-2 rounded-md bg-black/20 text-white" onClick={() => setMemoryOpenFor(memoryOpenFor === song.id ? null : song.id)}>
                🗒️
              </button>
              <button title="Remove" className="p-2 rounded-md bg-red-600 text-white" onClick={async () => { await removeSongFromAlbum(albumObj.id, song.id); }}>
                ✖️
              </button>
            </div>
          </div>
          {memoryOpenFor === song.id && (
            <div className="mt-3 bg-black/30 p-3 rounded-md">
              <textarea rows={3} value={memory} onChange={e => setMemory(e.target.value)} className="w-full bg-transparent text-white p-2 rounded" />
              <div className="mt-2 flex justify-end gap-2">
                <button className="px-3 py-1 rounded bg-gray-700 text-white" onClick={() => setMemoryOpenFor(null)}>Close</button>
                <button className="px-3 py-1 rounded bg-gradient-to-r from-pink-500 to-purple-700 text-white" onClick={async () => { await updateSongMemory(albumObj.id, song.id, memory); setMemoryOpenFor(null); }}>Save</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#1a1526] min-h-[60vh] text-gray-100">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-white neon-title-shadow">My Library — Albums</h2>
          <div className="mt-4 w-full flex justify-center">
            <div className="w-full max-w-3xl flex gap-3">
              <input
                value={newAlbumName}
                onChange={e => setNewAlbumName(e.target.value)}
                placeholder="New album name"
                className="flex-1 w-full px-3 py-2 rounded bg-black/20 border border-purple-800 text-white"
              />
              <button className={`${neonBtn}`} onClick={handleCreateAlbum} disabled={creating}>{creating ? 'Creating...' : '+ Add Album'}</button>
            </div>
          </div>
        </div>

        <div className="playlist-grid mb-8">
          {albums.length === 0 && !loading ? (
            <div className="p-6 rounded bg-black/30 text-gray-300">No albums yet. Create one using the input above.</div>
          ) : (
            albums.map(a => <AlbumCard key={a.id} a={a} />)
          )}
        </div>

        {selectedAlbum && (
          <div className="mt-6 p-4 rounded-lg bg-[#1b1422] border border-purple-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Album — {selectedAlbum.name}</h3>
              <div className="flex gap-2">
                <button className="px-3 py-1 rounded bg-black/20 text-white" onClick={() => setSelectedAlbum(null)}>Close</button>
              </div>
            </div>
            <div className="space-y-2">
              {(selectedAlbum.songs || []).length === 0 && <div className="text-gray-300">No songs in this album.</div>}
              {(selectedAlbum.songs || []).map(s => {
                const song = { id: s.id, ...s };
                return <SongRow key={s.id} song={song} albumObj={selectedAlbum} />;
              })}
            </div>
          </div>
        )}

        {/* Quick Add Modal */}
        {showQuickAdd && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-md p-6 rounded-lg bg-[#171017] border border-purple-800">
              <h4 className="text-lg font-bold mb-3">Add "{quickAddSong?.title}" to an album</h4>
              <div className="flex flex-col gap-2 max-h-60 overflow-auto mb-4">
                {albums.map(a => (
                  <button key={a.id} className="text-left p-2 rounded bg-black/20 text-white" onClick={async () => { const ok = await addSongToAlbum(a.id, quickAddSong.id); if (ok) { alert(`Added to ${a.name}`); setShowQuickAdd(false); } else alert('Failed'); }}>{a.name} <span className="text-sm text-gray-400">({(a.songs||[]).length})</span></button>
                ))}
                {albums.length === 0 && <div className="text-gray-400">No albums yet — create one above.</div>}
              </div>
              <div className="flex justify-end gap-2">
                <button className="px-3 py-1 rounded bg-gray-700 text-white" onClick={() => setShowQuickAdd(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
