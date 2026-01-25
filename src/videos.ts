// YouTube channel videos integration
export {};

interface YouTubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  videoUrl: string;
}

interface YouTubeSearchItem {
  id: {
    videoId: string;
  };
  snippet: {
    title: string;
    publishedAt: string;
    thumbnails: {
      high: {
        url: string;
      };
      medium: {
        url: string;
      };
    };
  };
}

interface YouTubeSearchResponse {
  items: YouTubeSearchItem[];
  nextPageToken?: string;
  prevPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
}

interface YouTubeChannelResponse {
  items: Array<{
    id: string;
  }>;
}

// Configuration - update these values
const YOUTUBE_CONFIG = {
  // YouTube Data API key - get one from Google Cloud Console
  apiKey: 'AIzaSyAiKvOfTNfOZVZi7dYDf9ppa_uz-O_14ZU',
  // Channel username or custom URL (e.g., 'pauldavids' from youtube.com/pauldavids)
  channelUsername: 'pauldavids',
  // Number of videos per page
  videosPerPage: 12
};

// State for pagination
let cachedChannelId: string | null = null;
let currentPageToken: string | null = null;
let nextPageToken: string | null = null;
let prevPageToken: string | null = null;
let currentPage = 1;
let totalResults = 0;

async function getChannelId(username: string): Promise<string> {
  if (cachedChannelId) return cachedChannelId;

  // Try to get channel by username/handle
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${username}&key=${YOUTUBE_CONFIG.apiKey}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch channel: ${response.status}`);
  }

  const data: YouTubeChannelResponse = await response.json();

  if (data.items && data.items.length > 0) {
    cachedChannelId = data.items[0].id;
    return cachedChannelId;
  }

  // Fallback: try forUsername parameter (for older channel formats)
  const fallbackResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${username}&key=${YOUTUBE_CONFIG.apiKey}`
  );

  if (!fallbackResponse.ok) {
    throw new Error(`Failed to fetch channel: ${fallbackResponse.status}`);
  }

  const fallbackData: YouTubeChannelResponse = await fallbackResponse.json();

  if (fallbackData.items && fallbackData.items.length > 0) {
    cachedChannelId = fallbackData.items[0].id;
    return cachedChannelId;
  }

  throw new Error(`Channel not found: ${username}`);
}

async function fetchVideos(pageToken?: string | null): Promise<YouTubeVideo[]> {
  // First get the channel ID from username
  const channelId = await getChannelId(YOUTUBE_CONFIG.channelUsername);

  // Build URL with optional page token
  let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=${YOUTUBE_CONFIG.videosPerPage}&key=${YOUTUBE_CONFIG.apiKey}`;

  if (pageToken) {
    url += `&pageToken=${pageToken}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch videos: ${response.status}`);
  }

  const data: YouTubeSearchResponse = await response.json();

  // Store pagination tokens
  nextPageToken = data.nextPageToken || null;
  prevPageToken = data.prevPageToken || null;
  totalResults = data.pageInfo.totalResults;

  // Map to our video interface
  const videos: YouTubeVideo[] = (data.items || []).map(item => ({
    id: item.id.videoId,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
    publishedAt: item.snippet.publishedAt,
    videoUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`
  }));

  // Sort by published date, most recent first
  videos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return videos;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function createVideoCard(video: YouTubeVideo): HTMLElement {
  const card = document.createElement('a');
  card.className = 'listing-card video-card';
  card.href = video.videoUrl;
  card.target = '_blank';
  card.rel = 'noopener noreferrer';

  card.innerHTML = `
    <div class="listing-image video-thumbnail">
      <img src="${video.thumbnail}" alt="${video.title}" loading="lazy">
      <div class="video-play-icon">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>
    </div>
    <div class="listing-info video-info">
      <h3 class="listing-title video-title">${video.title}</h3>
      <p class="video-date">${formatDate(video.publishedAt)}</p>
    </div>
  `;

  return card;
}

function createPaginationControls(): HTMLElement {
  const pagination = document.createElement('div');
  pagination.className = 'pagination-controls';
  pagination.id = 'pagination-controls';

  const totalPages = Math.ceil(totalResults / YOUTUBE_CONFIG.videosPerPage);

  pagination.innerHTML = `
    <button class="pagination-btn" id="prev-page" ${!prevPageToken ? 'disabled' : ''}>
      &larr; Previous
    </button>
    <span class="pagination-info">Page ${currentPage} of ${totalPages}</span>
    <button class="pagination-btn" id="next-page" ${!nextPageToken ? 'disabled' : ''}>
      Next &rarr;
    </button>
  `;

  return pagination;
}

function showError(message: string): void {
  const errorEl = document.getElementById('videos-error');
  const loadingEl = document.getElementById('videos-loading');

  if (loadingEl) loadingEl.classList.add('hidden');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }
}

function showEmpty(): void {
  const emptyEl = document.getElementById('videos-empty');
  const loadingEl = document.getElementById('videos-loading');

  if (loadingEl) loadingEl.classList.add('hidden');
  if (emptyEl) emptyEl.classList.remove('hidden');
}

function showLoading(): void {
  const loadingEl = document.getElementById('videos-loading');
  const gridEl = document.getElementById('videos-grid');
  const paginationEl = document.getElementById('pagination-controls');

  if (loadingEl) loadingEl.classList.remove('hidden');
  if (gridEl) gridEl.innerHTML = '';
  if (paginationEl) paginationEl.remove();
}

function renderVideos(videos: YouTubeVideo[]): void {
  const gridEl = document.getElementById('videos-grid');
  const loadingEl = document.getElementById('videos-loading');
  const containerEl = document.querySelector('.listings-container');

  if (loadingEl) loadingEl.classList.add('hidden');

  if (!gridEl) return;

  if (videos.length === 0) {
    showEmpty();
    return;
  }

  gridEl.innerHTML = '';
  videos.forEach(video => {
    const card = createVideoCard(video);
    gridEl.appendChild(card);
  });

  // Remove existing pagination controls
  const existingPagination = document.getElementById('pagination-controls');
  if (existingPagination) existingPagination.remove();

  // Add pagination controls
  if (containerEl && (nextPageToken || prevPageToken)) {
    const pagination = createPaginationControls();
    containerEl.appendChild(pagination);

    // Attach event listeners
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');

    if (prevBtn) {
      prevBtn.addEventListener('click', async () => {
        if (prevPageToken) {
          currentPage--;
          showLoading();
          try {
            const videos = await fetchVideos(prevPageToken);
            renderVideos(videos);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } catch (error) {
            console.error('Error fetching videos:', error);
            showError('Unable to load videos. Please try again later.');
          }
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', async () => {
        if (nextPageToken) {
          currentPage++;
          showLoading();
          try {
            const videos = await fetchVideos(nextPageToken);
            renderVideos(videos);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } catch (error) {
            console.error('Error fetching videos:', error);
            showError('Unable to load videos. Please try again later.');
          }
        }
      });
    }
  }
}

// Initialize on page load
async function init(): Promise<void> {
  // Check if API key is configured
  if (YOUTUBE_CONFIG.apiKey === 'YOUR_YOUTUBE_API_KEY') {
    showError('YouTube API key not configured. Please set YOUTUBE_CONFIG.apiKey in src/videos.ts');
    return;
  }

  try {
    const videos = await fetchVideos();
    renderVideos(videos);
  } catch (error) {
    console.error('Error fetching YouTube videos:', error);
    showError('Unable to load videos. Please try again later.');
  }
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
