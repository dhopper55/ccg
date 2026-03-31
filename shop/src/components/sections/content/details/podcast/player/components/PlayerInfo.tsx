import { Box, Stack, SxProps, Typography } from '@mui/material';
import { podcastPlaylist } from 'data/content/podcast';
import Image from 'components/base/Image';

const episode = podcastPlaylist[0].episodeLists[1];

const PlayerInfo = ({ sx }: { sx?: SxProps }) => {
  return (
    <Stack sx={{ alignItems: 'center', ...sx }}>
      <Box sx={{ width: 36, height: 36, flexShrink: 0 }}>
        <Image
          src={episode.imageSrc}
          alt="Podcast cover"
          sx={{ width: 1, height: 1, borderRadius: 2, objectFit: 'cover' }}
        />
      </Box>

      <Box sx={{ flexGrow: 1, px: 1, py: 0.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', lineClamp: 1, mb: 0.5 }}>
          {episode.title}
        </Typography>

        <Typography
          component="p"
          variant="caption"
          sx={{ fontWeight: 'medium', color: 'text.secondary' }}
        >
          Alexander Quinn
        </Typography>
      </Box>
    </Stack>
  );
};

export default PlayerInfo;
