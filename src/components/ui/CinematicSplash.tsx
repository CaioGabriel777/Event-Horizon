/**
 * CinematicSplash — Apple-style Loading Transition
 * =================================================
 * Shows a beautiful, animated splash screen while the WebGL
 * Canvas and WASM modules are loading. This prevents the
 * "frozen screen" feeling by giving immediate visual feedback.
 *
 * Flow:
 * 1. Immediately shows a dark screen with subtle animations
 * 2. Title fades in with a cinematic blur-to-sharp effect
 * 3. After a minimum display time, fades out to reveal the Canvas
 * 4. The scroll becomes functional only after the splash completes
 *
 * This mirrors Apple's approach: show a polished animation that
 * "tricks" the user into thinking it's intentional, not loading.
 */

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CinematicSplashProps {
  /** Minimum time to show the splash (ms). Ensures animation completes. */
  minimumDisplayMs?: number;
}

export function CinematicSplash({
  minimumDisplayMs = 2800,
}: CinematicSplashProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, minimumDisplayMs);

    return () => clearTimeout(timer);
  }, [minimumDisplayMs]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#020206]"
          style={{ pointerEvents: visible ? "all" : "none" }}
        >
          {/* Subtle radial gradient backdrop */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(10,14,26,0.4) 0%, rgba(2,2,6,1) 70%)",
            }}
          />

          {/* Animated title sequence */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, filter: "blur(12px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{
              duration: 1.8,
              delay: 0.3,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className="relative z-10 text-center"
          >
            <h1
              className="text-5xl md:text-7xl font-extralight tracking-[0.2em] text-slate-200/90"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              EVENT HORIZON
            </h1>

            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "60%" }}
              transition={{ duration: 1.2, delay: 1.2, ease: "easeInOut" }}
              className="h-[1px] bg-gradient-to-r from-transparent via-slate-600 to-transparent mx-auto mt-6"
            />

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ duration: 1, delay: 1.8 }}
              className="text-xs tracking-[0.5em] uppercase text-slate-500 mt-4"
            >
              Initializing spacetime
            </motion.p>
          </motion.div>

          {/* Subtle pulsing dot loader */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ duration: 0.8, delay: 2 }}
            className="absolute bottom-12 flex gap-1.5"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 1.2,
                  delay: i * 0.2,
                  repeat: Infinity,
                }}
                className="w-1 h-1 rounded-full bg-slate-500"
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
