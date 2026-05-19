// YouTube channel videos integration
export {};

interface YouTubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  videoUrl: string;
}

interface YouTubeVideosResponse {
  records?: YouTubeVideo[];
  message?: string;
}

async function fetchVideos(): Promise<YouTubeVideo[]> {
  const response = await fetch('/api/youtube/videos', {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch videos: ${response.status}`);
  }

  const data: YouTubeVideosResponse = await response.json();
  return Array.isArray(data.records) ? data.records : [];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createVideoCard(video: YouTubeVideo): HTMLElement {
  const card = document.createElement('a');
  card.className = 'listing-card video-card';
  card.href = video.videoUrl;
  card.target = '_blank';
  card.rel = 'noopener noreferrer';

  const title = escapeHtml(video.title);
  const thumbnail = escapeHtml(video.thumbnail);

  card.innerHTML = `
    <div class="listing-image video-thumbnail">
      <img src="${thumbnail}" alt="${title}" loading="lazy">
      <div class="video-play-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>
    </div>
    <div class="listing-info video-info">
      <h3 class="listing-title video-title">${title}</h3>
      <p class="video-date">${formatDate(video.publishedAt)}</p>
    </div>
  `;

  return card;
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

function renderVideos(videos: YouTubeVideo[]): void {
  const gridEl = document.getElementById('videos-grid');
  const loadingEl = document.getElementById('videos-loading');

  if (loadingEl) loadingEl.classList.add('hidden');
  if (!gridEl) return;

  if (videos.length === 0) {
    showEmpty();
    return;
  }

  gridEl.innerHTML = '';
  videos.forEach((video) => {
    gridEl.appendChild(createVideoCard(video));
  });
}

async function init(): Promise<void> {
  try {
    const videos = await fetchVideos();
    renderVideos(videos);
  } catch (error) {
    console.error('Error fetching YouTube videos:', error);
    showError('Unable to load videos. Please visit our YouTube channel directly.');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
