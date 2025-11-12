// Add to Album functionality - DISABLED
// File kept for future implementation

/*
function addLikeButtonToSongs() {
  // DISABLED - Code commented out to prevent like buttons from appearing
}

addLikeButtonToSongs();

const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length) {
      addLikeButtonToSongs();
    }
  });
});

const containersToWatch = [
  '.song-list',
  '.search-results', 
  '#globalSearchResults',
  '#playlistTracks',
  '#moodTracks',
  '#radioNowPlaying',
  '.content-wrap'
];

containersToWatch.forEach(selector => {
  document.querySelectorAll(selector).forEach(container => {
    if (container) {
      observer.observe(container, { childList: true, subtree: true });
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(addLikeButtonToSongs, 1000);
});

setInterval(addLikeButtonToSongs, 3000);
*/

console.log('✅ add-to-album.js loaded (like buttons disabled)');