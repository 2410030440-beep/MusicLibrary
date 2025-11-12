try {
	(function () {
		const $ = (sel, root = document) => root.querySelector(sel);
		const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

		// Seeded local artist data (fallbacks for biography and sample songs)
		const artistSeed = {
			'Lata Mangeshkar': {
				story: 'Lata Mangeshkar (1929–2022) was a legendary Indian playback singer whose mellifluous voice defined generations of film music across multiple languages. Trained in classical music, she sang thousands of songs and was the backbone of many Hindi film soundtracks.',
				songs: [
					{ title: 'Lag Ja Gale', preview_url: '', album_art: '' },
					{ title: 'Aye Mere Watan Ke Logon', preview_url: '', album_art: '' },
					{ title: 'Tere Bina Zindagi Se', preview_url: '', album_art: '' }
				]
			},
			'Neha Kakkar': {
				story: 'Neha Kakkar is a contemporary Indian pop singer known for her energetic Bollywood playback songs and vibrant stage presence. She rose to fame via music reality shows and a string of popular film singles.',
				songs: [ { title: 'Kala Chashma', preview_url: '' }, { title: 'Aankh Maarey', preview_url: '' } ]
			},
			'Whitney Houston': {
				story: 'Whitney Houston (1963–2012) was an American singer and actress with a powerful, emotive voice. She achieved worldwide fame with chart-topping hits and movie appearances, becoming one of the best-selling music artists of all time.',
				songs: [ { title: 'I Will Always Love You', preview_url: '' }, { title: 'Greatest Love of All', preview_url: '' } ]
			},
			'Nusrat Fateh Ali Khan': {
				story: 'Nusrat Fateh Ali Khan (1948–1997) was a Pakistani vocalist, primarily of Qawwali, who brought devotional Sufi music to international audiences. His improvisational style and vocal range influenced many world music collaborations.',
				songs: [ { title: 'Afreen Afreen', preview_url: '' }, { title: 'Allah Hoo', preview_url: '' } ]
			},
			'Kishore Kumar': {
				story: 'Kishore Kumar (1929–1987) was an Indian playback singer, actor, and composer known for his versatility and unique vocal stylings that spanned romantic ballads, comic numbers, and classical-tinged songs.',
				songs: [ { title: 'Mere Sapno Ki Rani', preview_url: '' }, { title: 'Roop Tera Mastana', preview_url: '' } ]
			},
			'Arijit Singh': {
				story: 'Arijit Singh is a modern Bollywood playback singer acclaimed for his soulful and emotive renditions. He rapidly became one of the most sought-after playback voices in Indian cinema.',
				songs: [ { title: 'Tum Hi Ho', preview_url: '' }, { title: 'Channa Mereya', preview_url: '' } ]
			}
		};

		// Minimal safe client script restored from backup. It provides basic
		// navigation, mood chips, and a simple search fallback. Heavy or
		// experimental features are intentionally omitted to keep pages stable.

		function showPage(id) {
			try {
				$$('.page').forEach(p => p.classList.remove('active'));
				const el = document.getElementById('page-' + id);
				if (el) el.classList.add('active');
				$$('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === id));
				// Radio page removed — no snippet population required
			} catch (e) { /* ignore */ }
		}

		function attachNavHandlers() {
			try {
				$$('.nav-link').forEach(link => {
					if (link.__attached) return; link.__attached = true;
					link.addEventListener('click', (e) => { e.preventDefault(); const p = link.dataset.page || 'home'; showPage(p); window.location.hash = p; });
				});
			} catch (e) {}
		}

		if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachNavHandlers);
		else setTimeout(attachNavHandlers, 10);

		// initial activation
		const initial = window.location.hash.slice(1) || 'home';
		setTimeout(() => { try { showPage(initial); } catch (e) {} }, 50);

		// mood chips (safe static mapping)
		const moodQueries = { Happy: 'upbeat happy pop', Sad: 'melancholic ballad', Energetic: 'energetic workout', Chill: 'chill ambient', Focus: 'instrumental study', Party: 'dance pop' };
		const moodEmojis = { Happy: '😊', Sad: '😢', Energetic: '⚡', Chill: '🧊', Focus: '🎧', Party: '🎉' };
		let _lastPageBeforeMood = null;
		const moodBar = document.getElementById('moodBar');
		const moodTracksContainer = document.getElementById('moodTracks');
		async function loadMoodSongs(moodKey){
			if(!moodQueries[moodKey]) return;
			try{
				const q = encodeURIComponent(moodQueries[moodKey]);
				if(moodTracksContainer) moodTracksContainer.innerHTML = `<p style="color:var(--text-muted); padding:12px">Loading ${escapeHtml(moodKey)} tracks…</p>`;
				// inject header (back + selected mood) so user sees which mood is active
				let header = moodTracksContainer.querySelector('.mood-header');
				if(!header){
					header = document.createElement('div'); header.className = 'mood-header';
					header.style.display = 'flex'; header.style.alignItems = 'center'; header.style.justifyContent = 'space-between'; header.style.marginBottom = '12px';
					const left = document.createElement('div'); left.style.display='flex'; left.style.alignItems='center';
					const backBtn = document.createElement('button'); backBtn.className='btn-back'; backBtn.textContent='← Back'; backBtn.style.marginRight='12px';
					backBtn.addEventListener('click', ()=>{
						try{
							// restore previous page and clear mood content
							showPage(_lastPageBeforeMood || 'home');
							// clear active chip
							document.querySelectorAll('.mood-chip').forEach(x=>{ x.classList.remove('active'); x.setAttribute('aria-pressed','false'); });
							if(moodTracksContainer) moodTracksContainer.innerHTML = '';
						}catch(e){ console.warn('mood back failed', e); }
					});
					const title = document.createElement('h2'); title.className='mood-title'; title.style.margin='0'; title.style.fontSize='1.1rem'; title.style.fontWeight='600';
					left.appendChild(backBtn); left.appendChild(title);
					header.appendChild(left);
					moodTracksContainer.appendChild(header);
				}
				// set title to include emoji
				const titleEl = header.querySelector('.mood-title'); if(titleEl) titleEl.textContent = `${moodEmojis[moodKey] ? moodEmojis[moodKey] + ' ' : ''}${moodKey}`;



				const resp = await fetch('https://itunes.apple.com/search?term=' + q + '&entity=song&limit=40');



				if(!resp.ok){ if(moodTracksContainer) moodTracksContainer.innerHTML = `<p style="color:var(--text-muted); padding:12px">Failed to load tracks for ${escapeHtml(moodKey)}.</p>`; return; }
				const data = await resp.json(); const songs = data.results || [];
				if(!songs.length){ if(moodTracksContainer) moodTracksContainer.innerHTML = `<p style="color:var(--text-muted); padding:12px">No tracks found for ${escapeHtml(moodKey)}.</p>`; return; }
				// render list
				if(moodTracksContainer) moodTracksContainer.innerHTML = '';
				// re-attach header after clearing
				if(moodTracksContainer && header) moodTracksContainer.appendChild(header);
				const listWrap = document.createElement('div'); listWrap.className = 'mood-song-list';
				songs.forEach((s, idx)=>{
					const row = document.createElement('div'); row.className = 'song-row';
					row.style.display = 'flex'; row.style.gap = '10px'; row.style.alignItems = 'center'; row.style.marginBottom = '8px'; row.style.cursor = 'pointer';
					row.setAttribute('data-preview', s.previewUrl || s.preview || '');
					const img = document.createElement('div'); img.className = 'song-img'; img.style.width='48px'; img.style.height='48px'; img.style.backgroundSize='cover'; img.style.backgroundPosition='center'; img.style.borderRadius='6px';
					if(s.artworkUrl100) img.style.backgroundImage = `url('${s.artworkUrl100.replace('100x100','300x300')}')`;
					const meta = document.createElement('div'); meta.style.flex='1';
					const t = document.createElement('div'); t.textContent = s.trackName || s.trackCensoredName || 'Unknown'; t.style.fontWeight='600';
					const a = document.createElement('div'); a.textContent = s.artistName || ''; a.style.fontSize='0.9rem'; a.style.color='var(--text-muted)';
					meta.appendChild(t); meta.appendChild(a);
					row.appendChild(img); row.appendChild(meta);
					row.addEventListener('click', (ev)=>{
						ev.preventDefault();
						try{
							const trackObj = { preview_url: s.previewUrl || s.preview || '', song_title: s.trackName || s.trackCensoredName, song_artist: s.artistName || '', album_art: s.artworkUrl100 || '' };
							if(window.setQueue) window.setQueue(songs.map(x=>({ preview_url: x.previewUrl || x.preview || '', song_title: x.trackName || x.trackCensoredName || '', song_artist: x.artistName || '', album_art: x.artworkUrl100 || '' })), idx);
							if(window.playTrack) window.playTrack(trackObj);
						}catch(e){ console.warn('play mood song failed', e); }
					});
					listWrap.appendChild(row);
				});
				if(moodTracksContainer) moodTracksContainer.appendChild(listWrap);
			}catch(e){ console.warn('loadMoodSongs error', e); if(moodTracksContainer) moodTracksContainer.innerHTML = `<p style="color:var(--text-muted); padding:12px">Failed to load tracks.</p>`; }
		}
		if (moodBar) {
			Object.keys(moodQueries).forEach(m => {
				const b = document.createElement('button'); b.type = 'button'; b.className = 'mood-chip';
				b.setAttribute('aria-pressed','false');
				// include emoji visually and for screen-readers
				const emoji = document.createElement('span'); emoji.className = 'mood-emoji'; emoji.textContent = moodEmojis[m] || '';
				emoji.style.marginRight = '8px';
				const label = document.createElement('span'); label.textContent = m;
				b.appendChild(emoji); b.appendChild(label);
				b.addEventListener('click', () => {
					try{
						// remember previous active page (do not mutate URL)
						_lastPageBeforeMood = (document.querySelector('.nav-link.active') && document.querySelector('.nav-link.active').dataset.page) || (window.location.hash.slice(1) || 'home');
						// set active state on chips
						document.querySelectorAll('.mood-chip').forEach(x=>{ x.classList.remove('active'); x.setAttribute('aria-pressed','false'); });
						b.classList.add('active'); b.setAttribute('aria-pressed','true');
						showPage('moods');
						loadMoodSongs(m);
					} catch (e) { console.warn('mood click failed', e); }
				});
				moodBar.appendChild(b);
			});
		}

		// simple search handler using iTunes as a no-auth fallback
		const globalSearchForm = document.getElementById('globalSearchForm');
		const globalSearchInput = document.getElementById('globalSearchInput');
		const globalSearchResults = document.getElementById('globalSearchResults');
			if (globalSearchForm && globalSearchInput && globalSearchResults) {
				globalSearchForm.addEventListener('submit', async (e) => {
					e.preventDefault(); const q = (globalSearchInput.value || '').trim(); if (!q) return; showPage('search'); window.location.hash = 'search';
					globalSearchResults.innerHTML = `<p style="color:var(--text-muted); padding:18px">Searching for ${escapeHtml(q)}…</p>`;
					try {
						const res = await fetch('https://itunes.apple.com/search?term=' + encodeURIComponent(q) + '&entity=song&limit=12');
						if (!res.ok) throw new Error('search failed');
						const data = await res.json(); const items = (data.results || []);
						if (!items.length) { globalSearchResults.innerHTML = `<p style="color:var(--text-muted); padding:18px">No results for ${escapeHtml(q)}</p>`; return; }
						// Include preview URL attribute so the player can use it
						globalSearchResults.innerHTML = items.map(it => {
							const preview = it.previewUrl || it.preview || '';
							const track = escapeHtml(it.trackName||'Unknown');
							const artist = escapeHtml(it.artistName||'Unknown');
							const artwork = it.artworkUrl100 ? String(it.artworkUrl100).replace('100x100','300x300') : '';
							const previewAttr = preview ? ` data-preview="${String(preview).replace(/"/g, '&quot;')}"` : '';
							const artDiv = artwork ? `<div class="search-result-cover" style="background-image:url('${artwork}'); background-size:cover; background-position:center"></div>` : `<div class="search-result-cover" style="background:#2a1f3d"></div>`;
							return `<div class="search-result-item"${previewAttr}>${artDiv}<div class="search-result-info"><h4>${track}</h4><p>${artist}</p></div></div>`;
						}).join('');
					} catch (err) {
						globalSearchResults.innerHTML = `<p style="color:var(--text-muted); padding:18px">Search failed — try again.</p>`;
					}
				});
			}

			// attribute escaper for safety (used above)
			function escapeAttr(s){ try { return String(s||'').replace(/"/g,'&quot;'); } catch(e){ return String(s||''); } }

			// --- Artist biography/detail handlers (restored safely) ---
			function attachArtistHandlers(){
				try{
					// delegate clicks on artist cards
					document.addEventListener('click', async (ev)=>{
						const card = ev.target && ev.target.closest ? ev.target.closest('.artist-card') : null;
						if(!card) return;
						ev.preventDefault();
						const name = card.getAttribute('data-name') || card.dataset.name || (card.querySelector('h3')?.textContent || '').trim();
						if(!name) return;
						// ensure Artists page is visible but don't change browser history/hash
						showPage('artists');
						const detail = document.getElementById('artistDetail');
						const artistName = document.getElementById('artistName');
						const artistStory = document.getElementById('artistStory');
						const discographyList = document.getElementById('discographyList');
						if(!detail || !artistName || !artistStory || !discographyList) return;
						artistName.textContent = name;
						artistStory.textContent = 'Loading biography…';
						// If we have a seeded local biography, use it immediately while remote fetch runs
						const seed = artistSeed[name];
						if(seed && seed.story){
							artistStory.textContent = seed.story;
						}
						// copy image & genre from the clicked card into the detail hero
						try{
							const heroImgEl = detail.querySelector('.artist-hero-img');
							const sourceImg = card.querySelector('.artist-img');
							const genreEl = document.getElementById('artistGenre');
							if(genreEl){ genreEl.textContent = (card.querySelector('p')?.textContent||''); }
							if(heroImgEl){
								if(sourceImg && sourceImg.style && sourceImg.style.backgroundImage){
									heroImgEl.style.backgroundImage = sourceImg.style.backgroundImage;
									heroImgEl.style.backgroundSize = sourceImg.style.backgroundSize || 'cover';
									heroImgEl.style.backgroundPosition = sourceImg.style.backgroundPosition || 'center';
								} else {
									// fallback gradient if no image available
									heroImgEl.style.background = 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)';
									heroImgEl.style.backgroundSize = 'cover';
									heroImgEl.style.backgroundPosition = 'center';
								}
							}
						}catch(e){ /* non-fatal */ }
						discographyList.innerHTML = '<p style="color:var(--text-muted)">Loading discography…</p>';
						detail.style.display = '';
						// hide the artist grid so the detail pane appears in-place
						const grid = document.getElementById('artistGrid'); if(grid) grid.style.display = 'none';
						// fetch a short bio from Wikipedia REST summary (best-effort)
						(async function fetchBio(){
							try{
								const wikiTitle = encodeURIComponent(name.replace(/ /g,'_'));
								const wresp = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + wikiTitle);
								if(wresp.ok){
									const jd = await wresp.json();
									if(jd && jd.extract){ artistStory.textContent = jd.extract; }
									else artistStory.textContent = 'Biography not available.';
								} else {
									artistStory.textContent = 'Biography not available.';
								}
							}catch(e){ artistStory.textContent = 'Biography not available.'; }
						})();

						// fetch songs from iTunes so we can play previews directly in the left player
						(async function fetchSongs(){
							try{
								const q = encodeURIComponent(name);
								const resp = await fetch('https://itunes.apple.com/search?term=' + q + '&entity=song&limit=50');
								if(!resp.ok){ discographyList.innerHTML = '<p style="color:var(--text-muted)">No songs found.</p>'; return; }
								const data = await resp.json(); const songs = (data.results||[]);
								// If remote returned nothing but we have seeded sample songs, use them
								if((!songs || songs.length===0) && seed && seed.songs && seed.songs.length){
									// render seeded songs
									discographyList.innerHTML = '';
									seed.songs.forEach(s=>{
										const row = document.createElement('div'); row.className = 'song-row';
										row.style.display = 'flex'; row.style.gap = '10px'; row.style.alignItems = 'center'; row.style.marginBottom = '8px'; row.style.cursor = 'pointer';
										row.setAttribute('data-preview', s.preview_url || '');
										const img = document.createElement('div'); img.className = 'song-img'; img.style.width='48px'; img.style.height='48px'; img.style.backgroundSize='cover'; img.style.backgroundPosition='center'; img.style.borderRadius='6px';
										if(s.album_art) img.style.backgroundImage = `url('${s.album_art}')`;
										const meta = document.createElement('div'); meta.style.flex='1';
										const t = document.createElement('div'); t.textContent = s.title || 'Unknown'; t.style.fontWeight='600';
										const a = document.createElement('div'); a.textContent = s.artist || (name||''); a.style.fontSize='0.9rem'; a.style.color='var(--text-muted)';
										meta.appendChild(t); meta.appendChild(a);
										row.appendChild(img); row.appendChild(meta);
										row.addEventListener('click', (ev)=>{
											ev.preventDefault();
											const trackObj = { preview_url: s.preview_url || '', song_title: s.title || '', song_artist: s.artist || name, album_art: s.album_art || '' };
											try{ if(window.setQueue) window.setQueue(seed.songs.map(x=>({ preview_url: x.preview_url||'', song_title: x.title||'', song_artist: x.artist||name })), seed.songs.indexOf(s)); if(window.playTrack) window.playTrack(trackObj); }catch(e){ console.warn('play seeded song failed', e); }
										});
										discographyList.appendChild(row);
									});
									return;
								}
								if(!songs.length){ discographyList.innerHTML = '<p style="color:var(--text-muted)">No songs found.</p>'; return; }
								// render simple song list with clickable rows that play in left player
								discographyList.innerHTML = '';
								songs.forEach(s=>{
									const row = document.createElement('div'); row.className = 'song-row';
									row.style.display = 'flex'; row.style.gap = '10px'; row.style.alignItems = 'center'; row.style.marginBottom = '8px'; row.style.cursor = 'pointer';
									row.setAttribute('data-preview', s.previewUrl || s.previewUrl30 || s.preview || '');
									const img = document.createElement('div'); img.className = 'song-img'; img.style.width='48px'; img.style.height='48px'; img.style.backgroundSize='cover'; img.style.backgroundPosition='center'; img.style.borderRadius='6px';
									if(s.artworkUrl100) img.style.backgroundImage = `url('${s.artworkUrl100.replace('100x100','300x300')}')`;
									const meta = document.createElement('div'); meta.style.flex='1';
									const t = document.createElement('div'); t.textContent = s.trackName || s.trackCensoredName || 'Unknown'; t.style.fontWeight='600';
									const a = document.createElement('div'); a.textContent = s.artistName || ''; a.style.fontSize='0.9rem'; a.style.color='var(--text-muted)';
									meta.appendChild(t); meta.appendChild(a);
									row.appendChild(img); row.appendChild(meta);
									// click plays the preview via global player API (served_script.js)
									row.addEventListener('click', (ev)=>{
										ev.preventDefault();
										const preview = row.getAttribute('data-preview');
										const trackObj = { preview_url: preview, song_title: s.trackName || s.trackCensoredName, song_artist: s.artistName || '', album_art: s.artworkUrl100 || '' };
										try{
											if(window.setQueue) window.setQueue(songs.map(x=>({ preview_url: x.previewUrl || x.preview || '', song_title: x.trackName || x.trackCensoredName, song_artist: x.artistName || '', album_art: x.artworkUrl100 || '', id: x.trackId })), songs.indexOf(s));
											if(window.playTrack) window.playTrack(trackObj);
											else console.warn('Player API not ready');
										}catch(e){ console.warn('play song failed', e); }
									});
									discographyList.appendChild(row);
								});
							}catch(e){ discographyList.innerHTML = '<p style="color:var(--text-muted)">Failed to load songs.</p>'; }
						})();
					});
					// back button hides detail and reveals the artist grid again
					const back = document.getElementById('backToArtists'); if(back){ back.addEventListener('click', (e)=>{ e.preventDefault(); const detailEl = document.getElementById('artistDetail'); if(detailEl) detailEl.style.display='none'; const gridEl = document.getElementById('artistGrid'); if(gridEl) gridEl.style.display = ''; }); }
				}catch(e){ console.warn('attachArtistHandlers failed', e); }
			}

			// attach on DOM ready
			if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachArtistHandlers); else setTimeout(attachArtistHandlers, 50);

			// Delegate clicks on global search results so previews play in the left player
			document.addEventListener('click', (ev)=>{
				const item = ev.target && ev.target.closest ? ev.target.closest('.search-result-item') : null;
				if(!item) return;
				ev.preventDefault();
				const preview = item.getAttribute('data-preview') || '';
				const title = item.querySelector('h4') ? item.querySelector('h4').textContent : '';
				const artist = item.querySelector('p') ? item.querySelector('p').textContent : '';
				// try to extract artwork from the cover element (inline background-image) when present
				let albumArt = '';
				const coverEl = item.querySelector('.search-result-cover');
				if(coverEl){
					const bg = coverEl.style && coverEl.style.backgroundImage ? coverEl.style.backgroundImage : '';
					if(bg){
						const m = bg.match(/url\(["']?(.*?)["']?\)/);
						if(m && m[1]) albumArt = m[1];
					}
				}
				const trackObj = { preview_url: preview, song_title: title, song_artist: artist, album_art: albumArt };
				try{
					// If multiple results in the container, build a queue using sibling items
					const container = item.parentElement;
					let queue = [];
					if(container){
						queue = Array.from(container.querySelectorAll('.search-result-item')).map(el=>({ preview_url: el.getAttribute('data-preview')||'', song_title: el.querySelector('h4')?.textContent||'', song_artist: el.querySelector('p')?.textContent||'' }));
					}
					const idx = queue.findIndex(q=>q.song_title === title && q.song_artist === artist);
					if(window.setQueue && queue.length) window.setQueue(queue, Math.max(0, idx));
					if(window.playTrack) window.playTrack(trackObj);
				}catch(e){ console.warn('play search item failed', e); }
			});

		// small helpers
		function escapeHtml(s){ try { return String(s==null?'':s).replace(/[&<>\"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); } catch(e){ return String(s); } }

		// expose a quick verify for debugging
		window._quickVerify = function(){ try { return { ready: document.readyState, hash: window.location.hash, moods: Object.keys(moodQueries).length }; } catch(e){ return { error: String(e) }; } };

	})();
} catch (err) { try { console.error('script.js restore error', err); } catch(e) {} }
