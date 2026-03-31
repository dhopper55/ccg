import { useRef, useState } from 'react';
import { Collapse, Container, Paper } from '@mui/material';
import { useNavContext } from 'layouts/main-layout/NavProvider';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import { useSettingsContext } from 'providers/SettingsProvider';
import { AudioProvider } from 'components/sections/content/details/podcast/AudioProvider';
import PodcastMain from 'components/sections/content/details/podcast/main';
import PodcastPlayer from 'components/sections/content/details/podcast/player';
import ExpandedPlayer from 'components/sections/content/details/podcast/player/expanded';

const PodcastContent = () => {
  const {
    config: { assetsDir },
  } = useSettingsContext();
  const { topbarHeight } = useNavContext();
  const { up } = useBreakpoints();
  const container = useRef<HTMLDivElement | null>(null);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);

  const upSm = up('sm');

  const togglePlayer = () => {
    setIsPlayerExpanded((prev) => !prev);
  };
  const audio = `${assetsDir}/audio/triangle-instrumental.mp3`;

  return (
    <AudioProvider audioSrc={audio}>
      <Paper
        ref={container}
        sx={{
          position: 'relative',
        }}
      >
        <Collapse in={!isPlayerExpanded}>
          <Container
            maxWidth="md"
            sx={{
              p: { xs: 3, md: 5 },
            }}
          >
            <PodcastMain />
          </Container>
        </Collapse>

        <Collapse in={isPlayerExpanded}>
          <Paper background={2}>
            <Container
              maxWidth="lg"
              sx={{
                p: { xs: 3, md: 5 },
                minHeight: ({ mixins }) =>
                  mixins.contentHeight(
                    topbarHeight,
                    (upSm ? mixins.footer.sm : mixins.footer.xs) + 1,
                  ),
              }}
            >
              <ExpandedPlayer />
            </Container>
          </Paper>
        </Collapse>

        <PodcastPlayer isExpanded={isPlayerExpanded} togglePlayer={togglePlayer} />
      </Paper>
    </AudioProvider>
  );
};

export default PodcastContent;
