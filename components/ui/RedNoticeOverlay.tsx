"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertOctagon, Radio, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

interface RedNoticeOverlayProps {
  isVisible: boolean;
  onDismiss?: () => void;
}

export function RedNoticeOverlay({ isVisible, onDismiss }: RedNoticeOverlayProps) {
  const [glitchText, setGlitchText] = useState(false);
  const [staticIntensity, setStaticIntensity] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    // Glitch text effect
    const glitchInterval = setInterval(() => {
      setGlitchText(true);
      setTimeout(() => setGlitchText(false), 100);
    }, 2000 + Math.random() * 3000);

    // Static intensity variation
    const staticInterval = setInterval(() => {
      setStaticIntensity(Math.random() * 0.3);
    }, 100);

    return () => {
      clearInterval(glitchInterval);
      clearInterval(staticInterval);
    };
  }, [isVisible]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
        >
          {/* Dark Red Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-red-950 via-[#1a0505] to-black" />

          {/* Animated Static/Noise */}
          <div
            className="absolute inset-0 pointer-events-none mix-blend-overlay"
            style={{
              opacity: 0.15 + staticIntensity,
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Scanlines */}
          <div className="absolute inset-0 pointer-events-none opacity-30 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.3)_2px,rgba(0,0,0,0.3)_4px)]" />

          {/* Vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_20%,rgba(0,0,0,0.8)_80%)]" />

          {/* Industrial Border Frame */}
          <div className="absolute inset-4 md:inset-12 border-4 border-red-900/50 pointer-events-none">
            {/* Corner Bolts */}
            <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-900 rounded-full border-2 border-red-700 shadow-[0_0_10px_rgba(127,29,29,0.8)]" />
            <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-900 rounded-full border-2 border-red-700 shadow-[0_0_10px_rgba(127,29,29,0.8)]" />
            <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-red-900 rounded-full border-2 border-red-700 shadow-[0_0_10px_rgba(127,29,29,0.8)]" />
            <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-red-900 rounded-full border-2 border-red-700 shadow-[0_0_10px_rgba(127,29,29,0.8)]" />

            {/* Warning Strips */}
            <div className="absolute top-0 left-8 right-8 h-2 bg-[repeating-linear-gradient(90deg,#7f1d1d,#7f1d1d_20px,#1a0505_20px,#1a0505_40px)]" />
            <div className="absolute bottom-0 left-8 right-8 h-2 bg-[repeating-linear-gradient(90deg,#7f1d1d,#7f1d1d_20px,#1a0505_20px,#1a0505_40px)]" />
          </div>

          {/* Main Content */}
          <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
            {/* Signal Lost Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="mb-8"
            >
              <div className="relative inline-block">
                <WifiOff className="w-24 h-24 text-red-500 mx-auto" />
                <motion.div
                  animate={{
                    opacity: [0.5, 1, 0.5],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="w-32 h-32 rounded-full border-4 border-red-500/30" />
                </motion.div>
              </div>
            </motion.div>

            {/* RED NOTICE Header */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-6"
            >
              <div className="flex items-center justify-center gap-4 mb-4">
                <AlertOctagon className="w-8 h-8 text-red-500 animate-pulse" />
                <h1
                  className={`text-5xl md:text-7xl font-black tracking-[0.3em] uppercase ${
                    glitchText ? "text-cyan-500" : "text-red-500"
                  } transition-colors duration-75 font-typewriter`}
                  style={{
                    textShadow: glitchText
                      ? "-2px 0 cyan, 2px 0 red"
                      : "0 0 30px rgba(239,68,68,0.8), 0 0 60px rgba(239,68,68,0.4)",
                  }}
                >
                  RED NOTICE
                </h1>
                <AlertOctagon className="w-8 h-8 text-red-500 animate-pulse" />
              </div>

              {/* Flashing Alert Bar */}
              <motion.div
                animate={{
                  backgroundColor: ["rgba(127,29,29,0.5)", "rgba(239,68,68,0.3)", "rgba(127,29,29,0.5)"],
                }}
                transition={{ duration: 1, repeat: Infinity }}
                className="py-2 px-6 border-y-2 border-red-700"
              >
                <span className="text-xs md:text-sm font-mono uppercase tracking-[0.4em] text-red-300">
                  {"// PRIORITY ALERT // SYSTEM OVERRIDE //"}
                </span>
              </motion.div>
            </motion.div>

            {/* Main Message */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mb-8 space-y-4"
            >
              <p
                className={`text-lg md:text-2xl font-typewriter text-red-100 leading-relaxed max-w-2xl mx-auto ${
                  glitchText ? "skew-x-1" : ""
                } transition-transform duration-75`}
              >
                Investigator{" "}
                <span className="text-red-400 font-bold">Mongo D. Bane</span> is
                on Another Mission for this month.
              </p>
              <p className="text-base md:text-xl font-mono text-red-300/80">
                Access to the Forensic Vault is{" "}
                <span className="text-red-500 font-bold uppercase">suspended</span>{" "}
                until next month.
              </p>
            </motion.div>

            {/* Status Indicators */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex flex-wrap justify-center gap-6 mb-8"
            >
              <div className="flex items-center gap-2 text-xs font-mono text-red-400/60 uppercase">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span>Connection Severed</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-red-400/60 uppercase">
                <Radio className="w-3 h-3" />
                <span>Signal Lost</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-red-400/60 uppercase">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Awaiting Reset</span>
              </div>
            </motion.div>

            {/* Dismiss Button */}
            {onDismiss && (
              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.9 }}
                onClick={onDismiss}
                className="group relative px-8 py-3 bg-red-950 border-2 border-red-700 hover:border-red-500 transition-colors"
              >
                <span className="relative z-10 text-sm font-mono uppercase tracking-widest text-red-300 group-hover:text-red-100">
                  Return to Headquarters
                </span>
                <div className="absolute inset-0 bg-red-900/0 group-hover:bg-red-900/30 transition-colors" />
              </motion.button>
            )}

            {/* Footer Code */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1 }}
              className="mt-12 text-[10px] font-mono text-red-900/60 uppercase tracking-widest"
            >
              Error Code: LIMIT_EXCEEDED_2/MONTH // Contact: vault-support@atlas.forensic
            </motion.div>
          </div>

          {/* Glitch Lines */}
          {glitchText && (
            <>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                className="absolute top-1/3 left-0 right-0 h-1 bg-cyan-500/50"
              />
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                className="absolute top-2/3 left-0 right-0 h-0.5 bg-red-500/50"
              />
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
