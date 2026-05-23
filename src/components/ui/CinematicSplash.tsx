/**
 * CinematicSplash — Real GPU-Aware Loader
 * ========================================
 * Shows a black loading screen with a percentage counter that
 * ACTUALLY waits for the Canvas to signal readiness (isReady).
 *
 * Flow:
 * 1. Shows immediately with 0%
 * 2. Progress animates up to 85% on a timer (visual feedback)
 * 3. Holds at 85% until isReady === true (real GPU compilation done)
 * 4. Snaps to 100%, holds briefly, then fades out
 * 5. Minimum 1.5s display time ensures no flash
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useExperienceStore } from "@/store/useExperienceStore";

const MINIMUM_MS = 1500;

export function CinematicSplash() {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const isReady = useExperienceStore((s) => s.isReady);
  const startTime = useRef(Date.now());
  const rafRef = useRef<number>(0);

  // Phase 1: Animate to 85% on a timer (fake but provides UX feedback)
  useEffect(() => {
    const animate = () => {
      const elapsed = Date.now() - startTime.current;
      const t = Math.min(1, elapsed / 2000); // 2s ramp
      const eased = 1 - Math.pow(1 - t, 3);
      const target = Math.round(eased * 85); // Cap at 85%

      setProgress((prev) => Math.max(prev, target));

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Phase 2: When Canvas signals ready AND minimum time passed → 100%
  useEffect(() => {
    if (!isReady) return;

    const elapsed = Date.now() - startTime.current;
    const remaining = Math.max(0, MINIMUM_MS - elapsed);

    const timer = setTimeout(() => {
      setProgress(100);
      // Hold at 100% briefly, then hide
      setTimeout(() => setVisible(false), 500);
    }, remaining);

    return () => clearTimeout(timer);
  }, [isReady]);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.0, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
          style={{
            backgroundColor: "#020206",
            pointerEvents: "all",
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div
              className="text-6xl md:text-8xl font-extralight tracking-widest"
              style={{
                color: "#e8d8f0",
                fontFamily: "var(--font-space-grotesk), monospace",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {progress}
              <span
                className="text-2xl md:text-3xl ml-1"
                style={{ color: "#5a4a6a" }}
              >
                %
              </span>
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              transition={{ delay: 0.3, duration: 1 }}
              className="text-xs tracking-[0.5em] uppercase mt-6"
              style={{ color: "#5a4a6a" }}
            >
              {progress < 100 ? "Compiling shaders" : "Ready"}
            </motion.p>

            {/* Thin progress bar */}
            <div
              className="mt-8 mx-auto overflow-hidden"
              style={{
                width: 180,
                height: 1,
                backgroundColor: "rgba(90, 74, 106, 0.15)",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  backgroundColor: "#8b6a9e",
                  transition: "width 0.3s ease-out",
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
