'use client';

import Image from 'next/image';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Download,
  Share2,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  FileText,
  Clock,
  Radio,
  Sparkles,
  Github,
  Paperclip,
  Menu,
  X,
} from 'lucide-react';
import DevelopingEvidence from '@/components/ui/DevelopingEvidence';
import { useAudio } from '@/components/layout/AudioProvider';

const Reel = ({ isPlaying, speed }: { isPlaying: boolean; speed: number }) => (
  <motion.div 
    animate={{ rotate: isPlaying ? 360 : 0 }}
    transition={{ repeat: Infinity, duration: speed, ease: "linear" }}
    className="relative w-24 h-24 md:w-32 md:h-32 rounded-full border-8 border-zinc-800 bg-[#0a0a0a] shadow-[0_0_15px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(0,0,0,1)] flex items-center justify-center flex-shrink-0 overflow-hidden"
  >
    {/* Brushed Metal Texture */}
    <div className="absolute inset-0 opacity-30 rounded-full bg-[url('https://www.transparenttextures.com/patterns/brushed-alum.png')]" />
    
    {/* Tape Mass (Dark Brown) */}
    <div className="absolute inset-1 rounded-full border-[24px] border-[#2a2018] opacity-90" />
    
    {/* Metal Spokes Container - Centered */}
    <div className="absolute inset-0 flex items-center justify-center">
        {[0, 45, 90, 135].map((deg) => (
            <div 
                key={deg}
                className="absolute w-full h-2 bg-gradient-to-b from-zinc-300 to-zinc-500 shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                style={{ transform: `rotate(${deg}deg)` }}
            >
                 {/* Cutouts/Detailing */}
                 <div className="w-1/3 h-0.5 bg-[#0a0a0a] mx-auto mt-0.5 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]"></div>
            </div>
        ))}
    </div>
    
    {/* Center Hub */}
    <div className="w-12 h-12 rounded-full bg-zinc-300 border-4 border-zinc-500 flex items-center justify-center shadow-[0_4px_8px_rgba(0,0,0,0.5)] z-10 relative">
      <div className="w-3 h-3 rounded-full bg-zinc-800 shadow-[inset_0_1px_2px_rgba(0,0,0,1)]" />
      {/* Hub Bolts */}
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <div 
            key={deg}
            className="absolute w-1.5 h-1.5 bg-zinc-600 rounded-full shadow-[0_1px_1px_rgba(255,255,255,0.5)]"
            style={{ transform: `rotate(${deg}deg) translateY(-16px)` }}
        />
      ))}
    </div>
  </motion.div>
);

interface Podcast {
  id: string;
  repo_name: string;
  title: string;
  status: string;
  audio_url?: string;
  duration?: number;
  script?: {
    title: string;
    dramatic_arc?: string;
    segments: Array<{
      speaker: string;
      text: string;
    }>;
  };
  repo_metadata?: {
    name: string;
    description: string;
    language: string;
    stars: number;
  };
  created_at?: string;
}

export default function PodcastPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const podcastId = params.id as string;

  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Audio Player State
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Visual Effects State
  const [isTorchEnabled, setIsTorchEnabled] = useState(true);
  const [isHoveringNav, setIsHoveringNav] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isPlaying: isBgmPlaying, toggleAudio: toggleBgm } = useAudio();

  const fetchPodcast = useCallback(async () => {
    try {
      const response = await fetch(`/api/podcasts/${podcastId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch podcast');
      }

      setPodcast(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [podcastId]);

  useEffect(() => {
    fetchPodcast();
  }, [fetchPodcast]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const container = document.querySelector('.flashlight-container') as HTMLElement;
      if (container) {
        container.style.setProperty('--x', `${e.clientX}px`);
        container.style.setProperty('--y', `${e.clientY}px`);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        // Handle AbortError when play is interrupted
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Error playing audio:', error);
        }
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      setVolume(vol);
      setIsMuted(vol === 0);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const skip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <DevelopingEvidence />;
  }

  if (error || !podcast) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Error</h1>
          <p className="text-gray-400 mb-4">{error || 'Podcast not found'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#e7e5e4] font-typewriter relative overflow-x-hidden">
      {/* Global Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
         {/* Film Grain */}
         <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/noise.png")'}}></div>
         {/* Vignette */}
         <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/40 to-black/90"></div>
      </div>

      {isTorchEnabled && <div className="flashlight-container flashlight-overlay"></div>}

      {/* Audio Element - render if we have a valid audio URL */}
      {podcast.audio_url && (
        <audio
          ref={audioRef}
          src={podcast.audio_url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          onError={() => console.log('Audio load error - audio may not be available yet')}
        />
      )}

      {/* Rack-Mounted Detective Console Navbar */}
      <nav className="relative mx-auto mt-2 md:mt-6 z-[60] w-[95%] md:w-full max-w-5xl bg-zinc-950/90 backdrop-blur-sm border border-zinc-800 shadow-2xl rounded-sm">
        {/* Texture Overlay */}
        <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay" style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/brushed-alum.png")'}}></div>
        
        {/* Yellow Tape Border at Bottom */}
        <div className="absolute bottom-0 left-0 w-full h-1.5 bg-yellow-500 overflow-hidden flex items-center rounded-b-sm">
           <div className="w-full h-full bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)] opacity-20"></div>
        </div>

        <div className="px-3 md:px-6 h-16 md:h-24 flex items-center justify-between relative">
          {/* Bolts */}
          <div className="absolute top-2 left-2 text-zinc-700"><div className="w-3 h-3 rounded-full border border-zinc-600 flex items-center justify-center bg-zinc-800 shadow-inner"><div className="w-1.5 h-1.5 bg-zinc-900 rotate-45"></div></div></div>
          <div className="absolute top-2 right-2 text-zinc-700"><div className="w-3 h-3 rounded-full border border-zinc-600 flex items-center justify-center bg-zinc-800 shadow-inner"><div className="w-1.5 h-1.5 bg-zinc-900 rotate-45"></div></div></div>
          <div className="absolute bottom-4 left-2 text-zinc-700"><div className="w-3 h-3 rounded-full border border-zinc-600 flex items-center justify-center bg-zinc-800 shadow-inner"><div className="w-1.5 h-1.5 bg-zinc-900 rotate-45"></div></div></div>
          <div className="absolute bottom-4 right-2 text-zinc-700"><div className="w-3 h-3 rounded-full border border-zinc-600 flex items-center justify-center bg-zinc-800 shadow-inner"><div className="w-1.5 h-1.5 bg-zinc-900 rotate-45"></div></div></div>

          <div className="flex items-center gap-4 md:gap-12">
            {/* ID Badge */}
            <div className="relative group flex items-center mt-2">
              {/* Lanyard Clip - Hidden on mobile */}
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-8 h-8 z-20 flex-col items-center hidden md:flex">
                  <div className="w-1 h-4 bg-zinc-400 rounded-full"></div>
                  <div className="w-6 h-3 bg-zinc-300 rounded-sm border border-zinc-400 shadow-sm"></div>
              </div>
              
              <div className="relative z-10 bg-white text-black px-2 md:px-3 py-1 md:py-2 transform rotate-1 shadow-lg drop-shadow-xl border border-gray-300 flex items-center gap-2 md:gap-3 max-w-[160px] md:max-w-[220px]">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-200 border border-gray-400 overflow-hidden grayscale contrast-125 shrink-0 relative">
                  <Image 
                    src="/mongodben.jpg" 
                    alt="Detective Mongo D. Bane" 
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="leading-tight hidden sm:block">
                  <h1 className="text-xs font-bold font-typewriter uppercase tracking-tighter">Det. Mongo D. Bane</h1>
                  <p className="text-[8px] font-mono text-red-700 font-bold">CODE CRIME UNIT</p>
                  <p className="text-[8px] font-mono text-gray-500">ID: 8492-A</p>
                </div>
                {/* Holographic Overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-30 pointer-events-none"></div>
              </div>
            </div>

            {/* System Status Bezel - Hidden on mobile */}
            <div className="hidden lg:flex flex-col bg-zinc-900 border border-zinc-700 rounded-sm p-1 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
                <div className="text-[8px] text-zinc-500 font-mono text-center uppercase tracking-widest mb-0.5 border-b border-zinc-800 pb-0.5">System Status</div>
                <div className="flex items-center gap-2">
                    {/* LED */}
                    <div className="flex items-center gap-2 px-2 py-1 border-r border-zinc-800 bg-black/40">
                        <motion.div 
                            className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"
                            animate={isHoveringNav ? { opacity: [0.2, 1, 0.2, 1, 0.5] } : { opacity: [0.5, 1, 0.5] }}
                            transition={isHoveringNav ? { duration: 0.1, repeat: Infinity } : { duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        />
                        <span className="text-[10px] font-mono text-green-500 tracking-widest uppercase">ONLINE</span>
                    </div>
                    {/* Audio Toggle */}
                    <button 
                        onClick={toggleBgm}
                        className={`flex items-center gap-2 px-2 py-1 border-r border-zinc-800 bg-black/40 hover:brightness-110 transition-all ${isBgmPlaying ? 'text-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                        title="Toggle Audio Intercept"
                    >
                        <motion.div 
                            className={`w-2 h-2 rounded-full ${isBgmPlaying ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' : 'bg-zinc-700'}`}
                            animate={isBgmPlaying ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.5 }}
                            transition={isBgmPlaying ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
                        />
                        <span className="text-[10px] font-mono tracking-widest uppercase">WIRE</span>
                    </button>
                    {/* Torch Toggle */}
                    <button 
                        onClick={() => setIsTorchEnabled(!isTorchEnabled)}
                        className={`flex items-center gap-2 px-2 py-1 transition-colors ${isTorchEnabled ? 'text-yellow-500' : 'text-gray-500 hover:text-gray-300'}`}
                        title="Toggle Flashlight"
                    >
                        <div className={`w-2 h-2 rounded-full ${isTorchEnabled ? 'bg-yellow-500 shadow-[0_0_8px_#eab308]' : 'bg-gray-600'}`}></div>
                        <span className="text-[10px] font-mono tracking-widest uppercase">LIGHT</span>
                    </button>
                </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8" onMouseEnter={() => setIsHoveringNav(true)} onMouseLeave={() => setIsHoveringNav(false)}>
            <button onClick={() => router.push('/')} className="font-typewriter font-bold text-lg text-gray-400 hover:text-green-400 transition-all hover:shadow-[0_0_8px_rgba(74,222,128,0.5)] hover:animate-flicker uppercase tracking-widest leading-none flex items-center">
              Open Case
            </button>
            <button onClick={() => router.push('/')} className="font-typewriter font-bold text-lg text-gray-400 hover:text-green-400 transition-all hover:shadow-[0_0_8px_rgba(74,222,128,0.5)] hover:animate-flicker uppercase tracking-widest flex items-center">
              Cases
            </button>
            <button onClick={() => router.push('/')} className="font-typewriter font-bold text-lg text-gray-400 hover:text-green-400 transition-all hover:shadow-[0_0_8px_rgba(74,222,128,0.5)] hover:animate-flicker uppercase tracking-widest flex items-center">
              Locker
            </button>
          </div>

          {/* Mobile Hamburger Menu */}
          <button 
            className="md:hidden p-2 text-zinc-400 hover:text-white transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-zinc-800 overflow-hidden"
            >
              <div className="px-4 py-4 flex flex-col gap-4">
                <button 
                  onClick={() => { router.push('/'); setIsMobileMenuOpen(false); }}
                  className="font-typewriter font-bold text-base text-gray-400 hover:text-green-400 transition-all uppercase tracking-widest py-2 text-left"
                >
                  Open Case
                </button>
                <button 
                  onClick={() => { router.push('/'); setIsMobileMenuOpen(false); }}
                  className="font-typewriter font-bold text-base text-gray-400 hover:text-green-400 transition-all uppercase tracking-widest py-2 text-left"
                >
                  Cases
                </button>
                <button 
                  onClick={() => { router.push('/'); setIsMobileMenuOpen(false); }}
                  className="font-typewriter font-bold text-base text-gray-400 hover:text-green-400 transition-all uppercase tracking-widest py-2 text-left"
                >
                  Locker
                </button>
                {/* Mobile System Controls */}
                <div className="flex items-center gap-4 pt-2 border-t border-zinc-800">
                  <button 
                    onClick={toggleBgm}
                    className={`flex items-center gap-2 px-3 py-2 bg-black/40 rounded-sm ${isBgmPlaying ? 'text-amber-500' : 'text-zinc-500'}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${isBgmPlaying ? 'bg-amber-500' : 'bg-zinc-700'}`}></div>
                    <span className="text-xs font-mono uppercase">Wire</span>
                  </button>
                  <button 
                    onClick={() => setIsTorchEnabled(!isTorchEnabled)}
                    className={`flex items-center gap-2 px-3 py-2 bg-black/40 rounded-sm ${isTorchEnabled ? 'text-yellow-500' : 'text-zinc-500'}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${isTorchEnabled ? 'bg-yellow-500' : 'bg-zinc-700'}`}></div>
                    <span className="text-xs font-mono uppercase">Light</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-3 md:px-4 py-6 md:py-12 relative z-10">
        <div className="mb-6 md:mb-8">
            <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 text-gray-500 hover:text-red-500 transition font-bold uppercase tracking-widest text-xs md:text-sm group"
            >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Return to Case Board
            </button>
        </div>

        <motion.div
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1.5 }}
        >
          {/* Case File Header */}
          <div className="flex flex-col lg:flex-row gap-6 md:gap-12 mb-10 md:mb-16 items-start">
            {/* Evidence Photo - Polaroid Style */}
            <div className="relative group perspective-1000 mx-auto lg:mx-0">
                {/* Paperclip Icon */}
                <div className="absolute -top-3 md:-top-4 left-1/2 -translate-x-1/2 z-30 drop-shadow-md text-zinc-400">
                    <Paperclip className="w-8 h-8 md:w-12 md:h-12 rotate-45" strokeWidth={1.5} />
                </div>
                
                <div className="w-48 md:w-72 h-auto bg-white p-2 md:p-3 pb-8 md:pb-12 shadow-2xl transform rotate-[-2deg] transition-transform group-hover:rotate-0 duration-500 ease-out">
                    <div className="w-full aspect-square bg-[#050505] relative overflow-hidden grayscale contrast-125 group-hover:grayscale-0 transition-all duration-700 border border-zinc-800">
                            {/* Image Placeholder or Icon */}
                            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                                <Radio className="w-16 h-16 md:w-24 md:h-24 text-zinc-700" />
                                {/* Evidence Watermark */}
                                <span className="absolute text-red-600 font-bold font-typewriter text-3xl md:text-5xl -rotate-[20deg] opacity-0 scale-150 group-hover:opacity-40 group-hover:scale-100 transition-all duration-200 ease-out pointer-events-none border-4 border-red-600 px-4 py-2 z-20">
                                    EVIDENCE
                                </span>
                            </div>
                            {/* Noise Overlay */}
                            <div className="absolute inset-0 opacity-30 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/noise.png')]"></div>
                    </div>
                    {/* Bottom Label */}
                    <div className="mt-2 md:mt-4 text-center font-typewriter text-xs md:text-sm text-black/80 tracking-widest font-bold">
                        EVIDENCE #8492
                    </div>
                </div>
            </div>

            {/* Case Info */}
            <div className="flex-1 space-y-4 md:space-y-6 w-full">
              <div>
                <div className="inline-block border border-zinc-700 text-zinc-500 px-2 py-0.5 text-[10px] md:text-xs font-bold tracking-[0.15em] md:tracking-[0.2em] mb-2 bg-zinc-900/50">
                  CASE FILE #{podcastId.slice(0, 6).toUpperCase()}
                </div>
                <h1 className="text-xl sm:text-2xl md:text-5xl font-bold text-[#e7e5e4] leading-none tracking-tighter mb-2 font-typewriter">
                  {podcast.script?.title || podcast.title}
                </h1>
                
                <p className="text-zinc-600 font-mono text-xs md:text-sm tracking-wider uppercase">
                  SUBJECT: <span className="text-red-600 font-bold break-all">{podcast.repo_name}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-x-4 md:gap-x-8 gap-y-3 md:gap-y-4 border-t border-b border-zinc-800 py-4 md:py-6 font-mono text-[10px] md:text-xs">
                <div className="flex flex-col">
                  <span className="text-zinc-600 uppercase tracking-widest mb-1">Clearance Level</span>
                  <span className="text-red-600 font-bold tracking-widest stamp-text">TOP SECRET // EYES ONLY</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-zinc-600 uppercase tracking-widest mb-1">Language Origin</span>
                  <span className="text-zinc-400 tracking-wider">{podcast.repo_metadata?.language || 'UNKNOWN'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-zinc-600 uppercase tracking-widest mb-1">Duration</span>
                  <span className="text-zinc-400 tracking-wider font-mono">{podcast.duration ? formatTime(podcast.duration) : '--:--'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-zinc-600 uppercase tracking-widest mb-1">Current Status</span>
                  <span className="text-red-500 font-bold tracking-widest animate-pulse font-mono shadow-[0_0_10px_rgba(239,68,68,0.4)]">
                    [ INTERCEPTED ]
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-6 pt-4">
                <button
                  onClick={() => router.push(`/story/${podcastId}`)}
                  className="relative group transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
                >
                    {/* Shadow Plate */}
                    <div className="absolute inset-0 bg-black translate-y-2 translate-x-2 rounded-sm blur-[1px]"></div>
                    
                    {/* Main Button Body */}
                    <div className="relative bg-zinc-300 text-zinc-900 px-8 py-4 font-bold uppercase tracking-widest text-sm border-2 border-zinc-600 flex items-center gap-3 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)] group-hover:bg-zinc-200 transition-colors overflow-hidden">
                        {/* Grime/Texture Overlay */}
                        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/concrete-wall.png')] mix-blend-multiply pointer-events-none"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-50 pointer-events-none"></div>
                        
                        {/* Stamped Text Effect */}
                        <FileText className="w-5 h-5 relative z-10 drop-shadow-[0_1px_0_rgba(255,255,255,0.5)]" />
                        <span className="relative z-10 drop-shadow-[0_1px_0_rgba(255,255,255,0.5)]">Open Dossier</span>
                        
                        {/* Bolted Corners */}
                        <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-zinc-500 shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]"></div>
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-zinc-500 shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]"></div>
                        <div className="absolute bottom-1 left-1 w-1.5 h-1.5 rounded-full bg-zinc-500 shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]"></div>
                        <div className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-zinc-500 shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]"></div>
                    </div>
                </button>
                {podcast.audio_url && (
                  <a
                    href={podcast.audio_url}
                    download
                    className="relative group transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
                  >
                    {/* Shadow Plate */}
                    <div className="absolute inset-0 bg-black translate-y-2 translate-x-2 rounded-sm blur-[1px]"></div>
                    
                    {/* Main Button Body */}
                    <div className="relative bg-red-900 text-white/90 px-8 py-4 font-bold uppercase tracking-widest text-sm border-2 border-zinc-900 flex items-center gap-3 shadow-[inset_0_0_30px_rgba(0,0,0,0.6)] group-hover:bg-red-800 transition-colors overflow-hidden">
                        {/* Leather/Metal Texture Overlay */}
                        <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] mix-blend-multiply pointer-events-none"></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>
                        
                        {/* Stenciled Text Effect */}
                        <Download className="w-5 h-5 relative z-10 drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]" />
                        <span className="relative z-10 drop-shadow-[0_2px_0_rgba(0,0,0,0.5)] font-stencil">Save Evidence</span>
                        
                        {/* Industrial Border Detail */}
                        <div className="absolute inset-0 border border-white/10 pointer-events-none"></div>
                    </div>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Wiretap Player - Reel-to-Reel */}
          {podcast.audio_url ? (
            <div className="w-full bg-[#1a1a1a] border-2 border-zinc-800 p-4 md:p-8 rounded-sm shadow-2xl relative overflow-hidden mb-12">
              {/* Brushed Metal Texture Overlay */}
              <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/brushed-alum.png')]" />
              
              {/* Hex Bolts */}
              <div className="absolute top-2 left-2 text-zinc-600"><div className="w-4 h-4 rounded-full border border-zinc-500 flex items-center justify-center bg-zinc-800 shadow-inner"><div className="w-2 h-2 bg-zinc-900 rotate-45"></div></div></div>
              <div className="absolute top-2 right-2 text-zinc-600"><div className="w-4 h-4 rounded-full border border-zinc-500 flex items-center justify-center bg-zinc-800 shadow-inner"><div className="w-2 h-2 bg-zinc-900 rotate-45"></div></div></div>
              <div className="absolute bottom-2 left-2 text-zinc-600"><div className="w-4 h-4 rounded-full border border-zinc-500 flex items-center justify-center bg-zinc-800 shadow-inner"><div className="w-2 h-2 bg-zinc-900 rotate-45"></div></div></div>
              <div className="absolute bottom-2 right-2 text-zinc-600"><div className="w-4 h-4 rounded-full border border-zinc-500 flex items-center justify-center bg-zinc-800 shadow-inner"><div className="w-2 h-2 bg-zinc-900 rotate-45"></div></div></div>

              <div className="relative z-10">
                <div className="flex justify-between items-center mb-8 md:mb-12 px-2 md:px-10">
                  <div className="hidden sm:block">
                    <Reel isPlaying={isPlaying} speed={4} />
                  </div>
                  
                  {/* Central Tape Head Area */}
                  <div className="flex flex-col items-center mx-4 flex-1">
                    <div className="h-24 w-full max-w-xs bg-[#050505] border-2 border-zinc-700 rounded-sm mb-4 overflow-hidden relative flex items-center justify-center shadow-[inset_0_0_20px_rgba(0,0,0,1)]">
                        {/* Grid Background */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,0,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,0,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                        
                        {/* Lie Detector Needle */}
                        <svg className="w-full h-full absolute inset-0" preserveAspectRatio="none">
                            <motion.path
                                d="M0,50 Q20,50 40,50 T80,50 T120,50 T160,50 T200,50 T240,50 T280,50 T320,50"
                                stroke="#22c55e"
                                strokeWidth="2"
                                fill="none"
                                className="drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]"
                                animate={isPlaying ? { 
                                    d: [
                                        "M0,50 Q20,40 40,60 T80,30 T120,70 T160,40 T200,60 T240,30 T280,50 T320,50",
                                        "M0,50 Q20,60 40,40 T80,70 T120,30 T160,60 T200,40 T240,70 T280,50 T320,50",
                                        "M0,50 Q20,50 40,50 T80,50 T120,50 T160,50 T200,50 T240,50 T280,50 T320,50"
                                    ]
                                } : { d: "M0,50 Q20,50 40,50 T80,50 T120,50 T160,50 T200,50 T240,50 T280,50 T320,50" }}
                                transition={{ duration: 0.2, repeat: Infinity, repeatType: "reverse" }}
                            />
                        </svg>
                        
                        {/* Scanline Overlay */}
                        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.8)_50%)] bg-[length:100%_4px] pointer-events-none"></div>
                        
                        {/* CRT Flicker */}
                        <motion.div 
                            className="absolute inset-0 bg-green-500/5 pointer-events-none"
                            animate={{ opacity: [0.1, 0.2, 0.1] }}
                            transition={{ duration: 0.1, repeat: Infinity }}
                        />
                    </div>
                    <span className="text-[10px] font-mono text-green-500 uppercase tracking-[0.2em] text-center drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]">WIRETAP INTERFACE V.0.9</span>
                  </div>

                  <div className="hidden sm:block">
                    <Reel isPlaying={isPlaying} speed={4} />
                  </div>
                </div>

                {/* Controls Panel */}
                <div className="bg-zinc-900/80 border-t border-zinc-800 p-4 md:p-6 rounded-b-sm flex flex-col gap-6 backdrop-blur-sm">
                  {/* Progress Bar styled as "Tape Head" Track */}
                  <div className="relative h-6 bg-[#0a0a0a] rounded-sm cursor-pointer group border-b border-zinc-700 shadow-[inset_0_2px_4px_rgba(0,0,0,1)] overflow-hidden">
                    {/* Track Markings */}
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_19px,#333_20px)] opacity-30"></div>
                    
                    {/* Progress Fill (Tape) */}
                    <div 
                      className="absolute top-1 bottom-1 left-0 bg-red-900/60 transition-all shadow-[0_0_10px_rgba(220,38,38,0.3)]"
                      style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
                    />
                    
                    {/* Tape Head (Thumb) */}
                    <div 
                      className="absolute top-0 bottom-0 w-1.5 bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)] transition-all z-10"
                      style={{ left: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
                    >
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-1 bg-red-400"></div>
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-1 bg-red-400"></div>
                    </div>
                    
                    <input
                      type="range"
                      min="0"
                      max={duration || 0}
                      value={currentTime}
                      onChange={handleSeek}
                      className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-20"
                    />
                  </div>

                  <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="font-mono text-green-500 text-xl bg-[#050505] px-6 py-2 rounded-sm border border-zinc-800 shadow-[inset_0_0_15px_rgba(0,0,0,1)] w-full md:w-auto text-center tracking-[0.2em] relative overflow-hidden">
                      <div className="absolute inset-0 bg-green-500/5 animate-pulse pointer-events-none"></div>
                      <span className="drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]">{formatTime(currentTime)}</span> 
                      <span className="text-zinc-700 mx-2">/</span> 
                      <span className="text-green-900 drop-shadow-none">{formatTime(duration)}</span>
                    </div>

                    <div className="flex items-center gap-6">
                      <button onClick={() => skip(-10)} className="p-2 text-zinc-500 hover:text-white transition-colors"><SkipBack size={24} /></button>
                      <button 
                        onClick={togglePlay}
                        className="w-16 h-16 bg-gradient-to-b from-red-900 to-red-950 hover:from-red-800 hover:to-red-900 text-red-100 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(127,29,29,0.5)] transition-all active:scale-95 border-4 border-zinc-800 ring-1 ring-zinc-600 group"
                      >
                        {isPlaying ? <Pause fill="currentColor" size={28} className="drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" /> : <Play fill="currentColor" className="ml-1 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" size={28} />}
                      </button>
                      <button onClick={() => skip(10)} className="p-2 text-zinc-500 hover:text-white transition-colors"><SkipForward size={24} /></button>
                    </div>

                    <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-md border border-zinc-800 w-full md:w-auto justify-center">
                      <button onClick={toggleMute} className="text-zinc-500 hover:text-red-500 transition-colors">
                        {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                      </button>
                      <div className="w-24 h-1 bg-zinc-800 rounded-full overflow-hidden relative shadow-inner">
                        <div 
                          className="h-full bg-red-900/80 absolute top-0 left-0 shadow-[0_0_8px_rgba(153,27,27,0.5)]" 
                          style={{ width: isMuted ? '0%' : `${volume * 100}%` }}
                        />
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700 text-center">
              <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Audio Not Available</h3>
              <p className="text-gray-400 mb-4">
                The audio for this podcast hasn&apos;t been generated yet.
              </p>
              <button
                onClick={() => router.push(`/story/${podcastId}`)}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Go to Story Editor
              </button>
            </div>
          )}

          {/* Transcript Preview - Dossier Style */}
          {podcast.script?.segments && (
            <div className="mt-8 relative">
              <div className="absolute -top-3 -left-2 bg-red-700 text-white text-xs font-bold px-2 py-1 transform -rotate-2 shadow z-20">
                CONFIDENTIAL
              </div>
              <div className="bg-[#fdfbf7] text-black p-4 md:p-8 shadow-xl relative font-typewriter border-l-4 border-red-900">
                <div className="absolute top-0 right-0 w-16 h-16 border-t-[20px] border-r-[20px] border-t-gray-300 border-r-transparent transform rotate-90 opacity-50"></div>
                
                <h2 className="text-xl font-bold mb-6 border-b-2 border-black pb-2 uppercase tracking-widest flex justify-between items-center">
                  <span>Transcript Log</span>
                  <span className="text-xs font-normal bg-black text-white px-2 py-0.5">UNCLASSIFIED</span>
                </h2>
                
                <div className="space-y-6">
                  {podcast.script.segments.slice(0, 5).map((segment, index) => (
                    <div key={index} className="flex gap-4">
                      <div className="w-24 flex-shrink-0 text-xs font-bold uppercase text-gray-500 pt-1 text-right">
                        {segment.speaker}
                      </div>
                      <div className="flex-1 relative">
                        <p className="leading-relaxed">
                          {segment.text}
                        </p>
                        {/* Redacted bar effect (visual only for now) */}
                        {Math.random() > 0.8 && (
                          <span className="absolute top-0 left-10 bg-black h-4 w-20 opacity-10"></span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {podcast.script.segments.length > 5 && (
                  <div className="mt-8 text-center border-t border-dashed border-gray-400 pt-4">
                    <button
                      onClick={() => router.push(`/story/${podcastId}`)}
                      className="text-red-800 font-bold hover:underline uppercase tracking-widest text-sm"
                    >
                      [ Access Full Dossier ]
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
