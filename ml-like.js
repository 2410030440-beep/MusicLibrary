// Safe Like button with Modal for adding tracks to albums
(function(){
	'use strict';

	function buildModal(){
		// Don't create modal - we'll use React's QuickAddModal instead
		return;
	}

	function makeLikeButtonFor(item){
	// If item already has a namespaced ml-like button or an existing legacy btn-like,
	// or if the item is part of the Library page, skip adding another like control
	// to avoid duplicate hearts in the UI and to keep My Library clean.
	if (!item) return;
	if (item.querySelector('.ml-like') || item.querySelector('.btn-like')) return;
	if (item.closest && item.closest('#page-library')) return;
	// Also avoid adding like buttons to New Releases on the Home page
	if (item.closest && (item.closest('#page-home') || item.closest('.release-grid'))) return;
    
		let controls = item.querySelector('.song-controls');
		if (!controls){
			controls = document.createElement('div');
			controls.className = 'song-controls';
			controls.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-left: auto;';
			item.appendChild(controls);
		}
    
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'ml-like';
		btn.setAttribute('aria-label', 'Like');
		btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="#fff"/></svg>';
		console.log('💗 Added like button to:', item);
    
		btn.addEventListener('mouseenter', function(){
			btn.style.transform = 'scale(1.05)';
		});
    
		btn.addEventListener('mouseleave', function(){
			btn.style.transform = 'scale(1)';
		});
    
		// Function to handle successful like
		function handleSuccessfulLike() {
			btn.classList.add('liked');
			item.dispatchEvent(new CustomEvent('songLiked', {
				bubbles: true,
				detail: { title, artist }
			}));
		}

			btn.addEventListener('click', function(e){
				e.stopPropagation();
				// Minimal UX: like the song and show a small toast notification
				try {
					// Extract track info
					const titleEl = item.querySelector('.song-title') || item.querySelector('h4');
					const title = (titleEl ? titleEl.textContent : item.getAttribute('data-title')) || 'Unknown';
					const artistEl = item.querySelector('.song-artist') || item.querySelector('p');
					const artist = artistEl ? artistEl.textContent : 'Unknown Artist';

					// Get track ID from data attribute or generate one
					let trackId = item.getAttribute('data-track-id');
					if (!trackId) {
						trackId = 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
						item.setAttribute('data-track-id', trackId);
					}

					const song = {
						id: trackId,
						title: title,
						artist: artist,
						album: item.getAttribute('data-album') || 'Unknown Album',
						duration: item.getAttribute('data-duration') || '0:00'
					};

					// Send like request
					fetch('/api/like', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							user_id: 'guest',
							action: 'like',
							song_title: title,
							song_artist: artist,
							song_album: song.album,
							song_duration: song.duration,
							album_art: item.getAttribute('data-art') || '',
							preview_url: item.getAttribute('data-preview') || ''
						})
					}).then(r=>r.json()).then(data=>{
										if (data && data.success && data.liked) {
												btn.classList.add('liked');
												// dispatch an event so any UI (legacy or React) can react
												try{ document.dispatchEvent(new CustomEvent('songLiked', { detail: { song: song, user_id: 'guest' }, bubbles: true })); } catch(e){}
												try{ addSongToLegacyLibrary(Object.assign({}, song, { album_art: item.getAttribute('data-art') || '' })); } catch(e){}
												showMlToast('Added to library');
											} else if (data && data.success && !data.liked) {
												// toggled off
												btn.classList.remove('liked');
												try{ document.dispatchEvent(new CustomEvent('songUnliked', { detail: { song: song, user_id: 'guest' }, bubbles: true })); } catch(e){}
												try{ removeSongFromLegacyLibrary(song); } catch(e){}
												showMlToast('Removed from library');
									} else {
										console.error('ml-like: like action failed', data);
										showMlToast('Could not update library');
									}
					}).catch(err=>{
						console.error('ml-like: network error', err);
						showMlToast('Network error');
					});
				} catch (e) {
					console.error('ml-like: click handler error', e);
				}
			});
    
		controls.appendChild(btn);
	}

	function scanAndAdd(){
		try {
			// Broad set of candidate selectors (covers various page layouts and legacy classes)
			const selectors = [
				'.song-item',
				'.search-result-item',
				'.release-card',
				'.playlist-track-row',
				'.playlist-card',
				'.song-row',
				'.history-item',
				'.playlist-track',
				'[data-title]'
			];

			// Diagnostic logging: record per-selector counts to help debug why none are found
			try {
				try { console.debug('ml-like: document readyState=', document.readyState, 'body children=', document.body ? document.body.childElementCount : 'no-body'); } catch(e){}
				selectors.forEach(function(s){
					try { const n = (document.querySelectorAll && document.querySelectorAll(s)) ? document.querySelectorAll(s).length : 0; console.debug('ml-like: selector', s, 'count=', n); } catch(e){ console.debug('ml-like: selector check failed', s, e); }
				});
			} catch(e) { /* ignore diagnostics errors */ }

			// Collect candidates then filter to elements that look like tracks (have a title/heading or data-title)
					const candidates = Array.from(document.querySelectorAll(selectors.join(',')) || []);
			const filtered = candidates.filter(el => {
				try {
							if (!el || el.closest && el.closest('.artist-card')) return false; // don't add to artist cards
							// Don't add like buttons to New Releases on the Home page (release-grid)
							if (el.closest && (el.closest('#page-home') || el.closest('.release-grid'))) return false;
					if (el.querySelector('.ml-like') || el.querySelector('.btn-like')) return false; // already has like UI
					if (el.getAttribute && el.getAttribute('data-title')) return true;
					if (el.querySelector('.song-title')) return true;
					if (el.querySelector('h4') && el.querySelector('p')) return true;
					if (el.querySelector('.history-title')) return true;
					return false;
				} catch (e) { return false; }
			});

			// Log once per scan to avoid noisy repeated messages
			try { console.debug('ml-like: Found ' + filtered.length + ' tracks to add like buttons (candidates: ' + candidates.length + ')'); } catch(e){}
			// Normalize to a single canonical root per track to avoid injecting
			// multiple like buttons into nested elements that represent the
			// same song row. We prefer the outermost track container when
			// available (song-item, song-row, playlist-track-row) and only
			// add one control per canonical root.
			const seenRoots = new Set();
			filtered.forEach(function(el){
				try {
					const root = el.closest('.song-item') || el.closest('.song-row') || el.closest('.playlist-track-row') || el.closest('[data-track-id]') || el;
					if (!root) return;
					// Use an identity key to deduplicate (prefer data-track-id if present)
					const key = root.getAttribute && root.getAttribute('data-track-id') ? ('id:'+root.getAttribute('data-track-id')) : (root.tagName + ':' + (root.className||'') + ':' + (root.textContent||'').slice(0,60));
					if (seenRoots.has(key)) return;
					seenRoots.add(key);
					// If this canonical root already has a like control, skip
					if (root.querySelector('.ml-like') || root.querySelector('.btn-like')) return;
					makeLikeButtonFor(root);
				} catch(e){ /* ignore per-item errors */ }
			});

			// Cleanup duplicates defensively: ensure exactly one like control
			// per logical track/root. If an `.ml-like` exists we remove legacy
			// `.btn-like` controls and any additional `.ml-like` siblings.
			function dedupeCleanup(){
				try {
					const roots = Array.from(document.querySelectorAll('.song-item, .song-row, .playlist-track-row, [data-track-id]'));
					roots.forEach(function(root){
						try {
							const mlLikes = root.querySelectorAll('.ml-like');
							const btnLikes = root.querySelectorAll('.btn-like');
							if (mlLikes && mlLikes.length) {
								// keep first ml-like, remove extras
								for (let i = 1; i < mlLikes.length; i++) try{ mlLikes[i].remove(); } catch(e){}
								// remove any legacy btn-like to avoid duplicate hearts
								btnLikes.forEach(function(b){ try{ b.remove(); } catch(e){} });
							} else if (btnLikes && btnLikes.length > 1) {
								// no ml-like present: keep a single legacy btn-like and remove extras
								for (let i = 1; i < btnLikes.length; i++) try{ btnLikes[i].remove(); } catch(e){}
							}
						} catch(e) { /* swallow per-root errors */ }
					});
				} catch(e) { /* swallow cleanup errors */ }
			}

			// Run cleanup once after injection; MutationObserver will re-run scanAndAdd
			// which in turn will call this cleanup each time.
			try { dedupeCleanup(); } catch(e){}

			// Fallback: if nothing matched, try a heuristic scan for elements that have a heading + paragraph
			if (filtered.length === 0) {
				try {
					const heuristics = Array.from(document.querySelectorAll('h4'))
						.map(h => h.closest('div') || h.parentElement)
						.filter(Boolean)
						.filter(el => {
							try {
								if (!el) return false;
								if (el.closest && el.closest('.artist-card')) return false;
								if (el.querySelector && (el.querySelector('.ml-like') || el.querySelector('.btn-like'))) return false;
								// require an h4 and a p or a data-title
								if (el.querySelector('h4') && el.querySelector('p')) return true;
								if (el.getAttribute && el.getAttribute('data-title')) return true;
								return false;
							} catch (e) { return false; }
						});
					if (heuristics.length) {
						console.debug('ml-like: fallback heuristics found', heuristics.length, 'candidates');
						heuristics.forEach(h => makeLikeButtonFor(h));
					}
				} catch (e) { /* ignore fallback errors */ }
			}

			// Some pages populate items after load; retry a couple times to catch late-inserted tracks
			try { window.__ml_like_retry_count = window.__ml_like_retry_count || 0; } catch(e) { window.__ml_like_retry_count = 0; }
			if (window.__ml_like_retry_count < 3) {
				window.__ml_like_retry_count += 1;
				setTimeout(function(){
					try { scanAndAdd(); } catch(e) { /* ignore */ }
				}, 600 * window.__ml_like_retry_count);
			}
		} catch(e){
			console.error('ml-like scan error:', e);
		}
	}

	document.addEventListener('DOMContentLoaded', function(){
		try {
			console.log('🎵 ml-like.js initialized!');
			scanAndAdd();
      
			const obs = new MutationObserver(function(){
				scanAndAdd();
			});
			// Defensive: ensure we observe a valid Node; some environments may not have body available
			const observeTarget = document.body || document.documentElement || document;
			try {
				obs.observe(observeTarget, { childList: true, subtree: true });
			} catch (obsErr) {
				console.warn('ml-like: MutationObserver.observe failed, will retry once:', obsErr);
				// Try a delayed observe in case the document structure is still being modified
				setTimeout(() => {
					try {
						const target2 = document.body || document.documentElement || document;
						obs.observe(target2, { childList: true, subtree: true });
						console.log('ml-like: MutationObserver.observe succeeded on retry');
					} catch (e2) {
						console.error('ml-like: MutationObserver observe retry failed, aborting observer:', e2);
					}
				}, 250);
			}
		} catch(e){
			console.error('ml-like init error', e);
		}
	});

// Watch for legacy .btn-like elements added by older scripts and remove/collapse them
// aggressively while logging a stack trace so we can identify the producer.
try{
	const legacyObserver = new MutationObserver(function(muts){
		try{
			muts.forEach(m => {
				(m.addedNodes ? Array.from(m.addedNodes) : []).forEach(node => {
					try{
						if(!node) return;
						// if the node itself is a legacy button
						if(node.nodeType === 1 && node.classList && node.classList.contains('btn-like')){
							try{
								console.warn('ml-like debug: legacy .btn-like element added', node);
								try{ console.warn(new Error('stack').stack); }catch(_){}
								// remove if an ml-like exists nearby or if duplicate present
								const root0 = node.closest && (node.closest('.song-item') || node.closest('.song-row') || node.closest('.search-result-item') || node.closest('.playlist-track-row') || node.closest('[data-track-id]')) || node.parentElement;
								if(root0){
									if(root0.querySelector && root0.querySelector('.ml-like')){ try{ node.remove(); }catch(e){} }
									else {
										// if multiple legacy controls exist, keep only first
										const sibs = root0.querySelectorAll && root0.querySelectorAll('.btn-like');
										if(sibs && sibs.length>1){ for(let i=1;i<sibs.length;i++) try{ sibs[i].remove(); }catch(e){} }
									}
								} else { try{ node.remove(); }catch(e){} }
							}catch(e){}
						}

						// if this added subtree contains any .btn-like elements, handle them
						if(node.querySelector){
							const btns = node.querySelectorAll('.btn-like');
							if(btns && btns.length){
								btns.forEach(b => {
									try{
										console.warn('ml-like debug: legacy .btn-like found in added subtree', b);
										try{ console.warn(new Error('stack').stack); }catch(_){}
										const root = b.closest && (b.closest('.song-item') || b.closest('.song-row') || b.closest('.search-result-item') || b.closest('.playlist-track-row') || b.closest('[data-track-id]')) || b.parentElement;
										if(root){
											// If an ml-like exists in the same root, remove this legacy btn
											if(root.querySelector && root.querySelector('.ml-like')){ try{ b.remove(); }catch(e){}; return; }
											// If multiple legacy btn-like exist, keep only the first
											const siblingBtns = root.querySelectorAll('.btn-like');
											if(siblingBtns && siblingBtns.length > 1){ for(let i=1;i<siblingBtns.length;i++) try{ siblingBtns[i].remove(); }catch(e){} }
										} else {
											try{ b.remove(); }catch(e){}
										}
									}catch(e){}
								});
							}

							// If an ml-like exists inside the added node, remove any sibling btn-likes
							const ml = node.querySelector('.ml-like');
							if(ml){
								const root2 = ml.closest && (ml.closest('.song-item') || ml.closest('.song-row') || ml.closest('.search-result-item') || ml.closest('.playlist-track-row') || ml.closest('[data-track-id]')) || ml.parentElement;
								if(root2){ const legacy = root2.querySelectorAll && root2.querySelectorAll('.btn-like'); if(legacy && legacy.length) legacy.forEach(x=>{ try{ x.remove(); }catch(e){} }); }
							}
						}
					}catch(e){}
				});
			});
		}catch(e){ /* swallow */ }
		// small deferred cleanup pass
		try{ if(window && window.setTimeout) setTimeout(function(){ try{ scanAndAdd(); }catch(e){} }, 40); }catch(e){}
	});
	try{
		legacyObserver.observe(document.body || document.documentElement || document, { childList: true, subtree: true });
	}catch(e){
		// fallback: periodic scans for a short window
		let cnt = 0;
		const poll = setInterval(function(){ try{ scanAndAdd(); }catch(e){} cnt++; if(cnt>30) clearInterval(poll); }, 250);
	}
}catch(e){ /* ignore legacy observer failures */ }

	// Remove any already-inserted ml-like buttons inside New Releases (defensive)
	try{
		const existing = document.querySelectorAll && document.querySelectorAll('#page-home .release-grid .ml-like');
		if(existing && existing.length){
			existing.forEach(function(b){ try{ b.remove(); }catch(e){} });
			console.log('ml-like: removed', existing.length, 'buttons from New Releases');
		}
	} catch(e) { /* ignore */ }

			// Additional robustness: poll for late-inserted items for a short window
			try {
				const pollInterval = setInterval(function(){ try { scanAndAdd(); } catch(e){} }, 400);
				setTimeout(function(){ try{ clearInterval(pollInterval); }catch(e){} }, 8000);
			} catch(e) { /* ignore polling failures */ }

			// Small toast helper used to show quick messages when liking/unliking
			function showMlToast(text, timeout){
				try{
					timeout = timeout || 1800;
					let t = document.querySelector('.ml-toast');
					if(!t){
						t = document.createElement('div'); t.className = 'ml-toast'; t.setAttribute('role','status');
						document.body.appendChild(t);
					}

					// Helper to insert a simple legacy list item into .song-list (non-React fallback)
					function addSongToLegacyLibrary(song){
						try{
							const root = document.querySelector('.song-list');
							if(!root) return;
							// avoid duplicates by track id
							if(song.id && root.querySelector('[data-track-id="'+song.id+'"]')) return;
							const row = document.createElement('div'); row.className = 'song-item legacy-liked'; row.setAttribute('data-track-id', song.id||'');
							row.style.padding = '10px'; row.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
							row.innerHTML = `<div style="display:flex;gap:12px;align-items:center"><div style="width:48px;height:48px;border-radius:6px;background-size:cover;background-position:center;background-image:url('${song.album_art||''}')"></div><div style="flex:1"><div style="font-weight:700">${song.title||'Unknown'}</div><div style="font-size:0.95rem;color:var(--text-muted)">${song.artist||''}</div></div></div>`;
							root.insertBefore(row, root.firstChild);
						}catch(e){ console.error('addSongToLegacyLibrary error', e); }
					}

					function removeSongFromLegacyLibrary(song){
						try{ const root = document.querySelector('.song-list'); if(!root) return; if(!song.id) return; const el = root.querySelector('[data-track-id="'+song.id+'"]'); if(el) el.remove(); }catch(e){/*ignore*/}
					}

					// Refresh the legacy .song-list from server /api/likes (guest)
					async function refreshLegacyLibraryFromServer(){
						try{
							const root = document.querySelector('.song-list');
							if(!root) return;
							const resp = await fetch('/api/likes?user_id=guest');
							if(!resp.ok) return;
							const data = await resp.json();
							const likes = data.likes || data || [];
							// clear current list and render
							root.innerHTML = '';
							likes.forEach(function(r){
								const song = { id: r.id || ('liked_'+(r.song_title||'').replace(/\s+/g,'_')+'_'+(r.song_artist||'').replace(/\s+/g,'_')), title: r.song_title, artist: r.song_artist, album_art: r.album_art };
								try{ addSongToLegacyLibrary(song); }catch(e){}
							});
						}catch(e){ console.error('refreshLegacyLibraryFromServer error', e); }
					}
					t.textContent = text;
					t.classList.add('show');
					setTimeout(()=>{ try{ t.classList.remove('show'); }catch(e){} }, timeout);
				}catch(e){ /* ignore toast errors */ }
			}

		// Listen for dispatched events so external code (React) can also trigger updates
		try{
			document.addEventListener('songLiked', function(e){ try{ if(e && e.detail && e.detail.song) addSongToLegacyLibrary(e.detail.song); refreshLegacyLibraryFromServer(); } catch(err){} });
			document.addEventListener('songUnliked', function(e){ try{ if(e && e.detail && e.detail.song) removeSongFromLegacyLibrary(e.detail.song); refreshLegacyLibraryFromServer(); } catch(err){} });
		} catch(e){}

		// When user navigates to My Library, refresh the legacy list from server
		try{
			function checkAndRefreshOnHash(){
				const hash = (window.location.hash||'').replace('#','');
				if(hash === 'library' || hash === 'page-library'){
					refreshLegacyLibraryFromServer();
				}
			}
			window.addEventListener('hashchange', checkAndRefreshOnHash);
			// also run once on load
			try{ checkAndRefreshOnHash(); } catch(e){}
		} catch(e){}

})();
