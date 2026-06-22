/**
 * SceneOverlay — DOM Text Overlays for Cinematic Timeline
 * ========================================================
 * Renders phase-specific text as HTML over the Canvas.
 * Blur is handled by EffectComposer DepthOfField (not CSS).
 *
 * HOME (scroll=0): "SPACE IS NOT EMPTY" centered
 * The intro fades out over the FIRST sliver of scroll (0 → 0.04) so it
 * clears immediately on the first scroll — independent of how long the
 * awakening phase lasts (the phase is driven by world position now, and
 * may run until the camera reaches the nebula).
 */

"use client";

import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
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

/**
 * IntroText — the centered "SPACE IS NOT EMPTY" block.
 * Fades out on the first scroll gesture (scrollProgress 0 → 0.04). It reads
 * scrollProgress from the STORE — the same source the whole app uses (fed by
 * the drei ScrollControls) — because framer-motion's window scrollYProgress
 * is NOT connected to the drei scroll element, so it would never update here.
 */
function IntroText() {
  const scrollProgress = useExperienceStore((s) => s.scrollProgress);
  const introOpacity = Math.max(0, 1 - scrollProgress / 0.04);

  return (
    <motion.div
      key="home"
      style={{ opacity: introOpacity }}
      className="text-center"
    >
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 1.0, duration: 2, ease: "easeOut" }}
        className="text-xs tracking-[0.6em] uppercase mb-8"
        style={{ color: "#fff" }}
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
        EVENT HORIZON
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 2.0, duration: 1.5, ease: "easeOut" }}
        className="text-sm tracking-wide max-w-lg mx-auto"
        style={{ color: "#fff" }}
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
}

function PhaseContent({ phase }: { phase: string }) {
  switch (phase) {
    case "home":
    case "awakening":
      return <IntroText />;

    case "discovery":
    case "approach":
    case "event-horizon":
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
      <div className={containerClass}>
        <AnimatePresence mode="wait">
          <PhaseContent phase={phase} />
        </AnimatePresence>
      </div>
      <SingularityBlackout />
    </>
  );
}