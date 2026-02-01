"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FolderOpen } from "lucide-react";

interface AuthButtonProps {
  variant: "primary" | "secondary";
  onClick?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function AuthButton({
  variant,
  onClick,
  disabled = false,
  isLoading = false,
  children,
  className = "",
}: AuthButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // Boot-up flicker animation
  const bootUpAnimation = {
    initial: { 
      opacity: 0,
      filter: "brightness(0)",
    },
    animate: { 
      opacity: 1,
      filter: "brightness(1)",
      transition: {
        duration: 0.8,
        times: [0, 0.2, 0.3, 0.5, 0.6, 0.8, 1],
        opacity: [0, 1, 0.3, 1, 0.5, 1, 1],
      },
    },
  };

  // Glitch text animation
  const glitchAnimation = {
    x: [0, -2, 2, -1, 1, 0],
    y: [0, 1, -1, 2, -2, 0],
    transition: {
      duration: 0.3,
      repeat: isHovered ? Infinity : 0,
      repeatDelay: 0.8,
    },
  };

  const primaryStyles = `
    relative overflow-hidden
    bg-zinc-900/90 
    border border-zinc-700 
    px-8 py-3.5
    font-mono text-sm tracking-[0.2em] uppercase
    transition-all duration-300
    ${isHovered ? "border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.15)]" : "border-zinc-700/50"}
    ${isPressed ? "scale-95" : "scale-100"}
    ${disabled || isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
  `;

  const secondaryStyles = `
    relative overflow-hidden
    bg-transparent
    border-2 border-dashed border-zinc-600/50
    px-8 py-3.5
    font-mono text-sm tracking-[0.2em] uppercase
    transition-all duration-300
    ${isHovered ? "border-solid border-cyan-500/70 shadow-[0_0_15px_rgba(6,182,212,0.1)]" : ""}
    ${isPressed ? "scale-95" : "scale-100"}
    ${disabled || isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
  `;

  const handleMouseDown = () => {
    if (!disabled && !isLoading) {
      setIsPressed(true);
    }
  };

  const handleMouseUp = () => {
    setIsPressed(false);
  };

  const handleClick = () => {
    if (!disabled && !isLoading && onClick) {
      onClick();
    }
  };

  return (
    <motion.button
      {...bootUpAnimation}
      className={`${variant === "primary" ? primaryStyles : secondaryStyles} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      disabled={disabled || isLoading}
      whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
    >
      {/* Scan-line texture overlay (Primary only) */}
      {variant === "primary" && isHovered && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(245, 158, 11, 0.03) 2px,
              rgba(245, 158, 11, 0.03) 4px
            )`,
          }}
          initial={{ y: "-100%" }}
          animate={{ y: "100%" }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      )}

      {/* Corner brackets decoration */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-current opacity-40" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-current opacity-40" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-current opacity-40" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-current opacity-40" />

      {/* Button content */}
      <div className="relative flex items-center justify-center gap-3">
        {/* Access indicator dot (Primary only) */}
        {variant === "primary" && (
          <motion.div
            className={`w-2 h-2 rounded-full ${
              isLoading 
                ? "bg-amber-500" 
                : isHovered 
                ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" 
                : "bg-zinc-600"
            }`}
            animate={isLoading ? {
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.2, 0.8],
            } : {}}
            transition={isLoading ? {
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            } : {}}
          />
        )}

        {/* Text content with glitch effect */}
        <motion.span
          className={`relative ${
            variant === "primary"
              ? isHovered
                ? "text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                : "text-zinc-400"
              : isHovered
              ? "text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.4)]"
              : "text-zinc-500"
          }`}
          animate={isHovered && !isLoading ? glitchAnimation : {}}
        >
          {isLoading && variant === "primary" ? "GRANTING ACCESS..." : children}
        </motion.span>

        {/* Folder icon (Secondary only) */}
        {variant === "secondary" && isHovered && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            <FolderOpen className="w-4 h-4 text-cyan-400" strokeWidth={1.5} />
          </motion.div>
        )}
      </div>

      {/* Flash overlay on click (Primary only) */}
      <AnimatePresence>
        {isPressed && variant === "primary" && (
          <motion.div
            className="absolute inset-0 bg-amber-400/20 pointer-events-none"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>

      {/* Glitch lines overlay */}
      {isHovered && variant === "primary" && (
        <>
          <motion.div
            className="absolute left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"
            style={{ top: "30%" }}
            animate={{
              opacity: [0, 1, 0],
              scaleX: [0, 1, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              repeatDelay: 2,
            }}
          />
          <motion.div
            className="absolute left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"
            style={{ top: "70%" }}
            animate={{
              opacity: [0, 1, 0],
              scaleX: [0, 1, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              repeatDelay: 2,
              delay: 0.5,
            }}
          />
        </>
      )}

      {/* Border glow pulse (on hover) */}
      {isHovered && (
        <div
          className={`absolute inset-0 pointer-events-none ${
            variant === "primary"
              ? "shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]"
              : "shadow-[inset_0_0_15px_rgba(6,182,212,0.08)]"
          }`}
        />
      )}
    </motion.button>
  );
}
