/**
 * CinematicSplash — Astronaut HUD Boot Sequence (Act 1: The Awakening)
 * =====================================================================
 * Cinematic terminal boot sequence that acts as the real GPU-aware loader.
 * Classic green-phosphor terminal aesthetic. Types the Unit-7 wake-up
 * sequence line by line, holds on the GPU-ready gate, then ejects the
 * user into the Canvas.
 *
 * LORE (Act 1): the screen wakes like an old CRT terminal. Each system
 * check types in, ending on the gravitational-anomaly warning and the
 * ejection countdown — then the helmet powers on and the universe appears.
 */

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useExperienceStore } from "@/store/useExperienceStore";

// Green-phosphor terminal palette.
const TERM_GREEN = "#33ff77";
const TERM_GREEN_DIM = "#1aff66";
const TERM_GLOW = "rgba(51, 255, 119, 0.5)";
const TERM_GLOW_SOFT = "rgba(51, 255, 119, 0.35)";

// Act 1 boot script (from the Unit-7 lore). The 3rd line (index 3) is the
// GPU-ready hold point — the WARNING lands once the scene is ready, then
// the ejection countdown fires.
const BOOT_MESSAGES = [
  "> WAKING UNIT-7... [OK]",
  "> QUANTUM ENTANGLEMENT COMM-LINK... [STABLE]",
  "> EXTREME THERMAL SHIELDING... [MAXIMUM]",
  "> WARNING: GRAVITATIONAL ANOMALY DETECTED.",
  "> TIME DILATION CALCULATION... [ENABLED]",
  "> EJECTING PROBE IN 3... 2... 1...",
];

// Index at which we HOLD until the GPU/scene reports ready.
const HOLD_INDEX = 3;

export function CinematicSplash() {
  const [visible, setVisible] = useState(true);
  const [step, setStep] = useState(0);
  const isReady = useExperienceStore((s) => s.isReady);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (step < HOLD_INDEX) {
      // Cycle through the initial system checks.
      timer = setTimeout(() => setStep((s) => s + 1), 600);
    } else if (step === HOLD_INDEX) {
      // Hold on the WARNING line until the scene is ready.
      if (isReady) {
        timer = setTimeout(() => setStep((s) => s + 1), 500);
      }
    } else if (step < BOOT_MESSAGES.length - 1) {
      // Remaining lines after the hold (time-dilation, ejection countdown).
      timer = setTimeout(() => setStep((s) => s + 1), 700);
    } else {
      // Final line (ejection) holds briefly, then the splash fades out.
      timer = setTimeout(() => setVisible(false), 1600);
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
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
          style={{ pointerEvents: "all", backgroundColor: "#020503" }}
        >
          {/* CRT scanline overlay for the terminal feel. */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "repeating-linear-gradient(0deg, rgba(51,255,119,0.04) 0px, rgba(51,255,119,0.04) 1px, transparent 1px, transparent 3px)",
              mixBlendMode: "screen",
            }}
          />
          {/* Soft green vignette glow. */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "radial-gradient(ellipse at center, rgba(51,255,119,0.06) 0%, transparent 60%)",
            }}
          />

          <div
            className="flex flex-col items-start text-sm md:text-base lg:text-lg px-6 w-full max-w-2xl"
            style={{ fontFamily: "'Courier New','Lucida Console',monospace" }}
          >
            {BOOT_MESSAGES.slice(0, step + 1).map((msg, idx) => {
              const isWarning = msg.includes("WARNING");
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className="mb-2 tracking-wide"
                  style={{
                    color: isWarning ? "#ffae3c" : TERM_GREEN,
                    textShadow: isWarning
                      ? "0 0 10px rgba(255,174,60,0.5)"
                      : `0 0 10px ${TERM_GLOW}`,
                  }}
                >
                  {msg}
                  {idx === step && (
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                      className="inline-block ml-1"
                      style={{ color: TERM_GREEN }}
                    >
                      _
                    </motion.span>
                  )}
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            transition={{ delay: 1, duration: 2 }}
            className="absolute bottom-12 left-0 right-0 text-center text-xs tracking-[0.2em]"
            style={{
              fontFamily: "'Courier New',monospace",
              color: TERM_GREEN_DIM,
              textShadow: `0 0 8px ${TERM_GLOW_SOFT}`,
            }}
          >
            RECOMMENDED EXPERIENCE: DESKTOP / PC
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}