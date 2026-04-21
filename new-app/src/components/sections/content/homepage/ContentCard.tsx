import { useNavigate } from 'react-router';
import {
  Badge,
  Box,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Stack,
  Typography,
  cardMediaClasses,
} from '@mui/material';
import dayjs from 'dayjs';
import { useSettingsContext } from 'providers/SettingsProvider';
import paths from 'routes/paths';
import { ContentItem } from 'types/content';
import IconifyIcon from 'components/base/IconifyIcon';
import BookmarkButton from '../common/BookmarkButton';

interface ContentCardProps {
  item: ContentItem;
}

const ContentCard = ({ item }: ContentCardProps) => {
  const navigate = useNavigate();
  const isForSaleFeature = item.id === 1 && item.variant === 'featured';
  const isSerialDecoderFeature = item.id === 3;
  const isCleanFeatureCard = isForSaleFeature || isSerialDecoderFeature;
  const {
    config: { assetsDir },
  } = useSettingsContext();

  const handleCardClick = () => {
    if (isForSaleFeature) {
      window.location.href = 'https://www.coalcreekguitars.com/guitars-and-gear-for-sale/';
      return;
    }
    if (isSerialDecoderFeature) {
      window.location.href = 'https://www.coalcreekguitars.com/decoders/guitar-serial-decoder-lookup';
      return;
    }

    const typeToPath =
      {
        blog: paths.blogDetails,
        video: paths.videoDetails,
        podcast: paths.podcastDetails,
      }[item.type] || paths.podcastDetails;

    navigate(typeToPath(`${item.id}`));
  };

  const isVideo = item.type === 'video';
  const mediaTransition = 'transform 0.4s ease, filter 0.4s ease';

  const iconMap: Record<string, string> = {
    podcast: 'material-symbols:headphones-outline-rounded',
    video: 'material-symbols:play-circle-outline-rounded',
    blog: 'material-symbols:article-outline-rounded',
  };

  return (
    <Card
      key={item.id}
      onClick={handleCardClick}
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        height: { xs: 327, sm: 280, md: 334, lg: item.variant === 'featured' ? 576 : 280 },
        gridColumn: { lg: 'span 1' },
        gridRow: { lg: item.variant === 'featured' ? 'span 2' : 'span 1' },

        [`&:hover .${cardMediaClasses.img}`]: { transform: 'scale(1.05)', filter: 'brightness(1)' },
        [`&:hover video`]: { opacity: 1, transform: 'scale(1.05)' },
      }}
      onMouseEnter={(e) => e.currentTarget.querySelector('video')?.play()}
      onMouseLeave={(e) => e.currentTarget.querySelector('video')?.pause()}
    >
      <Box sx={{ position: 'relative', height: 1 }}>
        <CardMedia
          component="img"
          image={item.image}
          alt={item.title}
          sx={{
            height: 1,
            width: 1,
            filter: 'brightness(0.7)',
            transition: mediaTransition,
            transformOrigin: 'center',
          }}
        />
        {isVideo && (
          <CardMedia
            component="video"
            src={`${assetsDir}/videos/file-manager/aurora.mp4`}
            muted
            loop
            playsInline
            sx={{
              height: 1,
              width: 1,
              position: 'absolute',
              inset: 0,
              opacity: 0,
              transition: 'opacity 0.4s ease, transform 0.4s ease',
              transformOrigin: 'center',
              objectFit: 'cover',
            }}
          />
        )}
      </Box>

      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,1) 100%)`,
        }}
      />

      <CardContent sx={{ position: 'absolute', bottom: 0, left: 0, width: 1, p: 3 }}>
        {!isCleanFeatureCard && (
          <Stack alignItems="center" gap={2} mb={1}>
            <Chip size="small" label={item.category} />
            <Typography variant="caption" color="white" fontWeight={600}>
              {item.requiredTime}
            </Typography>
          </Stack>
        )}

        <Typography variant="h6" color="white" mb={2} sx={{ lineClamp: 2 }}>
          {item.title}
        </Typography>

        {!isCleanFeatureCard && (
          <Stack alignItems="center" justifyContent="space-between" width={1}>
            <Box>
              <Typography variant="subtitle2" color="white" fontWeight={600} mb={0.5}>
                {item.author}
              </Typography>
              <Typography variant="caption" color="white">
                {dayjs(item.date).format('DD MMM, YYYY')}
              </Typography>
            </Box>
            <BookmarkButton iconColor="white" />
          </Stack>
        )}
      </CardContent>

      {!isCleanFeatureCard && (
        <Badge
          overlap="circular"
          badgeContent={
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                bgcolor: 'neutral.main',
                color: 'neutral.contrastText',
              }}
            >
              <IconifyIcon icon={iconMap[item.type]} fontSize={24} />
            </Box>
          }
          sx={{ position: 'absolute', top: 44, left: 44 }}
        />
      )}
    </Card>
  );
};

export default ContentCard;
