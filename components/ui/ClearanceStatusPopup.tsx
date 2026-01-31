"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FileWarning, X, Shield } from "lucide-react";
import { InvestigationStatus } from "@/lib/auth/investigations";

interface ClearanceStatusPopupProps {
  status: InvestigationStatus | null;
  isVisible: boolean;
  onClose: () => void;
}

export function ClearanceStatusPopup({
  status,
  isVisible,
  onClose,
}: ClearanceStatusPopupProps) {
  if (!status) return null;

  const { remaining, total, currentMonth } = status;
  const isLow = remaining === 1;
  const isEmpty = remaining === 0;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed top-4 right-4 z-50 max-w-sm"
        >
          <div
            className={`relative border-2 ${
              isEmpty
                ? "bg-red-950/95 border-red-700"
                : isLow
                ? "bg-amber-950/95 border-amber-700"
                : "bg-zinc-900/95 border-zinc-700"
            } backdrop-blur-sm shadow-2xl`}
          >
            {/* Industrial Corner Brackets */}
            <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-amber-500/50" />
            <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-amber-500/50" />
            <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-amber-500/50" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-amber-500/50" />

            {/* Header */}
            <div
              className={`flex items-center justify-between px-4 py-2 border-b ${
                isEmpty
                  ? "border-red-700 bg-red-900/50"
                  : isLow
                  ? "border-amber-700 bg-amber-900/50"
                  : "border-zinc-700 bg-zinc-800/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield
                  className={`w-4 h-4 ${
                    isEmpty
                      ? "text-red-400"
                      : isLow
                      ? "text-amber-400"
                      : "text-green-400"
                  }`}
                />
                <span className="text-xs font-mono uppercase tracking-widest text-zinc-300">
                  Wiretap Status
                </span>
              </div>
              <button
                onClick={onClose}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Dossier Counter */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <FileWarning
                    className={`w-5 h-5 ${
                      isEmpty
                        ? "text-red-400"
                        : isLow
                        ? "text-amber-400"
                        : "text-green-400"
                    }`}
                  />
                  <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">
                    Remaining Dossiers
                  </span>
                </div>
                <div
                  className={`text-5xl font-black font-mono ${
                    isEmpty
                      ? "text-red-400"
                      : isLow
                      ? "text-amber-400"
                      : "text-green-400"
                  }`}
                >
                  {remaining}
                  <span className="text-zinc-500 text-2xl">/{total}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative h-2 bg-zinc-800 border border-zinc-700">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(remaining / total) * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`absolute inset-y-0 left-0 ${
                    isEmpty
                      ? "bg-red-500"
                      : isLow
                      ? "bg-amber-500"
                      : "bg-green-500"
                  }`}
                />
              </div>

              {/* Month Indicator */}
              <div className="text-center">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                  Allocation Period: {currentMonth}
                </span>
              </div>

              {/* Warning Message */}
              {isEmpty && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 p-3 bg-red-900/30 border border-red-800/50 text-center"
                >
                  <span className="text-xs font-mono text-red-300 uppercase tracking-wide">
                    ⚠ Monthly clearance exhausted. Contact HQ for emergency
                    access.
                  </span>
                </motion.div>
              )}

              {isLow && !isEmpty && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 p-3 bg-amber-900/30 border border-amber-800/50 text-center"
                >
                  <span className="text-xs font-mono text-amber-300 uppercase tracking-wide">
                    ⚠ Final dossier remaining. Use wisely, investigator.
                  </span>
                </motion.div>
              )}
            </div>

            {/* Scanline Effect */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-10">
              <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.03)_2px,rgba(255,255,255,0.03)_4px)]" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
