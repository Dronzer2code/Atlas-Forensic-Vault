"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

const MESSAGES = [
  { text: "PROPRIETARY SOFTWARE © 2026 TEAM LOWENDCORP", highlight: "TEAM LOWENDCORP" },
  { text: "DEVELOPED BY: SOUMYADEEP DEY", highlight: "SOUMYADEEP DEY" },
  { text: "DEVELOPED BY: SUBARNA MAITY", highlight: "SUBARNA MAITY" },
  { text: "DEVELOPED BY: SAIKAT DAS", highlight: "SAIKAT DAS" },
  { text: "DEVELOPED BY: SOURISH PANDA", highlight: "SOURISH PANDA" },
];

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&";

export function Footer() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState(MESSAGES[0].text);
  const [targetMessage, setTargetMessage] = useState(MESSAGES[0]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const scrambleText = (target: string) => {
    let iteration = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setDisplayText(() =>
        target
          .split("")
          .map((char, index) => {
            if (index < iteration) {
              return target[index];
            }
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join("")
      );

      if (iteration >= target.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplayText(target);
      }

      iteration += 1 / 2; // Speed of scramble
    }, 30);
  };

  useEffect(() => {
    const cycleInterval = setInterval(() => {
      setCurrentIndex((prev) => {
        const nextIndex = (prev + 1) % MESSAGES.length;
        setTargetMessage(MESSAGES[nextIndex]);
        scrambleText(MESSAGES[nextIndex].text);
        return nextIndex;
      });
    }, 10000); // 10 seconds

    return () => clearInterval(cycleInterval);
  }, []);

  const renderContent = () => {
    const currentFullText = targetMessage.text;
    const highlightText = targetMessage.highlight;
    
    return displayText.split("").map((char, i) => {
      // Check if this index is part of the highlight section in the TARGET string
      const highlightStart = currentFullText.indexOf(highlightText);
      const highlightEnd = highlightStart + highlightText.length;
      
      const isHighlightPosition = i >= highlightStart && i < highlightEnd;
      
      // Only highlight if the character matches the target (it's revealed)
      // This creates a cool effect where the red text "emerges" from the scramble
      const isRevealed = char === currentFullText[i];
      
      const shouldHighlight = isHighlightPosition && isRevealed;

      return (
        <span 
          key={i} 
          className={shouldHighlight ? "text-[#ff0000] font-bold drop-shadow-[0_0_5px_rgba(255,0,0,0.6)]" : "text-zinc-500"}
        >
          {char}
        </span>
      );
    });
  };

  return (
    <footer className="w-full bg-[#050505] relative overflow-hidden mt-auto z-40 border-t border-neutral-800">
      {/* Diagonal Brushed Metal Texture */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 2px, #333 2px, #333 4px)"
        }}
      />

      <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4 relative z-10">
        
        {/* Left: Status LED */}
        <div className="flex items-center gap-3 order-2 md:order-1 w-full md:w-auto justify-center md:justify-start">
          <div className="relative">
            <div className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping opacity-75" />
          </div>
          <span className="font-courier text-[10px] tracking-[0.2em] text-amber-700/80 select-none">
            ENCRYPTION_ACTIVE
          </span>
        </div>

        {/* Center: Dynamic Branding & Link */}
        <div className="flex flex-col items-center gap-2 order-1 md:order-2 text-center w-full md:w-auto">
          <div className="font-courier text-xs sm:text-sm tracking-widest uppercase h-5 whitespace-nowrap">
            {renderContent()}
          </div>
          
          <Link 
            href="https://github.com/SoumyaEXE/Atlas-Forensic-Vault"
            target="_blank"
            className="group relative inline-flex items-center gap-2 px-3 py-1 overflow-hidden font-courier text-[10px] tracking-widest text-zinc-600 transition-all duration-300 hover:text-red-500 hover:bg-red-950/10 border border-transparent hover:border-red-900/30 rounded-sm"
            suppressHydrationWarning
          >
            <span className="relative z-10 group-hover:animate-pulse">[ ACCESS_SOURCE_CODE ]</span>
          </Link>
        </div>

        {/* Right: System ID */}
        <div className="font-courier text-[10px] text-zinc-700 tracking-widest order-3 w-full md:w-auto text-center md:text-right select-none">
          STATION: KH_WB_IN // UNIT_ID: D71DE589
        </div>

      </div>
    </footer>
  );
}
