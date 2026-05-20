/**
 * SceneOverlay — DOM Text Overlays with Framer Motion
 * ====================================================
 * Renders phase-specific text content as HTML overlaid on the Canvas.
 * Uses Framer Motion for smooth entrance/exit animations.
 *
 * The overlay reads the current phase from Zustand and renders
 * the appropriate content with cinematic fade transitions.
 */

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useExperienceStore } from "@/store/useExperienceStore";

const fadeVariants = {
  initial: { opacity: 0, y: 20, filter: "blur(4px)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
  exit: {
    opacity: 0,
    y: -10,
    filter: "blur(6px)",
    transition: { duration: 0.8, ease: "easeInOut" as const },
  },
};

function PhaseContent({ phase }: { phase: string }) {
  switch (phase) {
    case "nebula":
      return (
        <motion.div
          key="nebula"
          variants={fadeVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="text-center"
        >
          <p className="text-sm tracking-[0.4em] uppercase text-slate-500 mb-4">
            An immersive WebGL experience
          </p>
          <h1 className="text-5xl md:text-7xl font-light tracking-[0.15em] text-slate-200 mb-6">
            EVENT HORIZON
          </h1>
          <p className="text-base text-slate-500 tracking-wide max-w-md mx-auto">
            Scroll to descend into the gravitational abyss
          </p>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="mt-12 text-slate-600"
          >
            <svg
              className="w-6 h-6 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </motion.div>
        </motion.div>
      );

    case "discovery":
      return (
        <motion.div
          key="discovery"
          variants={fadeVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="text-right"
        >
          <p className="text-xs tracking-[0.6em] uppercase text-slate-600 mb-3">
            Phase II
          </p>
          <h2 className="text-2xl md:text-3xl font-light tracking-[0.1em] text-slate-300">
            DISCOVERY
          </h2>
          <p className="text-xs text-slate-500 mt-3 max-w-xs ml-auto">
            Light bends. Space warps. Something massive lies ahead.
          </p>
        </motion.div>
      );

    case "approach":
      return (
        <motion.div
          key="approach"
          variants={fadeVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="text-right"
        >
          <p className="text-xs tracking-[0.6em] uppercase text-orange-600/40 mb-2">
            Phase III
          </p>
          <h2 className="text-xl md:text-2xl font-light tracking-[0.1em] text-slate-300/70">
            APPROACH
          </h2>
          <p className="text-xs text-slate-500/60 mt-2 max-w-xs ml-auto">
            The fabric of spacetime stretches.
          </p>
        </motion.div>
      );

    case "event-horizon":
      return (
        <motion.div
          key="event-horizon"
          variants={fadeVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="text-right"
        >
          <p className="text-xs tracking-[0.3em] uppercase text-red-800/40 mb-2">
            POINT OF NO RETURN
          </p>
          <h2 className="text-lg md:text-xl font-light text-red-900/60">
            EVENT HORIZON
          </h2>
        </motion.div>
      );

    case "singularity":
      return null; // Pure silence

    default:
      return null;
  }
}

/**
 * SingularityBlackout — Fade to total black when entering singularity.
 * This creates the dramatic "falling into the black hole" effect.
 * The opacity smoothly ramps from 0 to 1 as scrollProgress goes from 0.85 to 0.98.
 */
function SingularityBlackout() {
  const scrollProgress = useExperienceStore((s) => s.scrollProgress);

  // Start fading at 90%, fully black by 98% (camera is deep inside BH by then)
  const blackoutOpacity = Math.min(
    1,
    Math.max(0, (scrollProgress - 0.90) / 0.08)
  );

  if (blackoutOpacity <= 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none"
      style={{
        backgroundColor: "#000000",
        opacity: blackoutOpacity,
        transition: "opacity 0.3s ease-out",
      }}
    />
  );
}

export function SceneOverlay() {
  const phase = useExperienceStore((s) => s.phase);

  // Nebula phase: centered (no black hole to avoid)
  // All other phases: bottom-right (clear the black hole center)
  const isNebula = phase === "nebula";
  const containerClass = isNebula
    ? "fixed inset-0 pointer-events-none z-10 flex items-center justify-center"
    : "fixed inset-0 pointer-events-none z-10 flex items-end justify-end p-8 pb-20";

  return (
    <>
      {/* Phase text overlays */}
      <div className={containerClass}>
        <AnimatePresence mode="wait">
          <PhaseContent phase={phase} />
        </AnimatePresence>
      </div>

      {/* Singularity blackout — fade to total black */}
      <SingularityBlackout />
    </>
  );
}
