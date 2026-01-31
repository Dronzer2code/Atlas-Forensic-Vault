'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

interface AudioContextType {
  isPlaying: boolean;
  toggleAudio: () => void;
  hasInteracted: boolean;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [currentTrack, setCurrentTrack] = useState('/bgm.flac');
  const audioRef = useRef<HTMLAudioElement>(null);

  const fadeIn = () => {
    if (!audioRef.current) return;
    
    const targetVolume = 0.15;
    const duration = 1000; // 1 second
    const interval = 50;
    const step = targetVolume / (duration / interval);
    
    let currentVolume = 0;
    audioRef.current.volume = 0;
    
    const fadeInterval = setInterval(() => {
      if (!audioRef.current) {
        clearInterval(fadeInterval);
        return;
      }
      
      currentVolume = Math.min(currentVolume + step, targetVolume);
      audioRef.current.volume = currentVolume;
      
      if (currentVolume >= targetVolume) {
        clearInterval(fadeInterval);
      }
    }, interval);
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.error("Play failed", e));
      setIsPlaying(true);
      // Ensure volume is set if it was muted or not initialized
      if (audioRef.current.volume < 0.25) {
          audioRef.current.volume = 0.25;
      }
    }
  };

  const handleTrackEnd = () => {
    // Switch between bgm.flac and bgm2.flac
    setCurrentTrack(prev => prev === '/bgm.flac' ? '/bgm2.flac' : '/bgm.flac');
  };

  // Auto-play when track changes if already playing
  useEffect(() => {
    if (hasInteracted && isPlaying && audioRef.current) {
      audioRef.current.play().catch(e => console.error("Track transition play failed", e));
    }
  }, [currentTrack]);

  // Attempt autoplay on mount
  useEffect(() => {
    if (audioRef.current) {
      // Set initial volume to 0 for fade in
      audioRef.current.volume = 0;
      
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setHasInteracted(true);
            fadeIn();
          })
          .catch((e) => {
            console.log("Autoplay blocked by browser policy. Waiting for interaction.", e);
          });
      }
    }
  }, []);

  useEffect(() => {
    const handleInteraction = () => {
      if (!hasInteracted && audioRef.current) {
        setHasInteracted(true);
        // Only start playing if not already playing (though hasInteracted check should prevent this)
        audioRef.current.play().then(() => {
            setIsPlaying(true);
            fadeIn();
        }).catch(e => {
            console.log("Autoplay prevented or failed", e);
            // If autoplay fails, we might want to reset hasInteracted or just leave it
            // and let the user manually toggle. But usually it fails because of no interaction,
            // and we are inside a click handler, so it should work.
        });
      }
    };

    // Listen for click on the window to trigger audio
    window.addEventListener('click', handleInteraction, { once: true });
    
    return () => {
      window.removeEventListener('click', handleInteraction);
    };
  }, [hasInteracted]);

  return (
    <AudioContext.Provider value={{ isPlaying, toggleAudio, hasInteracted }}>
      <audio 
        ref={audioRef} 
        src={currentTrack} 
        onEnded={handleTrackEnd}
      />
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}
