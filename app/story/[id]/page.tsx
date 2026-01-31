'use client';

import Image from 'next/image';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Mic,
  X,
  Download,
  Share2,
  Printer,
  Fingerprint,
  Siren,
  Menu,
} from 'lucide-react';
import DevelopingEvidence from '@/components/ui/DevelopingEvidence';
import { useAudio } from '@/components/layout/AudioProvider';

interface ScriptSegment {
  speaker: string;
  text: string;
  emotion?: string;
  sound_effect?: string;
  startTime?: number;
  endTime?: number;
  duration?: number;
}

interface PodcastScript {
  title: string;
  narrator_voice?: string;
  dramatic_arc?: string;
  segments: ScriptSegment[];
}

interface Podcast {
  id: string;
  repo_name: string;
  title: string;
  status: string;
  audio_url?: string;
  duration?: number;
  script?: PodcastScript;
  repo_metadata?: {
    name: string;
    description: string;
    language: string;
    stars: number;
  };
}

// Reel Component for the Player
const Reel = ({ isPlaying, speed }: { isPlaying: boolean; speed: number }) => (
  <motion.div 
    animate={{ rotate: isPlaying ? 360 : 0 }}
    transition={{ repeat: Infinity, duration: speed, ease: "linear" }}
    className="relative w-24 h-24 md:w-32 md:h-32 rounded-full border-8 border-zinc-800 bg-[#0a0a0a] shadow-[0_0_15px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(0,0,0,1)] flex items-center justify-center shrink-0 overflow-hidden"
  >
    {/* Brushed Metal Texture */}
    <div className="absolute inset-0 opacity-30 rounded-full bg-[url('https://www.transparenttextures.com/patterns/brushed-alum.png')]" />
    
    {/* Tape Mass (Dark Brown) */}
    <div className="absolute inset-1 rounded-full border-24 border-[#2a2018] opacity-90" />
    
    {/* Metal Spokes Container - Centered */}
    <div className="absolute inset-0 flex items-center justify-center">
        {[0, 45, 90, 135].map((deg) => (
            <div 
                key={deg}
                className="absolute w-full h-2 bg-linear-to-b from-zinc-300 to-zinc-500 shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
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

const RedactedText = ({ text, reveal = false }: { text: string; reveal?: boolean }) => {
  if (!text) return null;

  return (
    <span className="font-typewriter">
      {text.split(' ').map((word, i) => {
        // Deterministic redaction based on word length and index
        // If reveal is true, we never redact
        const shouldRedact = !reveal && (word.length > 4 && (i * 7) % 10 > 7); 
        return (
          <span key={i} className="relative inline-block mr-1.5 group">
            <span className={`relative z-10 ${shouldRedact ? "bg-black text-black group-hover:bg-transparent group-hover:text-inherit transition-colors duration-300 cursor-help print:bg-black print:text-black" : ""}`}>
              {word}
            </span>
            {shouldRedact && (
              <span className="absolute inset-0 bg-black opacity-10 group-hover:opacity-0 transition-opacity duration-300 z-0 blur-[1px] print:hidden"></span>
            )}
          </span>
        );
      })}
    </span>
  );
};

export default function StoryEditorPage() {
  const params = useParams();
  const router = useRouter();
  const podcastId = params.id as string;

  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSegment, setEditingSegment] = useState<number | null>(null);
  const [editedText, setEditedText] = useState('');
  const [saving, setSaving] = useState(false);
  const [isCreatingPodcast, setIsCreatingPodcast] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const SEGMENTS_PER_PAGE = 5;

  // Export State
  const [printMode, setPrintMode] = useState<'redacted' | 'classified' | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCopiedNotification, setShowCopiedNotification] = useState(false);
  
  // Visual Effects State
  const [isTorchEnabled, setIsTorchEnabled] = useState(true);
  const [showShutter, setShowShutter] = useState(true);
  const [isHoveringNav, setIsHoveringNav] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isPlaying: isBgmPlaying, toggleAudio: toggleBgm } = useAudio();
  
  // Player State (if audio exists)
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleTimeUpdate = () => {
    if (!audioRef.current || !podcast?.script?.segments) return;
    
    const currentTime = audioRef.current.currentTime;
    
    // Find the active segment
    const index = podcast.script.segments.findIndex(seg => 
      (seg.startTime ?? 0) <= currentTime && (seg.endTime ?? Infinity) > currentTime
    );
    
    if (index !== -1 && index !== activeSegmentIndex) {
      setActiveSegmentIndex(index);
      
      // If pagination is active, switch page if needed
      const pageForSegment = Math.floor(index / SEGMENTS_PER_PAGE) + 1;
      if (pageForSegment !== currentPage) {
        setCurrentPage(pageForSegment);
      }
    }
  };

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeSegmentIndex !== null) {
      const element = document.getElementById(`segment-${activeSegmentIndex}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeSegmentIndex]);

  const togglePlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error("Playback failed:", e));
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    if (printMode) {
      // Small delay to allow state to update before printing
      const timer = setTimeout(() => {
        window.print();
        // Reset after print dialog closes (or immediately, as print blocks)
        // In many browsers window.print() blocks, so this runs after.
        // But to be safe/UX friendly, we might want to keep it or reset it manually.
        // For now, let's reset it after a delay or on user action.
        // Actually, better to reset it after a timeout to ensure the print view was captured.
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [printMode]);

  // Reset print mode when returning to normal view
  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintMode(null);
      setShowExportMenu(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  useEffect(() => {
    // Camera Shutter Effect
    const timer = setTimeout(() => setShowShutter(false), 1000);
    return () => clearTimeout(timer);
  }, []);

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

  const fetchPodcast = useCallback(async () => {
    try {
      const response = await fetch(`/api/podcasts/${podcastId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch podcast');
      }

      // Calculate start/end times if missing
      if (data.script && data.script.segments) {
        let currentTime = 0;
        data.script.segments = data.script.segments.map((seg: ScriptSegment) => {
            // Use existing times if available, otherwise calculate
            const startTime = seg.startTime ?? currentTime;
            const textLength = seg.text ? seg.text.length : 0;
            const duration = seg.duration || (textLength / 15); // Estimate ~15 chars per second if no duration
            const endTime = seg.endTime ?? (startTime + duration);
            
            currentTime = endTime;
            
            return {
                ...seg,
                startTime,
                endTime,
                duration
            };
        });
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

  const startEditing = (index: number, text: string) => {
    setEditingSegment(index);
    setEditedText(text);
  };

  const cancelEditing = () => {
    setEditingSegment(null);
    setEditedText('');
  };

  const saveSegment = async (index: number) => {
    if (!podcast?.script) return;

    setSaving(true);
    try {
      const updatedSegments = [...podcast.script.segments];
      updatedSegments[index] = {
        ...updatedSegments[index],
        text: editedText,
      };

      const response = await fetch(`/api/podcasts/${podcastId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: {
            ...podcast.script,
            segments: updatedSegments,
          },
        }),
      });

      if (response.ok) {
        setPodcast({
          ...podcast,
          script: {
            ...podcast.script,
            segments: updatedSegments,
          },
        });
        setEditingSegment(null);
        setEditedText('');
      }
    } catch (err) {
      console.error('Failed to save segment:', err);
    } finally {
      setSaving(false);
    }
  };

  const createPodcast = async () => {
    setIsCreatingPodcast(true);
    try {
      const response = await fetch(`/api/podcasts/${podcastId}/generate-audio`, {
        method: 'POST',
      });

      if (response.ok) {
        // Redirect to recording page
        router.push(`/recording/${podcastId}`);
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start podcast generation');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create podcast');
      setIsCreatingPodcast(false);
    }
  };

  const getSpeakerLabel = (speaker: string) => {
    if (!speaker) return 'UNKNOWN';
    const s = speaker.toLowerCase();
    if (s.includes('1') || s.includes('host') || s.includes('narrator')) return 'INTERROGATOR';
    if (s.includes('2') || s.includes('guest')) return 'WITNESS';
    return 'SUBJECT';
  };

  // Download script as txt file
  const handleDownloadScript = () => {
    if (!podcast?.script) return;
    
    const script = podcast.script;
    let content = `CASE FILE: ${script.title || podcast.title}\n`;
    content += `${'='.repeat(50)}\n\n`;
    content += `Repository: ${podcast.repo_name}\n`;
    content += `Dramatic Arc: ${script.dramatic_arc || 'N/A'}\n`;
    content += `${'='.repeat(50)}\n\n`;
    content += `TRANSCRIPT\n`;
    content += `${'-'.repeat(50)}\n\n`;
    
    script.segments.forEach((segment, index) => {
      const speaker = getSpeakerLabel(segment.speaker).toUpperCase();
      content += `[${String(index + 1).padStart(2, '0')}] ${speaker}:\n`;
      content += `${segment.text}\n`;
      if (segment.emotion) content += `  (${segment.emotion})\n`;
      if (segment.sound_effect) content += `  [SFX: ${segment.sound_effect}]\n`;
      content += `\n`;
    });
    
    content += `${'-'.repeat(50)}\n`;
    content += `END OF TRANSCRIPT\n`;
    content += `Generated by Detective Mongo D. Bane - Code Crime Unit\n`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `case-file-${podcast.repo_name.replace('/', '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Share/copy link to clipboard
  const handleShareLink = async () => {
    const url = window.location.href;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: podcast?.script?.title || podcast?.title || 'Case File',
          text: `Check out this code investigation: ${podcast?.repo_name}`,
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setShowCopiedNotification(true);
        setTimeout(() => setShowCopiedNotification(false), 2000);
      }
    } catch {
      // Fallback to clipboard
      await navigator.clipboard.writeText(url);
      setShowCopiedNotification(true);
      setTimeout(() => setShowCopiedNotification(false), 2000);
    }
  };

  // Scroll to dossier/interrogation log
  const scrollToDossier = () => {
    const element = document.getElementById('interrogation-log');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (loading) {
    return <DevelopingEvidence />;
  }

  if (error || !podcast) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">ACCESS DENIED</h1>
          <p className="text-gray-400 mb-4">{error || 'File not found'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition uppercase tracking-widest"
          >
            Return to HQ
          </button>
        </div>
      </div>
    );
  }

  const script = podcast.script;
  
  const totalPages = script ? Math.ceil(script.segments.length / SEGMENTS_PER_PAGE) : 0;
  const displayedSegments = (printMode || !script) ? (script?.segments || []) : script.segments.slice((currentPage - 1) * SEGMENTS_PER_PAGE, currentPage * SEGMENTS_PER_PAGE);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      // Play paper flip sound if available (simulated here with visual feedback)
      setCurrentPage(newPage);
      window.scrollTo({ top: document.getElementById('interrogation-log')?.offsetTop || 0, behavior: 'smooth' });
    }
  };

  const handleExport = (mode: 'redacted' | 'classified') => {
    setPrintMode(mode);
    setShowExportMenu(false);
  };

  return (
    <div className={`min-h-screen bg-[#050505] text-[#e7e5e4] font-typewriter relative overflow-x-hidden ${printMode ? 'print-mode' : ''}`}>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          body {
            background: #f0e6d2 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-hidden {
            display: none !important;
          }
          .print-visible {
            display: block !important;
          }
          /* Ensure the log container takes full width/height */
          .interrogation-log-container {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            box-shadow: none !important;
            transform: none !important;
            min-height: 100vh !important;
          }
        }
      `}</style>

      {/* Camera Shutter Effect */}
      <AnimatePresence>
        {showShutter && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="fixed inset-0 bg-white z-100 pointer-events-none mix-blend-overlay"
          />
        )}
      </AnimatePresence>

      {/* Global Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
         {/* Film Grain */}
         <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/noise.png")'}}></div>
         {/* Vignette */}
         <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/40 to-black/90"></div>
      </div>
      
      {isTorchEnabled && <div className="flashlight-container flashlight-overlay"></div>}

      {/* Rack-Mounted Detective Console Navbar */}
      <motion.nav 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative mx-auto mt-2 md:mt-6 z-50 w-[95%] md:w-full max-w-5xl bg-zinc-950/90 backdrop-blur-sm border border-zinc-800 shadow-2xl rounded-sm"
      >
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
              
              <div className="relative z-10 bg-white text-black px-2 md:px-3 py-1 md:py-2 transform rotate-1 shadow-lg drop-shadow-xl border border-gray-300 flex items-center gap-2 md:gap-3 max-w-[140px] md:max-w-55">
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
                <div className="absolute inset-0 bg-linear-to-tr from-transparent via-white/20 to-transparent opacity-30 pointer-events-none"></div>
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
                        className={`flex items-center gap-2 px-2 py-1 border-r border-zinc-800 bg-black/40 hover:brightness-110 transition-all ${isBgmPlaying || isPlaying ? 'text-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                        title="Toggle Audio Intercept"
                    >
                        <motion.div 
                            className={`w-2 h-2 rounded-full ${isBgmPlaying || isPlaying ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' : 'bg-zinc-700'}`}
                            animate={isBgmPlaying || isPlaying ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.5 }}
                            transition={isBgmPlaying || isPlaying ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
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
                    className={`flex items-center gap-2 px-3 py-2 bg-black/40 rounded-sm ${isBgmPlaying || isPlaying ? 'text-amber-500' : 'text-zinc-500'}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${isBgmPlaying || isPlaying ? 'bg-amber-500' : 'bg-zinc-700'}`}></div>
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
      </motion.nav>

      {/* Main Content */}
      <motion.main 
        initial={{ opacity: 0, filter: 'blur(10px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="max-w-5xl mx-auto px-3 md:px-4 py-6 md:py-12 relative z-10"
      >
        
        <div className="mb-6 md:mb-8">
            <button
                onClick={() => router.push(`/podcast/${podcastId}`)}
                className="flex items-center gap-2 text-gray-500 hover:text-red-500 transition font-bold uppercase tracking-widest text-xs md:text-sm group"
            >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Back to Evidence Board
            </button>
        </div>

        {/* Top Secret Header */}
        <div className="relative mb-10 md:mb-16 border-b-4 border-zinc-800 pb-6 md:pb-8">
          <div className="absolute top-0 right-0 transform rotate-12 opacity-10 pointer-events-none hidden md:block">
             <Fingerprint className="w-48 md:w-64 h-48 md:h-64 text-white" />
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start gap-6 md:gap-8">
            <div className="relative">
              <div className="absolute -top-4 md:-top-6 -left-4 md:-left-6 border-2 md:border-4 border-red-800 text-red-800 px-2 md:px-4 py-1 md:py-2 text-lg md:text-2xl font-bold transform -rotate-12 opacity-80 mask-stamp z-20 bg-red-900/10 backdrop-blur-sm">
                CONFIDENTIAL
              </div>
              <h1 className="text-xl sm:text-2xl md:text-5xl font-bold mb-3 md:mb-4 mt-4 leading-tight max-w-2xl text-[#e7e5e4]">
                {script?.title || podcast.title}
              </h1>
              <div className="flex flex-wrap gap-2 md:gap-4 text-[10px] md:text-sm font-bold text-gray-400 uppercase tracking-wider font-mono">
                <span className="bg-zinc-900 border border-zinc-700 px-2 py-1 text-red-500 break-all">Target: {podcast.repo_name}</span>
                <span className="border border-zinc-700 px-2 py-1">Lang: {podcast.repo_metadata?.language || 'Unknown'}</span>
                <span className="border border-zinc-700 px-2 py-1">Stars: {podcast.repo_metadata?.stars || 0}</span>
              </div>
            </div>

            {/* Psychological Profile Box - Sticky Note */}
            <div className="w-full md:w-80 bg-[#fef3c7] text-black p-4 md:p-6 shadow-lg transform rotate-0 md:rotate-2 relative font-handwriting">
              {/* Push Pin */}
              <div className="absolute -top-2 md:-top-3 left-1/2 transform -translate-x-1/2 z-20">
                <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-red-600 shadow-md border border-red-800"></div>
                <div className="w-0.5 md:w-1 h-1.5 md:h-2 bg-gray-400 mx-auto"></div>
              </div>
              
              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-black/10 w-12 md:w-16 h-3 md:h-4 blur-sm"></div>

              <div className="text-[10px] md:text-xs font-bold uppercase tracking-widest mb-1 md:mb-2 border-b border-black/20 pb-1 text-red-800">
                Psychological Profile
              </div>
              <p className="text-xs md:text-sm leading-relaxed font-typewriter text-gray-800">
                &ldquo;{script?.dramatic_arc || "Subject shows signs of complex architectural patterns. Motive unclear."}&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* Audio Wiretap Integration */}
        <div className="mb-16 relative">
          <div className="bg-[#1a1a1a] p-6 rounded-sm shadow-2xl border-2 border-zinc-800 relative overflow-hidden">
            {/* Brushed Metal Texture Overlay */}
            <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/brushed-alum.png')]" />
            
            {/* Hex Bolts */}
            <div className="absolute top-2 left-2 text-zinc-600"><div className="w-3 h-3 rounded-full border border-zinc-500 flex items-center justify-center bg-zinc-800 shadow-inner"><div className="w-1.5 h-1.5 bg-zinc-900 rotate-45"></div></div></div>
            <div className="absolute top-2 right-2 text-zinc-600"><div className="w-3 h-3 rounded-full border border-zinc-500 flex items-center justify-center bg-zinc-800 shadow-inner"><div className="w-1.5 h-1.5 bg-zinc-900 rotate-45"></div></div></div>
            <div className="absolute bottom-2 left-2 text-zinc-600"><div className="w-3 h-3 rounded-full border border-zinc-500 flex items-center justify-center bg-zinc-800 shadow-inner"><div className="w-1.5 h-1.5 bg-zinc-900 rotate-45"></div></div></div>
            <div className="absolute bottom-2 right-2 text-zinc-600"><div className="w-3 h-3 rounded-full border border-zinc-500 flex items-center justify-center bg-zinc-800 shadow-inner"><div className="w-1.5 h-1.5 bg-zinc-900 rotate-45"></div></div></div>

            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs text-green-500 font-mono uppercase tracking-[0.2em] border border-green-900/50 px-3 py-1 bg-black/80 shadow-[0_0_10px_rgba(34,197,94,0.2)] animate-pulse">
              Surveillance Device Mk.IV
            </div>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-12 py-8 relative z-10">
              <div className="hidden sm:block">
                <Reel isPlaying={isPlaying && activeSegmentIndex !== null} speed={4} />
              </div>
              
              <div className="flex flex-col items-center gap-6 z-10">
                {podcast.audio_url ? (
                  <div className="flex gap-4">
                    <audio 
                        ref={audioRef} 
                        src={podcast.audio_url} 
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={() => setIsPlaying(false)}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                    />
                    <button 
                      onClick={togglePlayback}
                      className="w-20 h-20 bg-linear-to-b from-zinc-800 to-zinc-900 rounded-full border-4 border-zinc-700 shadow-[0_0_20px_rgba(0,0,0,0.8),inset_0_2px_5px_rgba(255,255,255,0.1)] flex items-center justify-center hover:brightness-110 transition active:scale-95 group relative overflow-hidden"
                    >
                      {/* Button Texture */}
                      <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] mix-blend-multiply" />
                      
                      {isPlaying ? (
                        <div className="w-6 h-6 bg-red-500 shadow-[0_0_15px_#ef4444] animate-pulse"></div>
                      ) : (
                        <div className="w-0 h-0 border-t-12 border-t-transparent border-l-24 border-l-zinc-400 border-b-12 border-b-transparent ml-2 drop-shadow-md group-hover:border-l-white transition-colors"></div>
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={createPodcast}
                    disabled={isCreatingPodcast}
                    className="px-8 py-4 bg-red-900 text-white font-bold uppercase tracking-widest border-2 border-red-700 shadow-lg hover:bg-red-800 transition active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.2)_10px,rgba(0,0,0,0.2)_20px)]"></div>
                    <span className="relative z-10 flex items-center gap-2">
                        {isCreatingPodcast ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Initializing...
                        </>
                        ) : (
                        <>
                            <Mic className="w-5 h-5" />
                            Initiate Wiretap
                        </>
                        )}
                    </span>
                  </button>
                )}
                
                <div className="h-20 w-80 bg-black border-4 border-zinc-700 rounded-lg relative overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,1)]">
                  {/* CRT Scanlines */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-size-[100%_4px,6px_100%] pointer-events-none"></div>
                  
                  {/* Grid */}
                  <div className="absolute inset-0 bg-[linear-gradient(transparent_19px,#333_20px),linear-gradient(90deg,transparent_19px,#333_20px)] bg-size-[20px_20px] opacity-20 z-10"></div>

                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-px bg-red-900/30"></div>
                  </div>
                  
                  {/* Waveform animation */}
                  <motion.div 
                    animate={{ opacity: isPlaying ? 1 : 0.5 }}
                    className="w-full h-full flex items-center justify-center gap-0.5 px-4 relative z-10"
                  >
                    {Array.from({ length: 50 }).map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{ 
                            height: isPlaying ? [2, Math.random() * 50 + 5, 2] : 2,
                            backgroundColor: isPlaying ? '#ef4444' : '#7f1d1d'
                        }}
                        transition={{ repeat: Infinity, duration: 0.1, delay: i * 0.01, repeatType: "reverse" }}
                        className="w-1 rounded-full shadow-[0_0_8px_#ff0000] blur-[0.5px]"
                      />
                    ))}
                  </motion.div>
                  
                  {/* Scanline Overlay */}
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#000_3px)] opacity-10 pointer-events-none z-30"></div>
                </div>
              </div>

              <div className="hidden sm:block">
                <Reel isPlaying={isPlaying && activeSegmentIndex !== null} speed={4} />
              </div>
            </div>
          </div>
        </div>

        {/* Interrogation Transcript - Manila Folder Style */}
        <div id="interrogation-log" className="interrogation-log-container scrollbar-hide bg-[#f0e6d2] w-full max-w-[95vw] md:max-w-4xl p-4 md:p-16 shadow-2xl relative min-h-screen mx-auto transform rotate-[0.5deg] transition-all duration-500">
          {/* Paper Texture */}
          <div className="absolute inset-0 opacity-40 pointer-events-none mix-blend-multiply z-0" style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/paper-fibers.png")'}}></div>
          {/* Static Grain for Print */}
          <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-multiply z-0 bg-[url('/grain.gif')]"></div>
          
          {/* Watermark for Classified Mode */}
          {printMode === 'classified' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
              <div className="transform -rotate-45 text-red-900/10 text-[15vw] font-bold font-mono whitespace-nowrap select-none border-8 border-red-900/10 p-12 mask-stamp">
                TOP SECRET
              </div>
            </div>
          )}

          {/* Folder Tab */}
          <div className="absolute -top-8 left-0 w-1/3 h-10 bg-[#f0e6d2] rounded-t-lg border-t border-l border-r border-[#d4c5a9] print-hidden"></div>
          <div className="absolute -top-6 left-4 text-xs font-bold uppercase tracking-widest text-gray-500 z-10 print-hidden">
            Case #{podcastId.slice(0, 8)}
          </div>

          {/* Time Stamps */}
          <div className="absolute top-8 left-8 text-xs font-mono text-gray-500">REF: 11-22-63</div>
          
          {/* Pagination Controls */}
          <div className="absolute top-6 right-8 flex items-center gap-4 text-xs font-mono text-gray-500 z-20 print-hidden">
            <button 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="hover:text-black disabled:opacity-30 disabled:hover:text-gray-500 transition-colors font-bold"
            >
              [PREV]
            </button>
            <span className="font-bold tracking-widest">PAGE {currentPage} OF {totalPages}</span>
            <button 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="hover:text-black disabled:opacity-30 disabled:hover:text-gray-500 transition-colors font-bold"
            >
              [NEXT]
            </button>
          </div>

          {/* Status Tag */}
          <div className="absolute top-14 right-8 text-xs font-mono font-bold tracking-widest z-20 print-hidden">
            {isPlaying ? (
                <span className="text-red-600 animate-pulse drop-shadow-[0_0_2px_rgba(220,38,38,0.5)]">PROCESSING FEED...</span>
            ) : (
                <span className="text-gray-400/50">UNCLASSIFIED</span>
            )}
          </div>
          
          <div className="absolute bottom-8 left-8 text-xs font-mono text-gray-500">CONFIDENTIAL</div>
          <div className="absolute bottom-8 right-8 text-xs font-mono text-gray-500">DO NOT DUPLICATE</div>

          <div className="flex flex-col items-center justify-center mb-8 md:mb-12 mt-6 md:mt-8 border-b-2 border-black/20 pb-4 relative z-30">
            <h2 className="text-lg sm:text-xl md:text-4xl font-bold uppercase tracking-widest flex items-center gap-2 md:gap-4 text-black font-typewriter mb-4">
              <Siren className="w-5 h-5 md:w-8 md:h-8 text-red-800 animate-pulse" />
              Interrogation Log
              <Siren className="w-5 h-5 md:w-8 md:h-8 text-red-800 animate-pulse transform scale-x-[-1]" />
            </h2>
            
            {/* Export Controls */}
            <div className="absolute right-0 top-2 print-hidden">
              <div className="relative">
                <button 
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 border-2 border-gray-400 hover:border-black transition rounded-sm text-black text-xs font-bold uppercase tracking-wider bg-[#f0e6d2]"
                >
                  <Printer className="w-4 h-4" />
                  Export
                </button>
                
                <AnimatePresence>
                  {showExportMenu && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="fixed inset-0 md:absolute md:inset-auto md:right-0 md:mt-2 w-full md:w-72 h-full md:h-auto bg-[#f0e6d2]/95 md:bg-[#f0e6d2] backdrop-blur-sm md:backdrop-blur-none border-2 border-black shadow-[8px_8px_0px_rgba(0,0,0,0.2)] z-50 flex flex-col justify-center md:block"
                    >
                      <div className="absolute top-4 right-4 md:hidden">
                        <button onClick={() => setShowExportMenu(false)} className="p-2 border-2 border-black rounded-full">
                            <X className="w-6 h-6 text-black" />
                        </button>
                      </div>
                      <div className="p-2 bg-black/5 border-b border-black/10 text-[10px] font-mono uppercase text-gray-600 text-center tracking-widest">
                        Select Clearance Level
                      </div>
                      
                      <div className="flex flex-col p-1">
                        <button 
                          onClick={() => handleExport('redacted')}
                          className="w-full text-left px-4 py-4 hover:bg-black/5 flex items-center gap-4 border-b border-black/5 group transition-colors relative"
                        >
                          <div className="w-10 h-10 bg-black flex items-center justify-center text-white font-mono text-sm shrink-0 shadow-sm">
                            XXX
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-black text-sm uppercase tracking-wider">Redacted</div>
                            <div className="text-[10px] text-gray-600 font-mono mt-1">Standard Protocol</div>
                          </div>
                        </button>
                        
                        <button 
                          onClick={() => handleExport('classified')}
                          className="w-full text-left px-4 py-4 hover:bg-red-900/5 flex items-center gap-4 group transition-colors relative"
                        >
                          <div className="w-10 h-10 bg-red-800 flex items-center justify-center text-white font-mono text-sm shrink-0 shadow-sm relative overflow-hidden">
                            <div className="absolute inset-0 border border-white/20"></div>
                            TOP
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-red-800 text-sm uppercase tracking-wider">Classified</div>
                            <div className="text-[10px] text-red-600 font-mono mt-1">Clearance Level 5</div>
                          </div>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="space-y-8 font-mono text-sm md:text-base leading-relaxed max-w-3xl mx-auto text-black relative z-10 min-h-[60vh]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {displayedSegments.map((segment, index) => {
                  const globalIndex = (currentPage - 1) * SEGMENTS_PER_PAGE + index;
                  const isActive = globalIndex === activeSegmentIndex;
                  
                  return (
                  <div
                    key={index}
                    id={`segment-${globalIndex}`}
                    className={`relative group mb-8 transition-all duration-700 ease-in-out ${
                        editingSegment === globalIndex ? 'bg-yellow-50 -mx-4 p-4 border border-yellow-200 shadow-inner' : ''
                    } ${
                        isActive 
                            ? 'opacity-100 scale-[1.01] blur-none' 
                            : isPlaying 
                                ? 'opacity-50 blur-[1px] grayscale-[0.5]' 
                                : 'opacity-100 blur-none'
                    }`}
                  >
                    {/* Active Indicator - Red Underline/Glow */}
                    {isActive && (
                        <motion.div 
                            layoutId="active-glow"
                            className="absolute -inset-2 bg-amber-500/5 rounded-lg border-b-2 border-red-500/50 shadow-[0_0_15px_rgba(251,191,36,0.1)] pointer-events-none"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        />
                    )}

                    <div className="flex flex-col md:flex-row gap-2 md:gap-8 relative z-10">
                      <div className="w-32 shrink-0 pt-1 text-right border-r-2 border-gray-300 pr-4">
                        <span className={`font-bold uppercase text-xs tracking-wider block mb-1 transition-colors ${isActive ? 'text-red-700' : 'text-gray-600'}`}>
                          {getSpeakerLabel(segment.speaker)}
                        </span>
                        {segment.emotion && (
                          <span className="text-[10px] text-gray-500 uppercase italic">
                            [{segment.emotion}]
                          </span>
                        )}
                      </div>
                      
                      <div className="flex-1 relative pl-2">
                        {editingSegment === globalIndex ? (
                          <div className="space-y-3">
                            <textarea
                              value={editedText}
                              onChange={(e) => setEditedText(e.target.value)}
                              className="w-full h-32 bg-white border border-gray-300 p-3 font-typewriter focus:border-black focus:outline-none resize-none shadow-inner"
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={cancelEditing}
                                className="px-3 py-1 text-xs uppercase font-bold border border-gray-400 hover:bg-gray-100"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveSegment(globalIndex)}
                                disabled={saving}
                                className="px-3 py-1 text-xs uppercase font-bold bg-black text-white hover:bg-gray-800"
                              >
                                {saving ? 'Saving...' : 'Update Record'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            onClick={() => !printMode && startEditing(globalIndex, segment.text)}
                            className={`${!printMode ? 'cursor-text hover:bg-black/5' : ''} p-1 -m-1 rounded transition-colors font-typewriter`}
                          >
                            {/* Typewriter Reveal Effect for Active Segment */}
                            {isActive && isPlaying ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.5 }}
                                >
                                    <RedactedText text={segment.text} reveal={printMode === 'classified'} />
                                </motion.div>
                            ) : (
                                <RedactedText text={segment.text} reveal={printMode === 'classified'} />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* READ DEPOSITION (Primary) */}
          <button 
            onClick={scrollToDossier}
            className="relative group transition-transform hover:-translate-y-0.5 active:translate-y-0.5 h-24"
          >
            {/* Shadow Plate */}
            <div className="absolute inset-0 bg-black translate-y-2 translate-x-2 rounded-sm blur-[1px]"></div>
            
            {/* Main Button Body */}
            <div className="relative h-full bg-zinc-300 text-zinc-900 px-6 font-bold uppercase tracking-widest text-sm border-2 border-zinc-600 flex flex-col items-center justify-center gap-2 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)] group-hover:bg-zinc-200 transition-colors overflow-hidden transform -skew-x-2">
                {/* Grime/Texture Overlay */}
                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/concrete-wall.png')] mix-blend-multiply pointer-events-none"></div>
                <div className="absolute inset-0 bg-linear-to-br from-white/40 to-transparent opacity-50 pointer-events-none"></div>
                
                {/* Stamped Text Effect */}
                <FileText className="w-6 h-6 relative z-10 drop-shadow-[0_1px_0_rgba(255,255,255,0.5)]" />
                <span className="relative z-10 drop-shadow-[0_1px_0_rgba(255,255,255,0.5)] font-typewriter text-black">Read Deposition</span>
                
                {/* Bolted Corners */}
                <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-zinc-500 shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]"></div>
                <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-zinc-500 shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]"></div>
                <div className="absolute bottom-2 left-2 w-1.5 h-1.5 rounded-full bg-zinc-500 shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]"></div>
                <div className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full bg-zinc-500 shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]"></div>
            </div>
          </button>

          {/* SEIZE EVIDENCE (Secondary) */}
          <button 
            onClick={handleDownloadScript}
            className="relative group transition-transform hover:-translate-y-0.5 active:translate-y-0.5 h-24"
          >
            {/* Shadow Plate */}
            <div className="absolute inset-0 bg-black translate-y-2 translate-x-2 rounded-sm blur-[1px]"></div>
            
            {/* Main Button Body */}
            <div className="relative h-full bg-red-900 text-white px-6 font-bold uppercase tracking-widest text-sm border-2 border-zinc-900 flex flex-col items-center justify-center gap-2 shadow-[inset_0_0_30px_rgba(0,0,0,0.6)] group-hover:bg-red-800 transition-colors overflow-hidden transform -skew-x-2">
                {/* Leather/Metal Texture Overlay */}
                <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] mix-blend-multiply pointer-events-none"></div>
                <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent pointer-events-none"></div>
                
                {/* Stenciled Text Effect */}
                <Download className="w-6 h-6 relative z-10 drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]" />
                <span className="relative z-10 drop-shadow-[0_2px_0_rgba(0,0,0,0.5)] font-typewriter text-white">Seize Evidence</span>
                
                {/* Industrial Border Detail */}
                <div className="absolute inset-0 border border-white/10 pointer-events-none"></div>
            </div>
          </button>

          {/* LEAK INFORMATION (Tertiary) */}
          <button 
            onClick={handleShareLink}
            className="relative group transition-transform hover:-translate-y-0.5 active:translate-y-0.5 h-24"
          >
            {/* Copied notification */}
            {showCopiedNotification && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-green-600 text-white px-3 py-1 rounded text-sm font-mono z-50 animate-pulse">
                Link Copied!
              </div>
            )}
            {/* Shadow Plate */}
            <div className="absolute inset-0 bg-black translate-y-2 translate-x-2 rounded-sm blur-[1px]"></div>
            
            {/* Main Button Body */}
            <div className="relative h-full bg-zinc-800 text-zinc-400 px-6 font-bold uppercase tracking-widest text-sm border-2 border-zinc-900 flex flex-col items-center justify-center gap-2 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] group-hover:bg-zinc-700 group-hover:text-zinc-200 transition-colors overflow-hidden transform -skew-x-2">
                {/* Carbon Texture Overlay */}
                <div className="absolute inset-0 opacity-40 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] mix-blend-multiply pointer-events-none"></div>
                
                {/* Stenciled Text Effect */}
                <Share2 className="w-6 h-6 relative z-10 drop-shadow-[0_1px_0_rgba(0,0,0,0.8)]" />
                <span className="relative z-10 drop-shadow-[0_1px_0_rgba(0,0,0,0.8)] font-typewriter opacity-80">Leak Information</span>
                
                {/* Burnished Border */}
                <div className="absolute inset-0 border border-white/5 pointer-events-none"></div>
            </div>
          </button>
        </div>

      </motion.main>
    </div>
  );
}
