/**
 * SceneOverlay — DOM Text Overlays for Cinematic Timeline
 * ========================================================
 * Renders phase-specific text as HTML over the Canvas.
 * Blur is handled by EffectComposer DepthOfField (not CSS).
 *
 * HOME (scroll=0): "SPACE IS NOT EMPTY" centered
 * AWAKENING (0→0.15): Text fades out
 * DISCOVERY (0.60+): Phase text appears bottom-right
 */

"use client";

import { AnimatePresence, motion, useScroll, useTransform, useMotionTemplate } from "framer-motion";
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
    y: -20,
    filter: "blur(6px)",
    transition: { duration: 0.8, ease: "easeInOut" as const },
  },
};

function PhaseContent({ phase }: { phase: string }) {
  switch (phase) {
    case "home":
    case "awakening":
      return (
        <motion.div
          key="home"
          variants={fadeVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="text-center"
        >
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 1.0, duration: 2, ease: "easeOut" }}
            className="text-xs tracking-[0.6em] uppercase mb-8"
            style={{ color: "#8b6a9e" }}
          >
            An immersive WebGL experience
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 2.0, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-5xl md:text-7xl font-extralight tracking-[0.2em] mb-8"
            style={{ color: "#e8d8f0" }}
          >
            SPACE IS NOT EMPTY
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 2.0, duration: 1.5, ease: "easeOut" }}
            className="text-sm tracking-wide max-w-lg mx-auto"
            style={{ color: "#7a6a8a" }}
          >
            Scroll to descend into the gravitational abyss
          </motion.p>
          {/* Scroll arrow — fixed explicit dimensions */}
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            className="mt-16 flex justify-center"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5a4a6a"
              strokeWidth={1}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: "block", flexShrink: 0 }}
            >
              <path d="M19 14l-7 7m0 0l-7-7m7 7V3" />
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
    case "traversal":
    case "revelation":
      return null;

    default:
      return null;
  }
}

// ─── END PHASE CONTENT ───

/**
 * NebulaBlurOverlay — CSS blur over the Canvas during home state.
 * Uses framer-motion useScroll to avoid React re-renders.
 */
function NebulaBlurOverlay() {
  const { scrollYProgress } = useScroll();
  const blur = useTransform(scrollYProgress, [0, 0.15], [10, 0]);
  const filter = useMotionTemplate`blur(${blur}px)`;

  return (
    <motion.div
      className="fixed inset-0 z-[5] pointer-events-none"
      style={{
        backdropFilter: filter,
        WebkitBackdropFilter: filter,
      }}
    />
  );
}

/**
 * SingularityBlackout — Fast fade to black during suck-in.
 */
function SingularityBlackout() {
  const { scrollYProgress } = useScroll();
  const blackoutOpacity = useTransform(scrollYProgress, [0.88, 0.96], [0, 1]);

  return (
    <motion.div
      className="fixed inset-0 z-50 pointer-events-none"
      style={{ backgroundColor: "#000000", opacity: blackoutOpacity }}
    />
  );
}

export function SceneOverlay() {
  const phase = useExperienceStore((s) => s.phase);

  // Home/awakening: centered. Others: bottom-right
  const isHome = phase === "home" || phase === "awakening";
  const containerClass = isHome
    ? "fixed inset-0 pointer-events-none z-10 flex items-center justify-center"
    : "fixed inset-0 pointer-events-none z-10 flex items-end justify-end p-8 pb-20";

  return (
    <>
      <NebulaBlurOverlay />
      <div className={containerClass}>
        <AnimatePresence mode="wait">
          <PhaseContent phase={phase} />
        </AnimatePresence>
      </div>
      <SingularityBlackout />
    </>
  );
}
