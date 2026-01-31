'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import {
  Mic,
  Radio,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Activity,
  Wifi,
  Lock,
  HardDrive
} from 'lucide-react';
import { useAudio } from '@/components/layout/AudioProvider';

interface RecordingStatus {
  status: 'pending' | 'recording' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
  currentSegment?: number;
  totalSegments?: number;
}

export default function RecordingPage() {
  const params = useParams();
  const router = useRouter();
  const podcastId = params.id as string;
  const { isPlaying: isBgmPlaying, toggleAudio: toggleBgm } = useAudio();

  const [status, setStatus] = useState<RecordingStatus>({
    status: 'pending',
    progress: 0,
    message: 'Initializing audio generation...',
  });
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isHoveringNav, setIsHoveringNav] = useState(false);

  // Polygraph Data
  const [polygraphPoints, setPolygraphPoints] = useState<number[]>(new Array(50).fill(50));

  useEffect(() => {
    // Animate Polygraph
    const interval = setInterval(() => {
      setPolygraphPoints(prev => {
        const newPoints = [...prev.slice(1), Math.random() * 100];
        return newPoints;
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const pollStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/podcasts/${podcastId}/audio-status`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get status');
      }

      setStatus(data);

      if (data.status === 'completed') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        // Redirect to podcast player after a short delay
        setTimeout(() => {
          router.push(`/podcast/${podcastId}`);
        }, 2000);
      } else if (data.status === 'error') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        setError(data.message);
      }
    } catch (err) {
      console.error('Failed to poll status:', err);
    }
  }, [podcastId, router]);

  useEffect(() => {
    // Start polling for status
    pollStatus();
    intervalRef.current = setInterval(pollStatus, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [pollStatus]);

  const getStatusText = () => {
    switch (status.status) {
      case 'pending':
        return 'ESTABLISHING SECURE CONNECTION...';
      case 'recording':
        return 'SIGNAL INTERCEPTED';
      case 'processing':
        return 'DECRYPTING CONFESSION DATA...';
      case 'completed':
        return 'EVIDENCE SECURED';
      case 'error':
        return 'SIGNAL LOST';
      default:
        return 'INITIALIZING...';
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center font-mono">
        <div className="text-center max-w-md mx-auto border border-red-900/50 p-8 bg-red-950/10 rounded-sm">
          <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4 animate-pulse" />
          <h1 className="text-2xl font-bold text-red-500 mb-2 tracking-widest font-special-elite">SIGNAL LOST</h1>
          <p className="text-red-400/60 mb-6 text-sm">{error}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => router.push(`/story/${podcastId}`)}
              className="px-4 py-2 border border-red-800 text-red-500 hover:bg-red-900/20 transition uppercase text-xs tracking-widest"
            >
              Return to Case File
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2 }}
      className="min-h-screen bg-[#050505] text-[#e7e5e4] font-mono relative overflow-hidden flex flex-col"
    >
      {/* Navbar */}
      <motion.nav 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] w-full max-w-5xl bg-zinc-950/90 backdrop-blur-sm border border-zinc-800 shadow-2xl rounded-sm"
      >
        {/* Texture Overlay */}
        <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay" style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/brushed-alum.png")'}}></div>
        
        {/* Yellow Tape Border at Bottom */}
        <div className="absolute bottom-0 left-0 w-full h-1.5 bg-yellow-500 overflow-hidden flex items-center rounded-b-sm">
           <div className="w-full h-full bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)] opacity-20"></div>
        </div>

        <div className="px-6 h-24 flex items-center justify-between relative">
          {/* Bolts */}
          <div className="absolute top-2 left-2 text-zinc-700"><div className="w-3 h-3 rounded-full border border-zinc-600 flex items-center justify-center bg-zinc-800 shadow-inner"><div className="w-1.5 h-1.5 bg-zinc-900 rotate-45"></div></div></div>
          <div className="absolute top-2 right-2 text-zinc-700"><div className="w-3 h-3 rounded-full border border-zinc-600 flex items-center justify-center bg-zinc-800 shadow-inner"><div className="w-1.5 h-1.5 bg-zinc-900 rotate-45"></div></div></div>
          <div className="absolute bottom-4 left-2 text-zinc-700"><div className="w-3 h-3 rounded-full border border-zinc-600 flex items-center justify-center bg-zinc-800 shadow-inner"><div className="w-1.5 h-1.5 bg-zinc-900 rotate-45"></div></div></div>
          <div className="absolute bottom-4 right-2 text-zinc-700"><div className="w-3 h-3 rounded-full border border-zinc-600 flex items-center justify-center bg-zinc-800 shadow-inner"><div className="w-1.5 h-1.5 bg-zinc-900 rotate-45"></div></div></div>

          <div className="flex items-center gap-12">
            {/* ID Badge */}
            <div className="relative group flex items-center mt-2">
              {/* Lanyard Clip */}
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-8 h-8 z-20 flex flex-col items-center">
                  <div className="w-1 h-4 bg-zinc-400 rounded-full"></div>
                  <div className="w-6 h-3 bg-zinc-300 rounded-sm border border-zinc-400 shadow-sm"></div>
              </div>
              
              <div className="relative z-10 bg-white text-black px-3 py-2 transform rotate-1 shadow-lg drop-shadow-xl border border-gray-300 flex items-center gap-3 max-w-[220px]">
                <div className="w-10 h-10 bg-gray-200 border border-gray-400 overflow-hidden grayscale contrast-125 shrink-0 relative">
                  <Image 
                    src="/mongodben.jpg" 
                    alt="Det. Mongo D. Bane" 
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="leading-tight">
                  <h1 className="text-xs font-bold font-typewriter uppercase tracking-tighter">Det. Mongo D. Bane</h1>
                  <p className="text-[8px] font-mono text-red-700 font-bold">CODE CRIME UNIT</p>
                  <p className="text-[8px] font-mono text-gray-500">ID: 8492-A</p>
                </div>
                {/* Holographic Overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-30 pointer-events-none"></div>
              </div>
            </div>

            {/* System Status Bezel */}
            <div className="flex flex-col bg-zinc-900 border border-zinc-700 rounded-sm p-1 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
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
                </div>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 pt-32 relative z-10">
        
        {/* Central Interception Component */}
        <div className="relative w-full max-w-2xl">
          
          {/* Vacuum Tube / Oscilloscope Container */}
          <div className="relative mx-auto w-64 h-64 mb-12">
             {/* Glass Tube Effect */}
             <div className="absolute inset-0 rounded-full bg-gradient-to-b from-zinc-800/20 to-zinc-900/80 border border-zinc-700/50 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-sm overflow-hidden">
                {/* Inner Glow */}
                <div className="absolute inset-0 bg-radial-gradient from-red-900/10 to-transparent opacity-50"></div>
                
                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/graphy.png')] opacity-20 mix-blend-overlay"></div>

                {/* Oscilloscope Line (Polygraph) */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-full h-full opacity-80" preserveAspectRatio="none">
                    <motion.path
                      d={`M ${polygraphPoints.map((p, i) => `${i * 2} ${p}`).join(' L ')}`}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="0.5"
                      className="drop-shadow-[0_0_2px_rgba(239,68,68,0.8)]"
                    />
                  </svg>
                </div>

                {/* Scanline */}
                <motion.div 
                  animate={{ top: ['0%', '100%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="absolute left-0 right-0 h-1 bg-red-500/20 blur-sm"
                />
             </div>
             
             {/* Tube Base */}
             <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-48 h-8 bg-zinc-900 border border-zinc-700 rounded-b-lg shadow-lg flex justify-center gap-4 items-center">
                <div className="w-2 h-2 rounded-full bg-red-900 animate-pulse"></div>
                <div className="w-2 h-2 rounded-full bg-red-900 animate-pulse delay-75"></div>
                <div className="w-2 h-2 rounded-full bg-red-900 animate-pulse delay-150"></div>
             </div>
          </div>

          {/* Status Text */}
          <div className="text-center mb-12 space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold text-red-600 font-special-elite tracking-widest animate-pulse drop-shadow-[0_0_10px_rgba(220,38,38,0.5)]">
              {status.status === 'recording' ? 'SIGNAL INTERCEPTED' : getStatusText()}
            </h1>
            <p className="text-zinc-500 font-courier text-sm tracking-widest uppercase">
              {status.status === 'processing' ? 'DECRYPTING CONFESSION DATA...' : status.message}
            </p>
          </div>

          {/* Magnetic Tape Progress Bar */}
          <div className="relative h-12 bg-zinc-900 border-y-2 border-zinc-800 mb-16 flex items-center overflow-hidden">
             {/* Tape Texture */}
             <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,#333_2px,#333_4px)]"></div>
             
             {/* Progress Fill */}
             <motion.div 
               initial={{ width: 0 }}
               animate={{ width: `${status.progress}%` }}
               className="h-full bg-red-900/40 border-r-2 border-red-600 relative"
             >
                {/* Tape Head Indicator */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-4 h-8 bg-zinc-300 rounded-sm shadow-lg border border-zinc-500 z-10 flex flex-col justify-center items-center gap-1">
                   <div className="w-3 h-0.5 bg-black"></div>
                   <div className="w-3 h-0.5 bg-black"></div>
                </div>
             </motion.div>

             {/* Time Markers */}
             <div className="absolute bottom-0 left-0 w-full flex justify-between px-2 text-[8px] text-zinc-600 font-mono">
                <span>00:00</span>
                <span>00:15</span>
                <span>00:30</span>
                <span>00:45</span>
             </div>
          </div>

          {/* Forensic Stats (Floating) */}
          <div className="absolute top-0 left-0 -translate-x-12 -translate-y-4 hidden md:block">
             <div className="text-[10px] text-green-500/80 font-mono flex flex-col gap-1 animate-pulse">
                <span className="flex items-center gap-2"><Wifi size={10} /> FREQ: 94.2MHz</span>
                <span className="flex items-center gap-2"><Lock size={10} /> ENCRYPTION: BYPASSED</span>
             </div>
          </div>
          <div className="absolute top-0 right-0 translate-x-12 -translate-y-4 hidden md:block text-right">
             <div className="text-[10px] text-green-500/80 font-mono flex flex-col gap-1 animate-pulse">
                <span className="flex items-center gap-2 justify-end">PACKETS: CAPTURED <Activity size={10} /></span>
                <span className="flex items-center gap-2 justify-end">BUFFER: 128KB <HardDrive size={10} /></span>
             </div>
          </div>

          {/* Case ID Badge (Dymo Label) */}
          <div className="flex justify-center">
             <div className="bg-zinc-800 p-2 rounded-sm shadow-lg border border-zinc-700 transform rotate-1">
                <div className="bg-black px-4 py-1 shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)] border-t border-zinc-700/50">
                   <span className="font-mono text-white text-lg tracking-[0.2em] uppercase font-bold" style={{textShadow: '1px 1px 0 #666'}}>
                      CASE #{podcastId.slice(0, 8).toUpperCase()}
                   </span>
                </div>
             </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
}
