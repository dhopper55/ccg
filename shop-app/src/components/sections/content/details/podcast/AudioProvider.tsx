import React, { ReactNode, createContext, useContext } from 'react';
import useAudioControls from './useAudioControls';

interface AudioContextType {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isRepeating: boolean;
  isShuffling: boolean;
  togglePlay: () => void;
  skipBackward: (seconds?: number) => void;
  skipForward: (seconds?: number) => void;
  restart: () => void;
  seek: (time: number) => void;
  changeVolume: (newVolume: number) => void;
  toggleMute: () => void;
  changePlaybackRate: (rate: number) => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  formatTime: (time: number) => string;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider');
  }
  return context;
};

interface AudioProviderProps {
  children: ReactNode;
  audioSrc: string;
}

export const AudioProvider: React.FC<AudioProviderProps> = ({ children, audioSrc }) => {
  const audioControls = useAudioControls(audioSrc);

  return (
    <AudioContext.Provider value={audioControls}>
      {/* Audio element - ref is managed by the hook */}
      <audio ref={audioControls.audioRef} preload="metadata" style={{ display: 'none' }} />
      {children}
    </AudioContext.Provider>
  );
};
