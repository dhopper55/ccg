import { Box, Paper, SxProps } from '@mui/material';

const getYouTubeEmbedUrl = (url?: string) => {
  const value = String(url || '').trim();
  if (!value) return '';

  try {
    const parsedUrl = new URL(value);
    const host = parsedUrl.hostname.replace(/^www\./, '');
    let videoId = '';

    if (host === 'youtu.be') {
      videoId = parsedUrl.pathname.split('/').filter(Boolean)[0] || '';
    } else if (host.endsWith('youtube.com')) {
      if (parsedUrl.pathname.startsWith('/shorts/')) {
        videoId = parsedUrl.pathname.split('/').filter(Boolean)[1] || '';
      } else if (parsedUrl.pathname.startsWith('/embed/')) {
        videoId = parsedUrl.pathname.split('/').filter(Boolean)[1] || '';
      } else {
        videoId = parsedUrl.searchParams.get('v') || '';
      }
    }

    return videoId
      ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&mute=1&playsinline=1&rel=0`
      : '';
  } catch {
    return '';
  }
};

const ProductVideo = ({ sx, youtubeUrl }: { sx?: SxProps; youtubeUrl?: string }) => {
  const youtubeEmbedUrl = getYouTubeEmbedUrl(youtubeUrl);
  if (!youtubeEmbedUrl) return null;

  return (
    <Paper sx={{ p: 0, overflow: 'hidden', ...sx }}>
      <Box
        component="iframe"
        src={youtubeEmbedUrl}
        title="Product video"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        sx={{
          border: 0,
          display: 'block',
          width: 1,
          height: 1,
          minHeight: { xs: 220, lg: 280 },
        }}
      />
    </Paper>
  );
};

export default ProductVideo;
