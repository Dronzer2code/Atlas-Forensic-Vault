'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_MESSAGES = [
  "Gathering forensic evidence...",
  "Interrogating the source code...",
  "Developing crime scene photos...",
  "Finalizing the deposition...",
  "Analyzing fingerprints...",
  "Cross-referencing database...",
];

export default function DevelopingEvidence() {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 0.5; // Slow progress for effect
      });
    }, 50);

    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 3000);

    return () => {
      clearInterval(interval);
      clearInterval(messageInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] bg-[#1a1a1a] flex flex-col items-center justify-center overflow-hidden font-typewriter">
      {/* Heavy Film Grain Overlay */}
      <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay" 
           style={{
             backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
           }}>
      </div>
      
      {/* Red Wash / Darkroom Light */}
      <div className="absolute inset-0 bg-red-900/20 mix-blend-multiply pointer-events-none"></div>
      <div className="absolute inset-0 bg-radial-gradient from-red-900/10 via-transparent to-black/80 pointer-events-none"></div>

      {/* Photo Paper Frame */}
      <div className="relative w-[300px] h-[400px] md:w-[400px] md:h-[500px] bg-[#f0f0f0] p-4 shadow-2xl transform rotate-1 transition-all duration-1000">
        {/* Inner Image Area */}
        <div className="w-full h-full bg-black relative overflow-hidden border-4 border-white/50">
            {/* Developing Image Effect */}
            <motion.div 
                className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center grayscale contrast-125"
                initial={{ opacity: 0, filter: 'blur(20px)' }}
                animate={{ opacity: progress / 100, filter: `blur(${20 - (progress / 5)}px)` }}
                transition={{ duration: 0.5 }}
            />
            
            {/* Red Tint Overlay (Darkroom effect) */}
            <div className="absolute inset-0 bg-red-600/30 mix-blend-overlay"></div>
        </div>

        {/* Processing LED */}
        <div className="absolute top-2 right-2 flex items-center gap-2 bg-black/80 px-2 py-1 rounded-sm z-20 border border-red-900/50">
            <span className="text-[8px] text-red-500 font-bold tracking-widest animate-pulse">PROCESSING</span>
            <div className="w-1.5 h-1.5 bg-red-600 rounded-full shadow-[0_0_5px_#dc2626] animate-ping"></div>
        </div>
      </div>

      {/* Status & Odometer */}
      <div className="mt-12 text-center relative z-10">
        <div className="text-4xl md:text-6xl font-bold text-red-600 mb-4 tracking-tighter flex items-center justify-center gap-1 font-mono">
            <span>{Math.floor(progress)}</span>
            <span className="text-2xl md:text-3xl opacity-50">%</span>
        </div>
        
        <div className="h-8 overflow-hidden">
            <AnimatePresence mode="wait">
                <motion.p 
                    key={messageIndex}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    className="text-gray-400 text-sm md:text-base uppercase tracking-widest loading-text"
                >
                    {STATUS_MESSAGES[messageIndex]}
                </motion.p>
            </AnimatePresence>
        </div>
      </div>

      <style jsx global>{`
        .loading-text::after {
          content: "|";
          animation: blink 1s step-end infinite;
        }
        @keyframes blink {
          from, to { color: transparent }
          50% { color: #dc2626 }
        }
      `}</style>
    </div>
  );
}
