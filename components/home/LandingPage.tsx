'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, Mic, Skull, Zap, Eye, Sparkles, Loader2, FileText, Clock, AlertTriangle, CheckCircle2, XCircle, Play, Menu, X, Monitor, Shield, LogOut, User } from 'lucide-react';
import { NarrativeStyle, AnalysisStatus } from '@/lib/types';
import DevelopingEvidence from '@/components/ui/DevelopingEvidence';
import { ClearanceStatusPopup } from '@/components/ui/ClearanceStatusPopup';
import { RedNoticeOverlay } from '@/components/ui/RedNoticeOverlay';
import { useAudio } from '@/components/layout/AudioProvider';
import { InvestigationStatus } from '@/lib/auth/investigations';

const NARRATIVE_STYLES = [
  {
    id: NarrativeStyle.TRUE_CRIME,
    name: 'True Crime',
    icon: Skull,
    description: 'Dark, mysterious, suspenseful',
    disabled: false,
  },
  {
    id: NarrativeStyle.SPORTS,
    name: 'Sports Commentary',
    icon: Zap,
    description: 'Football-style dual commentary',
    disabled: false,
  },
  {
    id: NarrativeStyle.DOCUMENTARY,
    name: 'Documentary',
    icon: Eye,
    description: 'Observational, educational, calm',
    disabled: false,
  },
  {
    id: NarrativeStyle.COMEDY,
    name: 'Comedy Roast',
    icon: Sparkles,
    description: 'Coming soon...',
    disabled: true,
  },
];

interface LandingPageProps {
  initialPodcasts: any[];
  initialStats: any;
}

export default function LandingPage({ initialPodcasts, initialStats }: LandingPageProps) {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [repoUrl, setRepoUrl] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<NarrativeStyle>(
    NarrativeStyle.TRUE_CRIME
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentPodcast, setCurrentPodcast] = useState<any>(null);
  const [podcasts, setPodcasts] = useState<any[]>(initialPodcasts || []);
  const [stats, setStats] = useState<any>(initialStats || null);
  const [isTorchEnabled, setIsTorchEnabled] = useState(true);
  const [isHoveringNav, setIsHoveringNav] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showMobileWarning, setShowMobileWarning] = useState(false);
  const [isNavigatingToCase, setIsNavigatingToCase] = useState(false);
  const { isPlaying, toggleAudio } = useAudio();
  
  // Investigation tracking states
  const [investigationStatus, setInvestigationStatus] = useState<InvestigationStatus | null>(null);
  const [showClearancePopup, setShowClearancePopup] = useState(false);
  const [showRedNotice, setShowRedNotice] = useState(false);

  // Fetch investigation status when authenticated
  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetchInvestigationStatus();
    }
  }, [authStatus]);

  const fetchInvestigationStatus = async () => {
    try {
      const response = await fetch('/api/auth/investigation-status');
      if (response.ok) {
        const data = await response.json();
        setInvestigationStatus(data.status);
        // Show popup briefly when status is loaded
        setShowClearancePopup(true);
        setTimeout(() => setShowClearancePopup(false), 5000);
      }
    } catch (error) {
      console.error('Error fetching investigation status:', error);
    }
  };

  // Check if user is on mobile and hasn't dismissed the warning
  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    const hasSeenWarning = localStorage.getItem('noir-mobile-warning-dismissed');
    
    if (isMobile && !hasSeenWarning) {
      // Small delay to let page load first
      const timer = setTimeout(() => setShowMobileWarning(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismissMobileWarning = () => {
    setShowMobileWarning(false);
    localStorage.setItem('noir-mobile-warning-dismissed', 'true');
  };

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

  const refreshPodcasts = async () => {
    try {
      const response = await fetch('/api/podcasts?limit=10');
      const data = await response.json();
      setPodcasts(data.podcasts || []);
    } catch (error) {
      console.error('Error fetching podcasts:', error);
    }
  };

  const refreshStats = async () => {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;

    // Check if user is authenticated
    if (authStatus !== 'authenticated') {
      const callbackUrl = encodeURIComponent(`/?repo=${encodeURIComponent(repoUrl)}`);
      router.push(`/login?callbackUrl=${callbackUrl}`);
      return;
    }

    // Check if user has remaining investigations
    if (investigationStatus && !investigationStatus.isAllowed) {
      setShowRedNotice(true);
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: repoUrl,
          narrative_style: selectedStyle,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update investigation status from response
        if (data.investigationStatus) {
          setInvestigationStatus(data.investigationStatus);
          setShowClearancePopup(true);
          setTimeout(() => setShowClearancePopup(false), 5000);
        }
        setCurrentPodcast({ id: data.id, status: data.status });
        pollPodcastStatus(data.id);
      } else if (response.status === 401) {
        // Not authenticated - redirect to login
        const callbackUrl = encodeURIComponent(`/?repo=${encodeURIComponent(repoUrl)}`);
        router.push(`/login?callbackUrl=${callbackUrl}`);
        setIsAnalyzing(false);
      } else if (response.status === 403 && data.code === 'RED_NOTICE') {
        // Investigation limit reached - show Red Notice
        setInvestigationStatus(data.status);
        setShowRedNotice(true);
        setIsAnalyzing(false);
      } else {
        alert(`Error: ${data.error}`);
        setIsAnalyzing(false);
      }
    } catch (error) {
      console.error('Error analyzing repo:', error);
      alert('Failed to start analysis');
      setIsAnalyzing(false);
    }
  };

  const pollPodcastStatus = async (podcastId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/analyze/${podcastId}/status`);
        const data = await response.json();

        setCurrentPodcast(data);

        if (data.status === AnalysisStatus.COMPLETED) {
          clearInterval(interval);
          setIsAnalyzing(false);
          // Redirect to case file page
          router.push('/case');
        } else if (data.status === AnalysisStatus.FAILED) {
          clearInterval(interval);
          setIsAnalyzing(false);
          refreshPodcasts();
          refreshStats();
        }
      } catch (error) {
        console.error('Error polling status:', error);
        clearInterval(interval);
        setIsAnalyzing(false);
      }
    }, 2000);
  };

  return (
    <main className="min-h-screen bg-[#050505] text-[#e7e5e4] font-mono relative">
      {/* Investigation Status Popup */}
      <ClearanceStatusPopup
        status={investigationStatus}
        isVisible={showClearancePopup}
        onClose={() => setShowClearancePopup(false)}
      />

      {/* Red Notice Overlay - when limit is exceeded */}
      <RedNoticeOverlay
        isVisible={showRedNotice}
        onDismiss={() => {
          setShowRedNotice(false);
          router.push('/');
        }}
      />

      {/* Mobile Warning Popup - Noir Style */}
      <AnimatePresence>
        {showMobileWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          >
            {/* Crime Scene Tape - Top */}
            <div className="absolute top-8 left-0 w-full h-8 bg-yellow-500 transform -rotate-2 flex items-center justify-center overflow-hidden">
              <div className="w-full h-full bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)] opacity-20 absolute"></div>
              <span className="text-black font-bold text-xs tracking-[0.3em] uppercase z-10">CRIME SCENE • DO NOT CROSS • CRIME SCENE • DO NOT CROSS</span>
            </div>

            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -2 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative bg-[#f0e6d2] text-black max-w-md w-full p-8 shadow-2xl transform rotate-1"
            >
              {/* Paper Texture */}
              <div className="absolute inset-0 opacity-40 pointer-events-none mix-blend-multiply" style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/paper-fibers.png")'}}></div>
              
              {/* Push Pin */}
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-20">
                <div className="w-5 h-5 rounded-full bg-red-600 shadow-md border-2 border-red-800"></div>
                <div className="w-1.5 h-3 bg-gray-400 mx-auto"></div>
              </div>

              {/* Confidential Stamp */}
              <div className="absolute top-4 right-4 border-4 border-red-800 text-red-800 px-3 py-1 text-sm font-bold transform rotate-12 opacity-60 mask-stamp font-typewriter">
                NOTICE
              </div>

              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6 border-b-2 border-black/20 pb-4">
                  <Monitor className="w-8 h-8 text-zinc-700" />
                  <div>
                    <h2 className="text-xl font-bold uppercase tracking-wider font-typewriter">Field Advisory</h2>
                    <p className="text-xs text-zinc-600 font-mono uppercase tracking-widest">Case File #892-M</p>
                  </div>
                </div>

                <div className="space-y-4 font-courier text-sm leading-relaxed">
                  <p className="flex gap-2">
                    <span className="text-zinc-500 select-none">&gt;</span>
                    <span>Detective, this crime scene contains complex evidence that requires a <strong className="text-red-800">larger viewport</strong> for proper investigation.</span>
                  </p>
                  
                  <p className="flex gap-2">
                    <span className="text-zinc-500 select-none">&gt;</span>
                    <span>For optimal surveillance and analysis capabilities, we recommend accessing via <strong className="text-red-800">desktop terminal</strong>.</span>
                  </p>

                  <div className="bg-zinc-900/10 border-l-4 border-red-800/50 p-3 mt-4">
                    <p className="text-xs text-zinc-600 italic font-typewriter">
                      &ldquo;A detective&apos;s best tools are a sharp eye and a wide desk.&rdquo;
                    </p>
                    <p className="text-right text-[10px] text-zinc-500 mt-1 font-typewriter">- Det. Mongo D. Bane</p>
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-3">
                  <button
                    onClick={dismissMobileWarning}
                    className="w-full bg-zinc-900 text-white py-3 px-4 font-bold uppercase tracking-widest text-sm hover:bg-zinc-800 transition-colors font-typewriter flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Continue Investigation
                  </button>
                  <p className="text-center text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
                    Proceed at your own risk
                  </p>
                </div>
              </div>

              {/* Coffee Stain */}
              <div className="absolute bottom-4 left-4 w-12 h-12 rounded-full border-4 border-amber-900/20 opacity-40"></div>
            </motion.div>

            {/* Crime Scene Tape - Bottom */}
            <div className="absolute bottom-8 left-0 w-full h-8 bg-yellow-500 transform rotate-1 flex items-center justify-center overflow-hidden">
              <div className="w-full h-full bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)] opacity-20 absolute"></div>
              <span className="text-black font-bold text-xs tracking-[0.3em] uppercase z-10">CRIME SCENE • DO NOT CROSS • CRIME SCENE • DO NOT CROSS</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      {(isAnalyzing || isNavigatingToCase) && <DevelopingEvidence />}

      {/* Global Effects */}
      <div className="noise-overlay"></div>
      <div className="scanlines"></div>
      {isTorchEnabled && <div className="flashlight-container flashlight-overlay"></div>}

      {/* Investigation Photo Corner Brackets */}
      <div className="fixed inset-0 pointer-events-none z-[100] hidden sm:block">
        {/* Top Left */}
        <div className="absolute top-3 left-3 md:top-5 md:left-5 w-10 h-10 md:w-16 md:h-16 border-t-2 md:border-t-4 border-l-2 md:border-l-4 border-red-600"></div>
        {/* Top Right */}
        <div className="absolute top-3 right-3 md:top-5 md:right-5 w-10 h-10 md:w-16 md:h-16 border-t-2 md:border-t-4 border-r-2 md:border-r-4 border-red-600"></div>
        {/* Bottom Left */}
        <div className="absolute bottom-3 left-3 md:bottom-5 md:left-5 w-10 h-10 md:w-16 md:h-16 border-b-2 md:border-b-4 border-l-2 md:border-l-4 border-red-600"></div>
        {/* Bottom Right */}
        <div className="absolute bottom-3 right-3 md:bottom-5 md:right-5 w-10 h-10 md:w-16 md:h-16 border-b-2 md:border-b-4 border-r-2 md:border-r-4 border-red-600"></div>
      </div>

      {/* Rack-Mounted Detective Console Navbar */}
      <motion.nav 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative mx-auto mt-2 md:mt-6 z-[60] w-[95%] md:w-full max-w-5xl bg-zinc-950/90 backdrop-blur-sm border border-zinc-800 shadow-2xl rounded-sm"
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
              
              <div className="relative z-10 bg-white text-black px-2 md:px-3 py-1 md:py-2 transform rotate-1 shadow-lg drop-shadow-xl border border-gray-300 flex items-center gap-2 md:gap-3 max-w-[160px] md:max-w-[220px]">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-200 border border-gray-400 overflow-hidden grayscale contrast-125 shrink-0 relative">
                  <Image 
                    src="/mongodben.jpg" 
                    alt="Det. Mongo D. Bane" 
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
                        onClick={toggleAudio}
                        className={`flex items-center gap-2 px-2 py-1 border-r border-zinc-800 bg-black/40 hover:brightness-110 transition-all ${isPlaying ? 'text-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                        title="Toggle Audio Intercept"
                    >
                        <motion.div 
                            className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' : 'bg-zinc-700'}`}
                            animate={isPlaying ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.5 }}
                            transition={isPlaying ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
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
            <a href="#analyze" className="font-typewriter font-bold text-lg text-gray-400 hover:text-green-400 transition-all hover:shadow-[0_0_8px_rgba(74,222,128,0.5)] hover:animate-flicker uppercase tracking-widest leading-none flex items-center" suppressHydrationWarning>
              Open Case
            </a>
            <a href="#investigations" className="font-typewriter font-bold text-lg text-gray-400 hover:text-green-400 transition-all hover:shadow-[0_0_8px_rgba(74,222,128,0.5)] hover:animate-flicker uppercase tracking-widest flex items-center" suppressHydrationWarning>
              Cases
            </a>
            <a href="#stats" className="font-typewriter font-bold text-lg text-gray-400 hover:text-green-400 transition-all hover:shadow-[0_0_8px_rgba(74,222,128,0.5)] hover:animate-flicker uppercase tracking-widest flex items-center" suppressHydrationWarning>
              Locker
            </a>
            
            {/* User Status / Login */}
            {authStatus === 'authenticated' && session?.user ? (
              <button
                onClick={() => setShowClearancePopup(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 border border-zinc-700 hover:border-green-700/50 transition-colors"
              >
                <Shield className={`w-4 h-4 ${investigationStatus?.remaining === 0 ? 'text-red-500' : investigationStatus?.remaining === 1 ? 'text-amber-500' : 'text-green-500'}`} />
                <span className="text-xs font-mono text-zinc-400">
                  {investigationStatus ? `${investigationStatus.remaining}/${investigationStatus.total}` : '...'}
                </span>
              </button>
            ) : authStatus === 'unauthenticated' ? (
              <a
                href="/login"
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 border border-zinc-700 hover:border-amber-700/50 transition-colors"
              >
                <User className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Login</span>
              </a>
            ) : null}
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
                <a 
                  href="#analyze" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="font-typewriter font-bold text-base text-gray-400 hover:text-green-400 transition-all uppercase tracking-widest py-2"
                  suppressHydrationWarning
                >
                  Open Case
                </a>
                <a 
                  href="#investigations" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="font-typewriter font-bold text-base text-gray-400 hover:text-green-400 transition-all uppercase tracking-widest py-2"
                  suppressHydrationWarning
                >
                  Cases
                </a>
                <a 
                  href="#stats" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="font-typewriter font-bold text-base text-gray-400 hover:text-green-400 transition-all uppercase tracking-widest py-2"
                  suppressHydrationWarning
                >
                  Locker
                </a>
                {/* Mobile System Controls */}
                <div className="flex items-center gap-4 pt-2 border-t border-zinc-800">
                  <button 
                    onClick={toggleAudio}
                    className={`flex items-center gap-2 px-3 py-2 bg-black/40 rounded-sm ${isPlaying ? 'text-amber-500' : 'text-zinc-500'}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-amber-500' : 'bg-zinc-700'}`}></div>
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

      <motion.div
        initial={{ opacity: 0, filter: 'blur(10px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
      {/* Hero Section */}
      <section id="analyze" className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden pt-12 font-typewriter">
        {/* Top Crime Tape Border */}
        <div className="absolute top-0 left-0 right-0 z-50 crime-tape-container">
          <div className="crime-tape w-full h-full">
            <span>CRIME SCENE DO NOT CROSS</span>
            <span>EVIDENCE #404</span>
            <span>CRIME SCENE DO NOT CROSS</span>
            <span>EVIDENCE #404</span>
            <span>CRIME SCENE DO NOT CROSS</span>
            <span>EVIDENCE #404</span>
            <span>CRIME SCENE DO NOT CROSS</span>
            <span>EVIDENCE #404</span>
            <span>CRIME SCENE DO NOT CROSS</span>
            <span>EVIDENCE #404</span>
          </div>
        </div>

        {/* Bottom Crime Tape Border */}
        <div className="absolute bottom-0 left-0 right-0 z-50 crime-tape-container">
          <div className="crime-tape w-full h-full">
            <span>CRIME SCENE DO NOT CROSS</span>
            <span>EVIDENCE #404</span>
            <span>CRIME SCENE DO NOT CROSS</span>
            <span>EVIDENCE #404</span>
            <span>CRIME SCENE DO NOT CROSS</span>
            <span>EVIDENCE #404</span>
            <span>CRIME SCENE DO NOT CROSS</span>
            <span>EVIDENCE #404</span>
            <span>CRIME SCENE DO NOT CROSS</span>
            <span>EVIDENCE #404</span>
          </div>
        </div>
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Grid Pattern */}
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: `linear-gradient(rgba(239, 68, 68, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(239, 68, 68, 0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}></div>
          
          {/* Scan Lines */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 255, 255, 0.03) 2px, rgba(255, 255, 255, 0.03) 4px)'
          }}></div>
          
          {/* Vignette */}
          <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/40 to-black/90"></div>
          
          {/* Animated Orbs */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-red-600/20 rounded-full blur-2xl animate-float" style={{ animationDelay: '2s' }} />
          <div className="absolute top-1/2 right-1/3 w-48 h-48 bg-red-500/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />
          
          {/* Spotlight Effect */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-96 bg-gradient-to-b from-red-900/5 via-transparent to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          
          {/* Main Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-4 tracking-tighter leading-none animate-flicker mix-blend-hard-light">
            <span className="text-white">Your Code.</span>{' '}
            <span className="bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">
              Your Crime Scene.
            </span>
            <br />
            <span className="text-white">Your Podcast.</span>
          </h1>

          {/* Case File Badge */}
          <div className="inline-block mb-8 transform -rotate-1">
            <div className="bg-black px-4 py-1 rounded-sm shadow-sm border-2 border-gray-800 flex items-center gap-2">
              <span className="font-bold tracking-widest text-sm uppercase text-red-600" style={{textShadow: '1px 1px 0px rgba(220,38,38,0.3)'}}>
                CASE FILE #001
              </span>
            </div>
          </div>

          {/* Tagline */}
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-400 mb-6 md:mb-10 max-w-2xl mx-auto px-2">
            Transform any GitHub repository into a True Crime-style audio
            investigation.
            <br/>
            <span className="text-[#991b1b] font-bold drop-shadow-sm opacity-90 block mt-2"> Every codebase has secrets.</span>
          </p>

          {/* Feature Badges - Evidence Tags */}
          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6 mb-8 md:mb-12 relative px-2">
            {/* String connecting to form */}
            <svg className="absolute top-full left-1/2 -translate-x-1/2 w-1 h-8 z-0 pointer-events-none overflow-visible hidden md:block">
              <line x1="0" y1="0" x2="0" y2="32" stroke="white" strokeWidth="1" strokeDasharray="4 2" />
            </svg>

            {[
              { text: 'AI-Powered Analysis', color: 'bg-[#556b2f]' },
              { text: 'Multi-Narrative Styles', color: 'bg-[#6a5acd]' },
              { text: 'Real-Time Investigation', color: 'bg-[#b8860b]' }
            ].map((tag, i) => (
              <div key={i} className={`${tag.color} text-white/90 px-3 md:px-4 py-1.5 md:py-2 text-[10px] md:text-xs font-bold uppercase tracking-wider shadow-md relative group transform hover:scale-105 transition-transform`}>
                {/* Hole Punch */}
                <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2 md:w-3 h-2 md:h-3 bg-[#050505] rounded-full border border-white/20"></div>
                {/* String */}
                <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 md:w-4 h-[1px] bg-white/50 origin-right transform -rotate-45"></div>
                {tag.text}
              </div>
            ))}
          </div>

          {/* Input Form - Warrant Style */}
          <form onSubmit={handleAnalyze} className="max-w-2xl mx-auto mb-16 md:mb-24 relative group z-10 px-2">
            <div className="absolute -top-6 left-4 bg-[#f0e6d2] text-black px-3 md:px-4 py-1 text-xs md:text-sm font-bold transform -rotate-1 shadow-md z-20 border border-gray-400 font-typewriter">
              CASE ENTRY FORM #29-A
            </div>
            
            <div className="bg-[#f0e6d2] p-1 rounded-sm shadow-xl transform rotate-0 md:rotate-1 transition-transform group-hover:rotate-0 overflow-hidden">
              <div className="bg-gradient-to-br from-[#fefce8] to-[#f5f5f4] border-2 border-[#d4c5a9] p-6 relative">
                {/* Paper texture overlay */}
                <div className="absolute inset-0 opacity-50 pointer-events-none mix-blend-multiply" style={{
                  backgroundImage: 'url("https://www.transparenttextures.com/patterns/paper-fibers.png")',
                  maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)'
                }}></div>
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{filter: 'contrast(120%) brightness(90%)'}}>
                   <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                     <filter id="noiseFilter">
                       <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
                     </filter>
                     <rect width="100%" height="100%" filter="url(#noiseFilter)"/>
                   </svg>
                </div>
                
                <div className="flex flex-col gap-4 relative z-10">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                    <label className="text-black font-bold font-typewriter text-sm md:text-lg uppercase tracking-widest shrink-0">Target:</label>
                    <div className="flex-1 relative w-full">
                      <input
                        type="text"
                        placeholder="https://github.com/username/repo"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        className="w-full bg-transparent border-b-2 border-black/20 focus:border-red-800 outline-none py-2 text-black font-typewriter text-base md:text-xl placeholder:italic placeholder:text-gray-500 transition-colors"
                        disabled={isAnalyzing}
                      />
                      {/* Typewriter cursor effect */}
                      {repoUrl && <span className="absolute right-0 top-2 w-2 h-6 bg-black/50 animate-pulse"></span>}
                    </div>
                  </div>
                  
                  <div className="flex justify-center sm:justify-end mt-2">
                    <button
                      type="submit"
                      disabled={isAnalyzing || !repoUrl.trim()}
                      className="bg-[#1a1a1a] text-white px-6 md:px-8 py-2.5 md:py-3 font-bold font-typewriter uppercase tracking-widest hover:bg-red-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center gap-2 border-2 border-transparent hover:border-red-500 text-sm md:text-base w-full sm:w-auto justify-center"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          CLASSIFYING...
                        </>
                      ) : (
                        <>
                          <span className="text-red-500">★</span> ISSUE WARRANT
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Stamp */}
                <div className="absolute -bottom-6 -right-6 w-32 h-32 border-4 border-red-900/70 rounded-full flex items-center justify-center transform -rotate-12 z-20 mix-blend-multiply pointer-events-none overflow-hidden">
                  <div className="absolute inset-0 border-2 border-red-900/50 rounded-full m-1"></div>
                  <div className="text-red-900/80 font-bold text-sm uppercase text-center leading-tight tracking-widest font-typewriter blur-[0.5px]">
                    OFFICIAL<br/>BUSINESS<br/>ONLY
                  </div>
                  {/* Ink Bleed Texture */}
                  <div className="absolute inset-0 opacity-40" style={{
                    backgroundImage: 'url("https://www.transparenttextures.com/patterns/grunge-wall.png")',
                    backgroundBlendMode: 'screen'
                  }}></div>
                </div>
              </div>
            </div>
          </form>

          {/* Narrative Style Selector */}
          <div className="max-w-4xl mx-auto mb-12 md:mb-16 relative z-20 px-2">
            <div className="flex items-center justify-center gap-2 md:gap-4 mb-4 md:mb-6">
              <div className="h-px bg-red-900/50 flex-1"></div>
              <h3 className="text-center text-xs md:text-sm uppercase tracking-widest text-red-700 font-typewriter font-bold">
                Select Investigation Protocol
              </h3>
              <div className="h-px bg-red-900/50 flex-1"></div>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
              {NARRATIVE_STYLES.map((style) => {
                const Icon = style.icon;
                const isSelected = selectedStyle === style.id;
                
                return (
                  <button
                    key={style.id}
                    onClick={() => !style.disabled && setSelectedStyle(style.id)}
                    disabled={style.disabled || isAnalyzing}
                    className={`relative p-3 md:p-4 transition-all duration-300 group ${
                      style.disabled ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'
                    }`}
                  >
                    {/* Card Background */}
                    <div className={`absolute inset-0 border-2 ${
                      isSelected 
                        ? 'border-red-600 bg-red-900/10' 
                        : 'border-gray-700 bg-black/40 hover:border-gray-500'
                    } transform transition-transform ${isSelected ? 'rotate-0 scale-105' : 'rotate-1 group-hover:rotate-0'}`}></div>
                    
                    {/* Content */}
                    <div className="relative z-10 flex flex-col items-center text-center">
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full border-2 flex items-center justify-center mb-2 md:mb-3 ${
                        isSelected ? 'border-red-500 bg-red-900/20 text-red-500' : 'border-gray-600 bg-black/50 text-gray-400'
                      }`}>
                        <Icon className="w-5 h-5 md:w-6 md:h-6" />
                      </div>
                      
                      <div className={`font-typewriter font-bold text-xs md:text-sm uppercase mb-1 ${
                        isSelected ? 'text-red-500' : 'text-gray-300'
                      }`}>
                        {style.name}
                      </div>
                      
                      <div className="text-[8px] md:text-[10px] font-mono text-gray-500 leading-tight">
                        {style.description}
                      </div>
                    </div>
                    
                    {/* Selection Indicator */}
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 text-red-600 animate-pulse">
                        <CheckCircle2 className="w-6 h-6 fill-black" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* How It Works */}
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-12 px-2">
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 md:p-6 text-center">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-red-900/30 border border-red-600/50 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                <span className="text-xl md:text-2xl font-bold text-red-500">1</span>
              </div>
              <h4 className="font-semibold mb-2 text-sm md:text-base">Submit Repository</h4>
              <p className="text-xs md:text-sm text-gray-400">
                Paste any GitHub URL and we'll analyze the codebase structure
              </p>
            </div>
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 md:p-6 text-center">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-red-900/30 border border-red-600/50 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                <span className="text-xl md:text-2xl font-bold text-red-500">2</span>
              </div>
              <h4 className="font-semibold mb-2 text-sm md:text-base">AI Investigation</h4>
              <p className="text-xs md:text-sm text-gray-400">
                Our AI detects patterns, issues, and creates a dramatic narrative
              </p>
            </div>
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 md:p-6 text-center sm:col-span-2 md:col-span-1">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-red-900/30 border border-red-600/50 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                <span className="text-xl md:text-2xl font-bold text-red-500">3</span>
              </div>
              <h4 className="font-semibold mb-2 text-sm md:text-base">Listen & Learn</h4>
              <p className="text-xs md:text-sm text-gray-400">
                Get a podcast explaining the code in an engaging story format
              </p>
            </div>
          </div>

          {/* Current Analysis Status */}
          {currentPodcast && (
            <div className="mt-8 bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Analysis Progress</h3>
                <span className="text-sm text-gray-400">
                  {currentPodcast.progress || 0}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                <div
                  className="bg-red-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${currentPodcast.progress || 0}%` }}
                />
              </div>
              <p className="text-sm text-gray-400">
                {currentPodcast.message || 'Processing...'}
              </p>
            </div>
          )}

          {/* Scroll Indicator */}
          <div className="mt-16 flex flex-col items-center gap-2 animate-bounce">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Scroll to see investigations</p>
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      {stats && (
        <section id="stats" className="px-2 md:px-4 py-8 md:py-12 max-w-6xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-4xl font-bold mb-2 flex items-center justify-center gap-2 md:gap-3 font-typewriter text-white tracking-tighter">
              <FileText className="w-6 h-6 md:w-8 md:h-8 text-red-500" />
              EVIDENCE LOCKER
            </h2>
            <p className="text-gray-400 font-mono text-xs md:text-sm uppercase tracking-widest">Authorized Personnel Only</p>
          </div>
          
          <div className="bg-[#2a2a2a] border-2 md:border-4 border-gray-600 rounded-lg shadow-2xl p-4 md:p-8 relative overflow-hidden">
            {/* Corkboard Texture */}
            <div className="absolute inset-0 opacity-30 pointer-events-none" style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/dark-matter.png")'}}></div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8 relative z-10">
              
              {/* Total Cases - Manila Folder */}
              <div className="bg-[#f0e6d2] text-black transform rotate-0 md:-rotate-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.5)] md:shadow-[5px_5px_0px_0px_rgba(0,0,0,0.5)] border-l-4 md:border-l-8 border-l-[#d4c5a9] p-3 md:p-6 relative group hover:rotate-0 transition-transform duration-300 h-36 md:h-48 flex flex-col justify-between">
                <div className="absolute -top-2 md:-top-3 -right-2 md:-right-3 w-16 md:w-24 h-6 md:h-8 bg-[#d4c5a9] transform rotate-3 rounded-t-md opacity-50"></div>
                <div className="font-special-elite text-sm md:text-lg uppercase tracking-widest border-b-2 border-black/20 pb-1 md:pb-2 mb-1 md:mb-2">
                  Total Cases
                </div>
                <div className="font-vt323 text-4xl md:text-7xl text-black/80 self-center">
                  {String(stats.total || 0).padStart(3, '0')}
                </div>
                <div className="text-[8px] md:text-[10px] font-mono text-gray-600 uppercase text-right">
                  Ref: #882-B
                </div>
              </div>

              {/* Solved - Closed Stamp */}
              <div className="bg-[#fdfbf7] text-black transform rotate-0 md:rotate-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.5)] md:shadow-[5px_5px_0px_0px_rgba(0,0,0,0.5)] p-3 md:p-6 relative group hover:rotate-0 transition-transform duration-300 h-36 md:h-48 flex flex-col justify-between border border-gray-300">
                {/* Paper Texture */}
                <div className="absolute inset-0 opacity-50 pointer-events-none" style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/paper-fibers.png")'}}></div>
                
                <div className="font-special-elite text-sm md:text-lg uppercase tracking-widest text-gray-600 relative z-10">
                  Solved
                </div>
                
                <div className="relative flex items-center justify-center flex-1">
                  <div className="font-vt323 text-4xl md:text-6xl text-gray-400 blur-[1px]">
                    {String(stats.completed || 0).padStart(3, '0')}
                  </div>
                  {/* Stamp Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="border-2 md:border-4 border-green-700 text-green-700 font-special-elite text-xl md:text-3xl font-bold p-1 md:p-2 transform -rotate-12 opacity-80 mask-stamp uppercase tracking-widest">
                      CLOSED
                    </div>
                  </div>
                </div>
                
                <div className="text-[8px] md:text-[10px] font-mono text-green-800 uppercase relative z-10">
                  Case Closed
                </div>
              </div>

              {/* Pending - Active Wiretap */}
              <div className="bg-[#111] border-2 md:border-4 border-gray-700 transform rotate-0 md:-rotate-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.8)] md:shadow-[5px_5px_0px_0px_rgba(0,0,0,0.8)] p-3 md:p-6 relative group hover:rotate-0 transition-transform duration-300 h-36 md:h-48 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1 md:mb-2">
                  <div className="font-mono text-[10px] md:text-xs text-red-500 animate-pulse uppercase tracking-widest">
                    ● REC
                  </div>
                  <div className="w-12 md:w-16 h-6 md:h-8 bg-black border border-gray-800 relative overflow-hidden">
                    <div className="absolute inset-0 bg-green-900/20"></div>
                    <div className="absolute bottom-0 left-0 w-full h-full bg-green-500/50 animate-pulse" style={{height: '40%'}}></div>
                  </div>
                </div>
                
                <div className="bg-[#1a0505] border border-red-900/50 p-1 md:p-2 rounded flex items-center justify-center shadow-[inset_0_0_10px_rgba(0,0,0,1)]">
                  <div className="font-vt323 text-4xl md:text-6xl text-red-600 animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                    {String(stats.pending || 0).padStart(3, '0')}
                  </div>
                </div>
                
                <div className="text-center mt-1 md:mt-2">
                  <div className="inline-block bg-red-900/20 text-red-500 text-[8px] md:text-[10px] font-mono px-1 md:px-2 py-0.5 md:py-1 border border-red-900/50 rounded uppercase tracking-wider">
                    Active Surveillance
                  </div>
                </div>
              </div>

              {/* Failed - Cold Case */}
              <div className="bg-[#e0f2fe] text-blue-900 transform rotate-0 md:rotate-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.5)] md:shadow-[5px_5px_0px_0px_rgba(0,0,0,0.5)] p-3 md:p-6 relative group hover:rotate-0 transition-transform duration-300 h-36 md:h-48 flex flex-col justify-between overflow-hidden">
                {/* Dust Overlay */}
                <div className="absolute inset-0 opacity-40 pointer-events-none mix-blend-multiply" style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/dust.png")'}}></div>
                
                <div className="font-special-elite text-sm md:text-lg uppercase tracking-widest text-blue-900/70 relative z-10">
                  Failed
                </div>
                
                <div className="relative flex items-center justify-center flex-1">
                  <div className="font-vt323 text-4xl md:text-6xl text-blue-900/30">
                    {String(stats.failed || 0).padStart(3, '0')}
                  </div>
                  {/* Stamp Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="border-2 md:border-4 border-blue-900/60 text-blue-900/60 font-special-elite text-lg md:text-2xl font-bold p-1 md:p-2 transform rotate-12 opacity-70 mask-stamp uppercase tracking-widest whitespace-nowrap">
                      COLD CASE
                    </div>
                  </div>
                </div>
                
                <div className="text-[8px] md:text-[10px] font-mono text-blue-900/50 uppercase relative z-10">
                  Archived
                </div>
              </div>

            </div>
          </div>
        </section>
      )}

      {/* Recent Podcasts - Evidence Board */}
      <section id="investigations" className="px-2 md:px-4 py-8 md:py-16 max-w-7xl mx-auto relative">
        {/* Corkboard Background */}
        <div className="absolute inset-0 corkboard-bg -z-10 shadow-inner border-t-4 md:border-t-8 border-b-4 md:border-b-8 border-[#2a1f1b]"></div>
        
        <div className="text-center mb-8 md:mb-12 relative z-10">
          <div className="inline-block bg-white px-4 md:px-6 py-1.5 md:py-2 transform rotate-1 shadow-lg border border-gray-300">
            <h2 className="text-2xl md:text-4xl font-bold text-black font-typewriter tracking-tighter uppercase">
              EVIDENCE BOARD
            </h2>
          </div>
          <p className="text-[#e7e5e4] mt-3 md:mt-4 bg-black/50 inline-block px-3 md:px-4 py-1 backdrop-blur-sm text-sm md:text-base">
            Active cases from the detective bureau
          </p>
        </div>
        
        {podcasts.length === 0 ? (
          <div className="text-center py-12 md:py-16 bg-black/20 rounded-xl border-2 border-dashed border-white/20 backdrop-blur-sm mx-2">
            <Skull className="w-12 h-12 md:w-16 md:h-16 text-white/50 mx-auto mb-4" />
            <p className="text-white/70 text-base md:text-lg font-typewriter">No investigations yet. Issue a warrant above.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 p-4 md:p-8">
            {podcasts.map((podcast, index) => {
              const statusConfig: Record<string, {
                stampColor: string;
                stampText: string;
                icon: typeof CheckCircle2;
              }> = {
                [AnalysisStatus.COMPLETED]: {
                  stampColor: 'text-green-700 border-green-700',
                  stampText: 'SOLVED',
                  icon: CheckCircle2,
                },
                [AnalysisStatus.FAILED]: {
                  stampColor: 'text-red-800 border-red-800',
                  stampText: 'COLD CASE',
                  icon: XCircle,
                },
                'default': {
                  stampColor: 'text-yellow-600 border-yellow-600',
                  stampText: 'UNDER INVESTIGATION',
                  icon: Clock,
                }
              };
              
              const config = statusConfig[podcast.status] || statusConfig['default'];
              
              return (
                <div
                  key={podcast.id}
                  onClick={async () => {
                    setIsNavigatingToCase(true);
                    // Small delay to ensure loading screen is visible
                    await new Promise(resolve => setTimeout(resolve, 800));
                    router.push(`/case/${podcast.id}`);
                  }}
                  className="manila-folder p-4 md:p-6 h-56 md:h-64 flex flex-col justify-between cursor-pointer group relative"
                >
                  {/* Paperclip */}
                  <div className="paperclip hidden sm:block"></div>
                  
                  {/* Polaroid Thumbnail */}
                  <div className="absolute -top-4 md:-top-6 -left-4 md:-left-6 w-16 md:w-24 h-16 md:h-24 bg-white p-1.5 md:p-2 shadow-lg transform -rotate-6 z-20 transition-transform group-hover:scale-110 group-hover:rotate-0">
                    <div className="w-full h-full bg-gray-200 overflow-hidden flex items-center justify-center">
                      {/* Generate a unique gradient based on ID */}
                      <div className="w-full h-full" style={{
                        background: `linear-gradient(135deg, #${podcast.id.slice(0,6)} 0%, #${podcast.id.slice(-6)} 100%)`
                      }}></div>
                    </div>
                  </div>

                  <div className="mt-3 md:mt-4 ml-10 md:ml-12">
                    <h3 className="text-base md:text-xl font-bold text-black font-typewriter leading-tight mb-1 group-hover:text-red-800 transition-colors line-clamp-2">
                      {podcast.title}
                    </h3>
                    <p className="text-gray-600 text-[10px] md:text-xs font-mono flex items-center gap-1">
                      <Github className="w-3 h-3" />
                      <span className="truncate">{podcast.repo_name}</span>
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-2 mt-3 md:mt-4">
                    <div className="border-t border-gray-400 pt-2">
                      <div className="flex justify-between text-[10px] md:text-xs font-mono text-gray-600">
                        <span>DATE:</span>
                        <span>{new Date(podcast.created_at).toLocaleDateString('en-US')}</span>
                      </div>
                      <div className="flex justify-between text-[10px] md:text-xs font-mono text-gray-600">
                        <span>STYLE:</span>
                        <span className="uppercase">{podcast.narrative_style || 'UNKNOWN'}</span>
                      </div>
                    </div>
                    
                    {/* Status Stamp */}
                    <div className={`self-end mt-1 md:mt-2 border-2 md:border-4 ${config.stampColor} px-1.5 md:px-2 py-0.5 md:py-1 transform -rotate-12 opacity-80 mask-stamp`}>
                      <span className={`font-bold text-[10px] md:text-xs ${config.stampColor} uppercase tracking-widest`}>
                        {config.stampText}
                      </span>
                    </div>
                  </div>
                  
                  {/* Red String Connector (Visual only for now) */}
                  {index < podcasts.length - 1 && (
                    <svg className="absolute top-1/2 -right-12 w-24 h-12 pointer-events-none z-0 hidden lg:block overflow-visible">
                      <path d="M0,20 Q60,0 100,40" fill="none" className="red-string" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
      </motion.div>
    </main>
  );
}
