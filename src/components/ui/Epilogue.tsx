/**
 * Epilogue — Act 6: The Message from the Future
 * =============================================================
 * The final beat of the Unit-7 protocol. After the singularity swallows
 * everything into total black, the experience FREEZES here (no loop). A
 * few seconds of absolute dark and silence pass, then an amber/green
 * terminal cursor blinks to life and types Earth Command's transmission
 * letter by letter — the probe's sacrifice paid off, humanity survived.
 *
 * Ends on [CONNECTION TERMINATED] and a single action to re-establish the
 * connection (a full page reload — cleanest possible state reset).
 *
 * Driven by the `isEpilogue` store flag, which SingularityPass raises at
 * the blackout instead of auto-restarting the loop.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useExperienceStore } from "@/store/useExperienceStore";
import { EARTH_END_YEAR } from "@/store/useExperienceStore";

// Amber-on-black terminal palette (the "received transmission" tone, set
// apart from the green BOOT terminal of Act 1).
const AMBER = "#ffce7a";
const AMBER_DIM = "rgba(255, 206, 122, 0.55)";
const AMBER_GLOW = "rgba(255, 206, 122, 0.45)";

// Seconds of total black before the terminal wakes (lore: build tension).
const BLACK_HOLD_SEC = 2.6;
// Per-character type speed (ms).
const TYPE_MS = 38;
// Pause between lines (ms).
const LINE_PAUSE_MS = 380;

const EARTH_YEAR_LABEL = EARTH_END_YEAR.toLocaleString("en-US"); // "42,026"

// The transmission. `pause` adds a beat after a line; `dim` renders muted.
const TRANSMISSION: { text: string; dim?: boolean; pause?: number }[] = [
  { text: "RECEIVING PACKET...", dim: true, pause: 600 },
  { text: "SENDER: EARTH COMMAND" },
  { text: `TIMESTAMP: YEAR ${EARTH_YEAR_LABEL}`, pause: 500 },
  { text: "" },
  { text: "Transmission decoded." },
  { text: "The anomaly data provided the key to quantum propulsion." },
  { text: "Humanity has found a new home." },
  { text: "" },
  { text: "Thank you, Unit-7.", pause: 800 },
  { text: "" },
  { text: "[CONNECTION TERMINATED]", dim: true },
];

export function Epilogue() {
  const isEpilogue = useExperienceStore((s) => s.isEpilogue);

  // Which lines are fully typed, and how much of the current line is shown.
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // After the black hold, begin typing.
  useEffect(() => {
    if (!isEpilogue) return;
    const t = setTimeout(() => setStarted(true), BLACK_HOLD_SEC * 1000);
    timers.current.push(t);
    return () => clearTimeout(t);
  }, [isEpilogue]);

  // Typewriter driver.
  useEffect(() => {
    if (!started || done) return;

    const line = TRANSMISSION[lineIdx];
    if (!line) {
      setDone(true);
      return;
    }

    // Empty line — skip with a short beat.
    if (line.text.length === 0) {
      const t = setTimeout(() => {
        setLineIdx((i) => i + 1);
        setCharIdx(0);
      }, LINE_PAUSE_MS);
      timers.current.push(t);
      return;
    }

    if (charIdx < line.text.length) {
      const t = setTimeout(() => setCharIdx((c) => c + 1), TYPE_MS);
      timers.current.push(t);
    } else {
      // Line finished — pause, then next line.
      const t = setTimeout(() => {
        setLineIdx((i) => i + 1);
        setCharIdx(0);
      }, line.pause ?? LINE_PAUSE_MS);
      timers.current.push(t);
    }
  }, [started, done, lineIdx, charIdx]);

  // Cleanup all timers on unmount.
  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  if (!isEpilogue) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="epilogue"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="fixed inset-0 z-[120] flex items-center justify-center"
        style={{ backgroundColor: "#000000", pointerEvents: "all" }}
      >
        {/* CRT scanlines + amber vignette */}
        <div aria-hidden style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "repeating-linear-gradient(0deg, rgba(255,206,122,0.035) 0px, rgba(255,206,122,0.035) 1px, transparent 1px, transparent 3px)",
          mixBlendMode: "screen",
        }} />
        <div aria-hidden style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse at center, rgba(255,206,122,0.05) 0%, transparent 65%)",
        }} />

        <div
          className="px-6 w-full max-w-2xl"
          style={{ fontFamily: "'Courier New','Lucida Console',monospace" }}
        >
          {TRANSMISSION.slice(0, lineIdx + 1).map((line, idx) => {
            const isCurrent = idx === lineIdx;
            const shown = isCurrent ? line.text.slice(0, charIdx) : line.text;
            if (line.text.length === 0) return <div key={idx} style={{ height: "1.1em" }} />;
            return (
              <div
                key={idx}
                className="mb-2 text-sm md:text-base lg:text-lg tracking-wide"
                style={{
                  color: line.dim ? AMBER_DIM : AMBER,
                  textShadow: `0 0 10px ${AMBER_GLOW}`,
                }}
              >
                {shown}
                {isCurrent && !done && (
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                    className="inline-block ml-0.5"
                    style={{ color: AMBER }}
                  >
                    _
                  </motion.span>
                )}
              </div>
            );
          })}

          {/* Re-establish connection (reload) — appears after the message. */}
          <AnimatePresence>
            {done && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
                onClick={() => window.location.reload()}
                className="mt-8 text-xs md:text-sm tracking-[0.25em]"
                style={{
                  fontFamily: "'Courier New',monospace",
                  color: AMBER,
                  background: "rgba(255,206,122,0.06)",
                  border: `1px solid ${AMBER_DIM}`,
                  borderRadius: 4,
                  padding: "10px 20px",
                  cursor: "pointer",
                  textShadow: `0 0 8px ${AMBER_GLOW}`,
                  pointerEvents: "auto",
                }}
                whileHover={{ backgroundColor: "rgba(255,206,122,0.14)" }}
                whileTap={{ scale: 0.97 }}
              >
                &gt; RE-ESTABLISH CONNECTION
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}