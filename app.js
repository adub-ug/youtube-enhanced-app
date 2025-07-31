const API_KEY = 'AIzaSyCjwqtIY65EYKNrSoeNovBCRVPfZDDh8QA'; // Replace with your Google API key
let player;

// Ad-blocking and tracker-blocking
const blockedDomains = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'youtube.com/get_video_ads',
  'youtube.com/api/stats/ads',
  'youtube.com/ptracking',
  'google-analytics.com'
];

const originalFetch = window.fetch;
window.fetch = async (url, ...args) => {
  if (typeof url === 'string' && blockedDomains.some(domain => url.includes(domain))) {
    console.log(`Blocked: ${url}`);
    return new Response(null, { status: 403 });
  }
  return originalFetch(url, ...args);
};

// Clean URLs
function cleanUrl(url) {
  try {
    const urlObj = new URL(url);
    const paramsToRemove = ['utm_source', 'utm_medium', 't', 'feature', 'si'];
    paramsToRemove.forEach(param => urlObj.searchParams.delete(param));
    return urlObj.toString();
  } catch (e) {
    return url;
  }
}

// SponsorBlock API
async function checkSponsorSegments(videoId) {
  if (!videoId) return [];
  try {
    const response = await fetch(`https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}&categories=["sponsor","selfpromo"]`, {
      cache: 'force-cache'
    });
    if (response.ok) return await response.json();
    return [];
  } catch (e) {
    console.log('SponsorBlock API error:', e);
    return [];
  }
}

// Initialize YouTube player
function initPlayer(videoId) {
  if (player) player.destroy();
  player = new YT.Player('player', {
    height: '100%',
    width: '100%',
    videoId: videoId,
    playerVars: {
      autoplay: 1,
      controls: 1,
      rel: 0,
      fs: 1,
      iv_load_policy: 3,
      playsinline: 1
    },
    events: {
      onReady: (event) => {
        document.getElementById('loading').style.display = 'none';
        event.target.setPlaybackQuality('hd1080');
        event.target.setVolume(50);
        setTimeout(() => event.target.seekTo(5), 500);
        checkSponsorSegments(videoId).then(segments => {
          if (segments.length > 0) {
            const checkInterval = setInterval(() => {
              if (!player || player.getPlayerState() !== 1) return;
              const currentTime = player.getCurrentTime();
              segments.forEach(segment => {
                const start = segment.segment[0];
                const end = segment.segment[1];
                if (currentTime >= start && currentTime < end) {
                  player.seekTo(end);
                  console.log(`Skipped sponsor: ${start}-${end}`);
                }
              });
            }, 200);
          }
        });
      },
      onError: (e) => {
        console.log('Player error:', e);
        document.getElementById('loading').textContent = 'Error loading video. Try another search.';
      }
    }
  });
}

// Search videos by title
async function searchVideos(query) {
  const videoList = document.getElementById('video-list');
  videoList.innerHTML = '';
  document.getElementById('loading').textContent = 'Searching...';
  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=10&key=${API_KEY}`);
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      data.items.forEach(item => {
        const videoId = item.id.videoId;
        const title = item.snippet.title;
        const thumbnail = item.snippet.thumbnails.default.url;
        const div = document.createElement('div');
        div.className = 'flex items-center p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700';
        div.innerHTML = `<img src="${thumbnail}" alt="${title}" class="w-16 h-12 mr-2"><span>${title}</span>`;
        div.onclick = () => {
          history.replaceState(null, '', `/watch?v=${videoId}`);
          initPlayer(videoId);
          videoList.innerHTML = '';
        };
        videoList.appendChild(div);
      });
      document.getElementById('loading').style.display = 'none';
    } else {
      document.getElementById('loading').textContent = 'No videos found. Try another search.';
    }
  } catch (e) {
    console.log('Search error:', e);
    document.getElementById('loading').textContent = 'Search failed. Check API key or try again.';
  }
}

// Handle search input
document.getElementById('search-bar').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const query = e.target.value.trim();
    if (query) {
      if (query.includes('youtube.com/watch?v=')) {
        try {
          const videoId = new URL(query).searchParams.get('v');
          if (videoId) {
            history.replaceState(null, '', `/watch?v=${videoId}`);
            document.getElementById('loading').textContent = 'Loading YouTube...';
            videoList.innerHTML = '';
            initPlayer(videoId);
          } else {
            document.getElementById('loading').textContent = 'Invalid YouTube URL. Try a title search.';
          }
        } catch (e) {
          document.getElementById('loading').textContent = 'Invalid URL format. Use a video title or valid URL.';
        }
      } else {
        searchVideos(query);
      }
    } else {
      document.getElementById('loading').textContent = 'Please enter a video title or URL.';
    }
  }
});

// Handle URL video ID
const urlParams = new URLSearchParams(window.location.search);
const videoId = urlParams.get('v');
if (videoId) initPlayer(videoId);