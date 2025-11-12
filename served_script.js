// served_script.js - Minimal safe version
;(function(){
  'use strict';
  
  console.log('[served_script.js] Loaded - restoring interactive features');

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from((root||document).querySelectorAll(sel));

  // --- Simple audio player (preview-only) ---
  const audio = document.createElement('audio');
  audio.preload = 'metadata';
  audio.crossOrigin = 'anonymous';
  let currentQueue = [];
  let currentIndex = 0;

  function setNowPlayingMeta(track){
    try{
      const titleEl = document.getElementById('trackTitle');
      const artistEl = document.getElementById('trackArtist');
      const albumEl = document.getElementById('trackAlbum');
      const artEl = document.getElementById('albumArt');
      if(titleEl) titleEl.textContent = track.song_title || track.title || 'Unknown';
      if(artistEl) artistEl.textContent = track.song_artist || track.artist || '';
      if(albumEl) albumEl.textContent = track.song_album || track.album || '';
      if(artEl && track.album_art) artEl.style.backgroundImage = `url('${track.album_art}')`;
      // Reveal player placeholder -> hide when a track is loaded
      const placeholder = document.getElementById('playerPlaceholder');
      if(placeholder) placeholder.style.display = 'none';
      // Make sure the left-player is visible and interactive
      document.body.classList.remove('no-player');
      const left = document.querySelector('.left-player');
      if(left){ left.style.pointerEvents = 'auto'; left.style.zIndex = 30; }
    }catch(e){console.error('setNowPlayingMeta',e);} 
  }

  function playTrack(track){
    if(!track) return;
    const url = track.preview_url || track.preview || track.audio || '';
    if(!url) { console.warn('No preview URL for track', track); return; }
    console.debug('[served_script] playTrack called for', track.song_title || track.title || track);
    if(audio.src !== url) audio.src = url;
    audio.play().catch(e=>console.warn('Audio play failed', e));
    setNowPlayingMeta(track);
    // Record played track into local history (non-blocking, defensive)
    try{
      (function recordHistory(t){
        try{
          if(!t) return;
          const maxLen = 200;
          const key = 'ml_history_v1';
          const raw = localStorage.getItem(key) || '[]';
          let arr = [];
          try{ arr = JSON.parse(raw) || []; }catch(_){ arr = []; }
          // Construct entry (minimal, deterministic fields)
          const entry = {
            id: t.id || t.song_id || t.preview_url || t.preview || (t.song_title||t.title||'') + '|' + (t.song_artist||t.artist||''),
            title: t.song_title || t.title || '',
            artist: t.song_artist || t.artist || '',
            album: t.song_album || t.album || '',
            album_art: t.album_art || t.cover || '',
            timestamp: Date.now(),
            source: 'player'
          };
          // Remove any existing entry with same id to keep it fresh
          arr = arr.filter(it => String(it.id) !== String(entry.id));
          // Add to front
          arr.unshift(entry);
          // Trim
          if(arr.length > maxLen) arr.length = maxLen;
          try{ localStorage.setItem(key, JSON.stringify(arr)); }catch(e){ /* ignore storage failures */ }
          // Dispatch an event so history UI can react if open
          try{ document.dispatchEvent(new CustomEvent('historyUpdated', { detail: { entry } })); }catch(_){}
        }catch(err){ console.warn('recordHistory inner failed', err); }
      })(track);
    }catch(err){ console.warn('recordHistory failed', err); }
    document.body.classList.add('playing');
  }

  function setQueue(queue, idx=0){
    currentQueue = queue || [];
    currentIndex = idx || 0;
    if(currentQueue.length && currentQueue[currentIndex]) playTrack(currentQueue[currentIndex]);
  }

  audio.addEventListener('ended', ()=>{
    currentIndex = (currentIndex + 1) % Math.max(1, currentQueue.length);
    if(currentQueue.length) playTrack(currentQueue[currentIndex]);
  });

  // Update progress UI
  const progressFill = document.getElementById('progressFill');
  const currentTimeEl = document.getElementById('currentTime');
  const totalTimeEl = document.getElementById('totalTime');
  audio.addEventListener('timeupdate', ()=>{
    try{
      if(currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
      if(totalTimeEl && audio.duration && isFinite(audio.duration)) totalTimeEl.textContent = formatTime(audio.duration);
      if(progressFill && audio.duration && isFinite(audio.duration)){
        const pct = (audio.currentTime / audio.duration) * 100;
        progressFill.style.width = pct + '%';
      }
    }catch(e){ /* silent */ }
  });

  audio.addEventListener('loadedmetadata', ()=>{
    try{ if(totalTimeEl && audio.duration && isFinite(audio.duration)) totalTimeEl.textContent = formatTime(audio.duration); }catch(e){}
  });

  function formatTime(sec){
    if(!sec || !isFinite(sec)) return '0:00';
    const s = Math.floor(sec % 60); const m = Math.floor(sec/60);
    return `${m}:${s.toString().padStart(2,'0')}`;
  }

  // Wire player controls (prev/play/next)
  try{
    const playBtn = document.querySelector('.play-pause');
    const prevBtn = document.querySelector('.prev');
    const nextBtn = document.querySelector('.next');
    if(playBtn){
      // handle both click and pointer events so clicks on inner SVGs register reliably
      const togglePlay = (e)=>{ try{ console.debug('[served_script] togglePlay handler', e && e.type, 'target=', e && e.target); e && e.preventDefault(); if(audio.paused){ audio.play().catch((err)=>{ console.warn('[served_script] audio.play error', err); }); playBtn.setAttribute('aria-pressed','true'); } else { audio.pause(); playBtn.setAttribute('aria-pressed','false'); } }catch(err){ console.warn('[served_script] togglePlay err', err); } };
      playBtn.addEventListener('click', togglePlay);
      playBtn.addEventListener('pointerdown', (ev)=>{ try{ ev.preventDefault(); togglePlay(ev); }catch(_){} });
      // ensure control is interactive even if children steal events
      playBtn.style.pointerEvents = 'auto';
      playBtn.style.zIndex = 10001;
    }
    // explicit pause handler on double/tap to ensure UI toggles
    // (keeps state in sync if other scripts modify playback)
    try{
      if(playBtn){ playBtn.addEventListener('dblclick', (e)=>{ e.preventDefault(); try{ audio.pause(); }catch(_){} }); }
    }catch(_){}
    if(prevBtn){
      const onPrev = (e)=>{ try{ console.debug('[served_script] prev handler', e && e.type, 'target=', e && e.target); e && e.preventDefault(); if(currentQueue.length){ currentIndex = Math.max(0, currentIndex-1); playTrack(currentQueue[currentIndex]); } }catch(err){ console.warn('prev err', err); } };
      prevBtn.addEventListener('click', onPrev);
      prevBtn.addEventListener('pointerdown', (ev)=>{ try{ ev.preventDefault(); onPrev(ev); }catch(_){} });
      prevBtn.style.pointerEvents = 'auto'; prevBtn.style.zIndex = 10001;
    }
    if(nextBtn){
      const onNext = (e)=>{ try{ console.debug('[served_script] next handler', e && e.type, 'target=', e && e.target); e && e.preventDefault(); if(currentQueue.length){ currentIndex = Math.min(currentQueue.length-1, currentIndex+1); playTrack(currentQueue[currentIndex]); } }catch(err){ console.warn('next err', err); } };
      nextBtn.addEventListener('click', onNext);
      nextBtn.addEventListener('pointerdown', (ev)=>{ try{ ev.preventDefault(); onNext(ev); }catch(_){} });
      nextBtn.style.pointerEvents = 'auto'; nextBtn.style.zIndex = 10001;
    }
  }catch(e){ console.warn('player control wiring failed', e); }

  // Robust delegation: handle clicks that land on inner SVGs or child elements
  try{
    document.addEventListener('click', (e)=>{
      const p = e.target.closest ? e.target.closest('.play-pause') : null;
      const pr = e.target.closest ? e.target.closest('.prev') : null;
      const nx = e.target.closest ? e.target.closest('.next') : null;
      if(p){ console.debug('[served_script] document click -> play-pause', e.target); e.preventDefault(); try{ if(audio.paused) audio.play().catch(()=>{}); else audio.pause(); }catch(_){} }
      if(pr){ console.debug('[served_script] document click -> prev', e.target); e.preventDefault(); if(currentQueue.length){ currentIndex = Math.max(0, currentIndex-1); playTrack(currentQueue[currentIndex]); } }
      if(nx){ console.debug('[served_script] document click -> next', e.target); e.preventDefault(); if(currentQueue.length){ currentIndex = Math.min(currentQueue.length-1, currentIndex+1); playTrack(currentQueue[currentIndex]); } }
    }, { capture: true });

    // Also listen for pointerdown at document level to catch some browsers/inputs
    document.addEventListener('pointerdown', (e)=>{
      const p = e.target.closest ? e.target.closest('.play-pause') : null;
      const pr = e.target.closest ? e.target.closest('.prev') : null;
      const nx = e.target.closest ? e.target.closest('.next') : null;
      if(p){ console.debug('[served_script] pointerdown -> play-pause', e.target); try{ if(audio.paused) audio.play().catch(()=>{}); else audio.pause(); }catch(_){} }
      if(pr){ console.debug('[served_script] pointerdown -> prev', e.target); if(currentQueue.length){ currentIndex = Math.max(0, currentIndex-1); playTrack(currentQueue[currentIndex]); } }
      if(nx){ console.debug('[served_script] pointerdown -> next', e.target); if(currentQueue.length){ currentIndex = Math.min(currentQueue.length-1, currentIndex+1); playTrack(currentQueue[currentIndex]); } }
    }, { capture: true });

    // Reflect play/pause state on the control (in case other scripts toggle playback)
    audio.addEventListener('play', ()=>{
      const pb = document.querySelector('.play-pause'); if(pb) pb.setAttribute('aria-pressed','true');
      document.body.classList.add('playing');
    });
    audio.addEventListener('pause', ()=>{
      const pb = document.querySelector('.play-pause'); if(pb) pb.setAttribute('aria-pressed','false');
      document.body.classList.remove('playing');
    });

    // extra debug: log play/pause and volume changes
    audio.addEventListener('play', ()=>{ console.debug('[served_script] audio event: play, src=', audio.src); });
    audio.addEventListener('pause', ()=>{ console.debug('[served_script] audio event: pause, currentTime=', audio.currentTime); });
    audio.addEventListener('volumechange', ()=>{ console.debug('[served_script] audio event: volumechange, volume=', audio.volume); });
  }catch(e){ console.warn('delegated player wiring failed', e); }

  // Volume slider
  try{
    const vol = document.getElementById('volumeSlider');
    if(vol){ 
      const setVol = (e)=>{ try{ const v = Number(e.target ? e.target.value : e); const normalized = Math.max(0, Math.min(1, (v/100)||v)); audio.volume = normalized; console.debug('[served_script] set volume to', audio.volume); }catch(err){console.warn('volume set err', err);} };
  vol.addEventListener('input', setVol);
  vol.addEventListener('change', setVol);
  vol.addEventListener('pointerdown', (e)=>{ try{ e.stopPropagation(); }catch(_){} });
  vol.addEventListener('pointerup', (e)=>{ try{ e.stopPropagation(); }catch(_){} });
      // ensure initial sync: if slider exists use its value, otherwise default to 0.8
      if(vol.value !== undefined) setVol(vol); else audio.volume = 0.8;
    } else {
      audio.volume = 0.8;
    }
  }catch(e){ }

  // Close player button (explicit)
  try{
    const closeBtn = document.getElementById('playerClose');
    if(closeBtn){
      closeBtn.addEventListener('click', (e)=>{ try{ e.preventDefault(); document.body.classList.add('no-player'); document.querySelector('.left-player')?.classList.add('hidden'); console.debug('[served_script] playerClose clicked'); }catch(err){ console.warn('playerClose err', err); } });
      closeBtn.addEventListener('pointerdown', (e)=>{ try{ e.preventDefault(); document.body.classList.add('no-player'); document.querySelector('.left-player')?.classList.add('hidden'); console.debug('[served_script] playerClose pointerdown'); }catch(err){} });
      closeBtn.style.pointerEvents = 'auto'; closeBtn.style.zIndex = 10002;
    }
  }catch(err){ console.warn('attach closeBtn failed', err); }

  // expose small API for other scripts
  window.playTrack = playTrack;
  window.setQueue = setQueue;

  // Expose simple control helpers for external use / fallback UI
  window.mlControls = {
    togglePlay: ()=>{ try{ if(audio.paused) audio.play().catch(()=>{}); else audio.pause(); }catch(e){console.warn('mlControls.togglePlay',e);} },
    prev: ()=>{ try{ if(currentQueue.length){ currentIndex = Math.max(0, currentIndex-1); playTrack(currentQueue[currentIndex]); } }catch(e){console.warn('mlControls.prev',e);} },
    next: ()=>{ try{ if(currentQueue.length){ currentIndex = Math.min(currentQueue.length-1, currentIndex+1); playTrack(currentQueue[currentIndex]); } }catch(e){console.warn('mlControls.next',e);} }
  };

  // NOTE: fallback DOM controls removed — keep `window.mlControls` API available

  // --- Playlist rendering & click handlers ---
  async function loadAndRenderPlaylist(playlistId){
    const container = document.getElementById('playlistTracks');
    if(!container) return;
    container.innerHTML = '<p style="color:var(--text-muted)">Loading tracks...</p>';
    try{
      const resp = await fetch(`/api/playlists/${encodeURIComponent(playlistId)}`);
      if(!resp.ok) throw new Error('playlist fetch failed');
      const data = await resp.json();
      const songs = data.songs || [];
      if(!songs.length){ container.innerHTML = '<p style="color:var(--text-muted)">No tracks available for this playlist.</p>'; return; }
      // Render as album-like cards with a Load more button (safe, incremental)
      // Show playlist title above the album grid and optionally filter songs
      const PAGE_SIZE = 20; // initial page size
      let shown = 0;

      // Determine playlist metadata from DOM or server data
      const cardEl = document.querySelector(`.playlist-card[data-playlist-id="${playlistId}"]`);
      const playlistTitle = (cardEl && (cardEl.querySelector('h3')?.textContent || cardEl.getAttribute('data-name'))) || (data.name || `Playlist ${playlistId}`);
      const playlistQuery = (cardEl && (cardEl.getAttribute('data-query') || '')) || (data.query || '');

      // Improved Bollywood/Hindi filtering
      // - Strong match: Devanagari script OR well-known Bollywood artist OR strong keywords
      // - Relaxed match: common Hindi words used in song titles (ye, hai, dil, pyar, deewani, etc.)
      // If the playlist indicates 'hindi'/'bollywood' then prefer strong matches; if none found, try relaxed; if still none, show note and fall back to full list.

      const strongArtistNames = [
        'arijit', 'lata', 'kishore', 'rahman', 'sonu', 'shreya', 'kumar', 'mohammad', 'mukesh', 'udit', 'alka', 'neha', 'kakkar', 'mika', 'adnan', 'atif', 'bombay', 'ilayaraja', 'ravi', 'ajay'
      ];
      const strongKeywords = ['bollywood','playback','film','soundtrack','filmi','movie','film song','bollywood soundtrack','hindi'];
      const relaxedWords = ['ye','hai','kaa','ki','ke','tum','dil','jaan','pyaar','pyar','mohabbat','deewani','deewana','tera','mera','sajan','sajna','aaja','chale','chal','dil','nahi','zindagi','jeena','jeet','hum','main','uss'];

      function hasDevanagari(text){
        if(!text) return false;
        return /[\u0900-\u097F]/.test(text);
      }

      function strongMatch(text){
        if(!text) return false;
        const t = text.toLowerCase();
        if(hasDevanagari(t)) return true;
        if(strongKeywords.some(k => t.includes(k))) return true;
        if(strongArtistNames.some(a => t.includes(a))) return true;
        return false;
      }

      function relaxedMatch(text){
        if(!text) return false;
        const t = text.toLowerCase();
        return relaxedWords.some(w => t.includes(` ${w}`) || t.startsWith(`${w} `) || t.includes(`${w}-`) || t.includes(`${w}'`));
      }

      let filteredSongs = songs;
      if(/hindi|bollywood/i.test(playlistQuery) || /hindi|bollywood/i.test(playlistTitle)){
        try{
          // Strong pass
          const strong = songs.filter(s => {
            const combined = [s.song_title, s.song_artist, s.song_album].filter(Boolean).join(' ');
            return strongMatch(combined);
          });
          if(strong && strong.length > 0){
            filteredSongs = strong;
          } else {
            // Relaxed pass
            const relaxed = songs.filter(s => {
              const combined = [s.song_title, s.song_artist, s.song_album].filter(Boolean).join(' ');
              return relaxedMatch(combined);
            });
            if(relaxed && relaxed.length > 0){ filteredSongs = relaxed; }
            else {
              // final fallback: keep full list but remember we had no matches
              filteredSongs = songs; // keep for stability
              container.dataset.bollywoodFallback = 'true';
            }
          }
        }catch(e){ console.warn('bollywood filter failed', e); filteredSongs = songs; }
      }

      // Header: display playlist title in a prominent font (uses existing CSS neon-title-shadow)
      const header = document.createElement('div');
      header.style.marginBottom = '12px';
      const h2 = document.createElement('h2'); h2.className = 'neon-title-shadow'; h2.textContent = playlistTitle;
      header.appendChild(h2);
      // optional subtitle when filtered
      if(filteredSongs.length !== songs.length){
        const note = document.createElement('div'); note.style.color = 'var(--text-muted)'; note.style.fontSize = '0.95rem'; note.style.marginTop = '6px'; note.textContent = 'Showing Bollywood/Hindi tracks (filtered)';
        header.appendChild(note);
      }
      // replace container contents and append header
      container.innerHTML = '';
      container.appendChild(header);

      function renderChunk(start, count){
        const wrap = container.querySelector('.playlist-track-grid') || document.createElement('div');
        wrap.className = 'playlist-track-grid';
        // If newly created, append after header
        if(!container.querySelector('.playlist-track-grid')){
          container.appendChild(wrap);
        }
        const end = Math.min(start + count, filteredSongs.length);
        for(let i=start;i<end;i++){
          const s = filteredSongs[i];
          const card = document.createElement('div');
          card.className = 'album-card';
          card.style.padding = '12px';
          card.style.display = 'flex';
          card.style.flexDirection = 'column';
          card.style.gap = '8px';

          const cover = document.createElement('div');
          cover.className = 'album-cover';
          if(s.album_art) cover.style.backgroundImage = `url('${s.album_art}')`;
          cover.style.backgroundSize = 'cover';
          cover.style.backgroundPosition = 'center';

          const info = document.createElement('div');
          info.className = 'flex-1';
          const title = document.createElement('div'); title.className = 'song-title'; title.textContent = s.song_title || s.title || 'Unknown';
          const artist = document.createElement('div'); artist.className = 'song-artist'; artist.textContent = s.song_artist || s.artist || '';
          info.appendChild(title); info.appendChild(artist);

          // Clicking a card plays the preview and sets the queue (index lookup in filteredSongs)
          card.addEventListener('click', (e)=>{ e.stopPropagation(); playTrack(s); setQueue(filteredSongs, i); });

          card.appendChild(cover);
          card.appendChild(info);
          wrap.appendChild(card);
        }
        shown = end;
      }

      // initial render
      renderChunk(0, PAGE_SIZE);

      // Add load more button if needed
      let loadBtn = container.querySelector('.playlist-load-more');
      if(filteredSongs.length > shown){
        if(!loadBtn){
          loadBtn = document.createElement('button');
          loadBtn.className = 'playlist-load-more';
          loadBtn.textContent = 'Load more tracks';
          loadBtn.style.display = 'block';
          loadBtn.style.marginTop = '18px';
          loadBtn.addEventListener('click', (ev)=>{
            ev.preventDefault();
            renderChunk(shown, PAGE_SIZE);
            if(shown >= filteredSongs.length){ loadBtn.remove(); }
          });
          container.appendChild(loadBtn);
        }
      } else {
        if(loadBtn) loadBtn.remove();
      }
    }catch(err){ console.error('loadAndRenderPlaylist', err); container.innerHTML = '<p style="color:crimson">Failed to load tracks</p>'; }
  }

  function attachPlaylistCardHandlers(){
    document.addEventListener('click', (e)=>{
      const card = e.target.closest && e.target.closest('.playlist-card');
      if(!card) return;
      const pid = card.dataset.playlistId || card.getAttribute('data-playlist-id');
      if(pid){
        // show playlist page
        const target = document.getElementById('page-playlists'); if(target){ getPages().forEach(p=>p.classList.remove('active')); target.classList.add('active'); }
        loadAndRenderPlaylist(pid);
      }
    });
  }

  // Radio page and snippet rendering removed — radio UI handled via playlist pages now

  function getPages(){ return Array.from(document.querySelectorAll('.page')); }

  // --- AI Chat box wiring ---
  function attachChat(){
    const trigger = document.getElementById('chatTrigger'); const chatBox = document.getElementById('chatBox'); const closeBtn = document.getElementById('chatClose'); const form = document.getElementById('chatForm'); const messages = document.getElementById('chatMessages'); const status = document.getElementById('chatStatus');
    if(trigger && chatBox){ trigger.addEventListener('click', ()=>{ const open = chatBox.classList.toggle('open'); trigger.setAttribute('aria-expanded', open ? 'true' : 'false'); }); }
    if(closeBtn && chatBox){ closeBtn.addEventListener('click', ()=> chatBox.classList.remove('open')); }
    if(form && messages){
      form.addEventListener('submit', async (e)=>{
        e.preventDefault(); const input = document.getElementById('chatText'); const q = (input?.value||'').trim(); if(!q) return; 
        // append user message
        const userDiv = document.createElement('div'); userDiv.className='msg user'; userDiv.textContent = q; messages.appendChild(userDiv); input.value=''; messages.scrollTop = messages.scrollHeight;
        try{
          status.textContent = 'Thinking...';
          const r = await fetch('/api/chat/ask', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ message: q }) });
          const jd = await r.json();
          const aiDiv = document.createElement('div'); aiDiv.className='msg ai'; aiDiv.textContent = jd.reply || jd?.message || 'Sorry, no reply'; messages.appendChild(aiDiv);
        }catch(err){ const aiDiv = document.createElement('div'); aiDiv.className='msg ai'; aiDiv.textContent = 'Chat failed. Try again later.'; messages.appendChild(aiDiv); }
        status.textContent = '';
        messages.scrollTop = messages.scrollHeight;
      });
    }
  }

  // initialize
  function init(){
    try{
      attachPlaylistCardHandlers();
      attachChat();
      
      console.log('[served_script.js] Interactive features attached');
    }catch(e){ console.error('[served_script.js] init error', e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
