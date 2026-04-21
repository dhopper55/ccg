import { Divider } from '@mui/material';
import ContentComments from '../../common/comments';
import PodcastEpisodes from './PodcastEpisodes';
import PodcastHeader from './PodcastHeader';
import PodcastsFromCreator from './PodcastsFromCreator';
import PodcastRecommendations from './recommendations';

const PodcastMain = () => {
  return (
    <div>
      <PodcastHeader />
      <Divider sx={{ my: 3 }} />
      <PodcastEpisodes />
      <Divider sx={{ my: { xs: 3, md: 5 } }} />
      <ContentComments />
      <Divider sx={{ my: { xs: 3, md: 5 } }} />
      <PodcastsFromCreator />
      <Divider sx={{ my: { xs: 3, md: 5 } }} />
      <PodcastRecommendations />
    </div>
  );
};

export default PodcastMain;
