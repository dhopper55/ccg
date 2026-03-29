import { MediaType } from './social';
import { User } from './users';

export interface ContentItem {
  id: number;
  title: string;
  key: string;
  category: string;
  author: string;
  date: string;
  type: 'blog' | 'podcast' | 'video';
  requiredTime: string;
  image: string;
  variant: 'regular' | 'highlight' | 'featured';
}

export interface ContentSearchItem {
  id: number;
  type: 'blogs' | 'podcasts' | 'videos';
  category: string;
  requiredTime: string;
  episode?: string;
  title: string;
  description: string;
  author?: string;
  date: string;
  thumbnail: string;
  isPlaylist?: boolean;
  uploadedBy: {
    name: string;
    avatar?: string;
  };
}

export interface SearchTopics {
  id: number;
  key: string;
  label: string;
}

export interface Creator {
  id: number;
  avatar?: string;
  name: string;
  uploadedCount: {
    blog?: number;
    videos?: number;
    podcasts?: number;
  };
  isFollowing: boolean;
}

export interface Topic {
  id: number;
  key: string;
  label: string;
}

export interface ContentTopic {
  id: number;
  category: string;
  topics: Topic[];
}

export interface BlogDetailsTag {
  id: number;
  label: string;
}

export interface BlogTableOfContent {
  id: number;
  url: string;
  label: string;
}

export interface CommentItemType {
  id: number;
  author: User;
  createdAt: string;
  message: {
    text?: string;
    attachments?: MediaType[];
  };
  engagement: EngagementStats;
  replies: CommentItemType[];
}

export interface EngagementStats {
  likes?: number;
  comments?: number;
}

export interface VideoDetails {
  id: number;
  description: string;
  team: { role: string; name: string }[];
  socials: { platform: string; link: string }[];
  tags: string[];
}

export interface UploaderInfo {
  uploadedDate: string;
  followers: number;
  content: number;
}
export interface Video {
  id: number;
  type: 'playlist' | 'related';
  title: string;
  duration: string;
  thumbnail: string;
  category: string;
  videoSrc: string;
  author: User;
  uploaderInfo: UploaderInfo;
  engagement: EngagementStats;
  details: VideoDetails;
  comments: CommentItemType[];
}

export interface PodcastEpisode {
  episodeNumber: number;
  title: string;
  description?: string;
  duration: string;
  audioSrc?: string;
  imageSrc?: string;
  date?: string;
  tags: string[];
  socials: { platform: string; link: string }[];
  team: { role: string; name: string }[];
  comments: CommentItemType[];
}

export interface PodcastPlaylist {
  id: number;
  title: string;
  description?: string;
  category: string;
  image: string;
  episodeLists: PodcastEpisode[];
  releaseDate: string;
  author: User;
  uploaderInfo: UploaderInfo;
  engagement: EngagementStats;
  totalEpisodes: number;
  totalDuration: string;
  comments?: CommentItemType[];
}

export interface TranscriptItem {
  id: number;
  time: number;
  text: string;
}

export interface PlaylistUploaderItem {
  id: number;
  title: string;
  thumbnail: { id: string; file: any };
  description: string;
}

export interface TargeAudience {
  value: string;
  label: string;
}

export interface TopicDropdownItem {
  id: number;
  title: string;
}

export interface BlogPreviewState {
  title: string;
  subtitle: string;
  story: string;
}
