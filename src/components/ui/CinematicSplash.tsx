/**
 * CinematicSplash — Astronaut HUD Boot Sequence
 * =====================================================
 * Cinematic terminal boot sequence that acts as the real GPU-aware loader.
 * Displays sequential system checks, holds if necessary, and ejects 
 * the user into the Canvas once `isReady` is true.
 */

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useExperienceStore } from "@/store/useExperienceStore";

const BOOT_MESSAGES = [
  "> INITIALIZING VITAL SYSTEMS... [OK]",
  "> CALIBRATING OPTICAL SENSORS... [OK]",
  "> NEURAL LINK ESTABLISHED.",
  "> WARNING: GRAVITATIONAL ANOMALY DETECTED.",
  "> EJECTING CAPSULE IN 3... 2... 1...",
];

export function CinematicSplash() {
  const [visible, setVisible] = useState(true);
  const [step, setStep] = useState(0);
  const isReady = useExperienceStore((s) => s.isReady);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (step < 3) {
      // Cycle through initial steps
      timer = setTimeout(() => setStep((s) => s + 1), 600);
    } else if (step === 3) {
      // Hold at step 4 (index 3) until isReady is true
      if (isReady) {
        timer = setTimeout(() => setStep(4), 400);
      }
    } else if (step === 4) {
      // Hold final step for 1.5s, then fade out
      timer = setTimeout(() => setVisible(false), 1500);
    }

    return () => clearTimeout(timer);
  }, [step, isReady]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loader"
          initial={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1, filter: "brightness(2)" }}
          transition={{ duration: 0.25, ease: "circIn" }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#030308]"
          style={{ pointerEvents: "all" }}
        >
          <div className="flex flex-col items-start font-mono text-cyan-400 text-sm md:text-base lg:text-lg px-6 w-full max-w-2xl">
            {BOOT_MESSAGES.slice(0, step + 1).map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="mb-2 tracking-wide"
                style={{ textShadow: "0 0 10px rgba(34, 211, 238, 0.5)" }}
              >
                {msg}
                {idx === step && (
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.8,
                      ease: "linear",
                    }}
                    className="inline-block ml-1"
                  >
                    _
                  </motion.span>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
