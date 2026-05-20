/**
 * HUD — Heads-Up Display
 * =======================
 * Bottom-left technical readout showing current phase,
 * coordinates, and gravity level.
 * Minimal, scientific design.
 */

"use client";

import { motion } from "framer-motion";
import { useExperienceStore } from "@/store/useExperienceStore";
import { PHASES } from "@/lib/constants";

export function HUD() {
  const phase = useExperienceStore((s) => s.phase);
  const gravity = useExperienceStore((s) => s.gravity);
  const scrollProgress = useExperienceStore((s) => s.scrollProgress);

  const phaseConfig = PHASES.find((p) => p.id === phase);
  const phaseIndex = PHASES.findIndex((p) => p.id === phase);

  // Fade out in singularity
  const opacity = phase === "singularity" ? 0 : 0.6;

  return (
    <motion.div
      className="fixed bottom-6 left-8 z-20 font-mono text-[10px] tracking-[0.2em] uppercase text-slate-600 space-y-1"
      animate={{ opacity }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-pulse" />
        <span>Phase {phaseIndex + 1}/5 — {phaseConfig?.label}</span>
      </div>
      <div>
        Gravity: {(gravity * 100).toFixed(1)}%
      </div>
      <div>
        Depth: {(scrollProgress * 100).toFixed(1)}%
      </div>
    </motion.div>
  );
}
