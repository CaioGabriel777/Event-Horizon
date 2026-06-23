/**
 * HelmetHUD — Immersive Astronaut Visor Overlay
 * ============================================================================
 * Diegetic UI simulating a physical helmet visor.
 *
 * LORE INTEGRATION (Unit-7 protocol):
 *  - Telemetry panel (left) now carries the TWO DILATION CLOCKS:
 *      LOCAL_TIME  — the probe's clock, ticking at a calm 1s/s.
 *      EARTH_SYNC  — Earth's year, running away toward 42,026 as you fall in.
 *    The old FPS/GRAVITY/INTEGRITY readouts remain as "useful-useless"
 *    technical flavor beneath them.
 *  - The bottom-center indicator is now the DATA_LINK upload bar (replacing
 *    "PHASE: X/6"): the probe streaming anomaly data home, filling to 100%
 *    at the horizon crossing.
 */

"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useExperienceStore } from "@/store/useExperienceStore";
import { HelmetShellSVG } from "./HelmetShellSVG";

// ─── Design Tokens ──────────────────────────────────────────────────────────

const C_BRIGHT = "#ffffff";
const C_LABEL = "rgba(255, 255, 255, 0.85)";
const C_DIM = "rgba(255, 255, 255, 0.55)";
const OK = "#4ade80";
const WARN = "#ffaf38";
const DANGER = "#ff6b6b";
const TIME_AMBER = "#ffd27c"; // EARTH_SYNC runaway clock tint
const PANEL_BG = "rgba(2,8,20,0.5)";
const BORDER = "rgba(255, 255, 255, 0.15)";
const MONO = "'Courier New','Lucida Console',monospace";

// ─── Phase Briefings ─────────────────────────────────────────────────────────
// Clickable intel cards, one per phase, shown beneath the telemetry panel.
// Opening one locks the scroll (isBriefingOpen) so the user reads it in place.
// Figures are the real physics of a ~10⁷ M☉ supermassive black hole.
type Briefing = {
  tag: string; // small label on the trigger button
  title: string;
  accent: string;
  lines?: { label?: string; value: string }[];
  body?: string;
  equation?: boolean; // render the dilation equation block
};
const PHASE_BRIEFINGS: Record<string, Briefing> = {
  traversal: {
    tag: "TIME DILATION",
    title: "RELATIVISTIC TIME DILATION",
    accent: "#9aa6b2",
    body:
      "Near a massive body, time itself slows. A clock deep in the gravity well ticks slower than one far away. As UNIT-7 falls toward the anomaly, every second aboard stretches into far longer back on Earth.",
    equation: true,
  },
  revelation: {
    tag: "TARGET: LETHE",
    title: "ANOMALY // LETHE",
    accent: "#e8e6e3",
    lines: [
      { label: "DESIGNATION", value: "LETHE (river of oblivion)" },
      { label: "CLASS", value: "Supermassive black hole" },
      { label: "MASS", value: "1.0 x 10^7 M\u2609" },
      { label: "SCHWARZSCHILD R", value: "~0.20 AU (29.5M km)" },
    ],
    body:
      "Named for the mythic river whose waters erase all memory: nothing that crosses LETHE's horizon ever returns to the universe that knew it.",
  },
  discovery: {
    tag: "LENSING",
    title: "GRAVITATIONAL LENSING",
    accent: "#cbd5e1",
    lines: [{ label: "PHOTON RING", value: "light orbiting at 1.5 rs" }],
    body:
      "LETHE's gravity bends the path of light itself. The glowing ring is the accretion disk BEHIND the hole, its light wrapped over the top and under the bottom — you are seeing the far side through curved spacetime.",
  },
  approach: {
    tag: "\u26a0 HAZARD",
    title: "EXTREME ENVIRONMENT",
    accent: WARN,
    lines: [
      { label: "DISK TEMP", value: "~10^7 K (X-ray)" },
      { label: "SURFACE GRAVITY", value: "1.5 x 10^5 G" },
      { label: "ISCO VELOCITY", value: "0.41 c" },
      { label: "TIDAL SHEAR", value: "RISING - structural" },
    ],
    body:
      "The inner disk glows in X-rays. Gravitational acceleration at the horizon exceeds a hundred thousand Earth gravities. Spaghettification is imminent.",
  },
};

/** Maps experience phase to shell visual variant */
function useShellVariant(phase: string, isSingularity: boolean) {
  return useMemo(() => {
    if (isSingularity) return "danger" as const;
    if (phase === "approach" || phase === "event-horizon") return "warning" as const;
    return "nominal" as const;
  }, [phase, isSingularity]);
}

/** Format the probe clock (seconds) as HH:MM:SS.cc — a calm, steady readout. */
function formatLocalTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const cs = Math.floor((totalSec % 1) * 100);
  const p2 = (n: number) => n.toString().padStart(2, "0");
  return `${p2(h)}:${p2(m)}:${p2(s)}.${p2(cs)}`;
}

/** Format Earth's year with a thousands separator (e.g. "YEAR 12,480"). */
function formatEarthYear(year: number): string {
  return `YEAR ${Math.floor(year).toLocaleString("en-US")}`;
}

// Realistic surface gravity readout. The internal `gravity` (0→1) maps
// exponentially from 1 G (probe at rest, human-normal) to ~1.5×10⁵ G — the
// true Newtonian acceleration at the horizon of a 10⁷ M☉ black hole.
const G_DISPLAY_MIN = 1.0;
const G_DISPLAY_MAX = 1.5e5;
const SUP = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];
function toSuperscript(n: number): string {
  return String(n).split("").map((d) => SUP[+d] ?? d).join("");
}
/** Maps internal gravity [0..1] to a realistic G value and formats it:
 *  plain (e.g. "12.4 G") under 10,000, scientific (e.g. "1.5×10⁵ G") above. */
function formatGravity(gravity: number): string {
  const g = G_DISPLAY_MIN * Math.pow(G_DISPLAY_MAX / G_DISPLAY_MIN, clamp01(gravity));
  if (g < 10000) {
    return `${g < 100 ? g.toFixed(1) : Math.round(g).toLocaleString("en-US")} G`;
  }
  const exp = Math.floor(Math.log10(g));
  const mantissa = (g / Math.pow(10, exp)).toFixed(1);
  return `${mantissa}×10${toSuperscript(exp)} G`;
}
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// ─── Component ──────────────────────────────────────────────────────────────

export function HelmetHUD() {
  // ─── State & Refs ─────────────────────────────────────────────────────────

  const [fps, setFps] = useState(60);
  const [briefingOpen, setBriefingOpen] = useState(false);

  const hudRef = useRef<HTMLDivElement>(null!);
  const mouse = useRef({ x: 0, y: 0 });
  const tgt = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const frames = useRef(0);
  const lastTime = useRef(performance.now());

  // ─── Store Subscriptions ──────────────────────────────────────────────────

  const isHelmetOn = useExperienceStore((s) => s.isHelmetOn);
  const gravity = useExperienceStore((s) => s.gravity);
  const phase = useExperienceStore((s) => s.phase);
  // Lore clocks + data link
  const localTimeSec = useExperienceStore((s) => s.localTimeSec);
  const earthYear = useExperienceStore((s) => s.earthYear);
  const dataLink = useExperienceStore((s) => s.dataLink);
  // Act 4: the orbit engaging IS the "over the horizon" moment (it also
  // locks the scroll), so the crossed-horizon warning hooks this flag.
  const isOrbitActive = useExperienceStore((s) => s.isOrbitActive);
  const isSingularity = phase === "singularity";
  const isEventHorizon = phase === "event-horizon";
  const isDanger = isSingularity || isEventHorizon;
  const shellVariant = useShellVariant(phase, isSingularity);

  // Act 4 warning: from orbit engage through the singularity, until the
  // blackout swallows everything.
  const horizonCrossed = isOrbitActive || isSingularity;

  // How fast EARTH_SYNC is running away — drives the "spinning" emphasis.
  const dilationActive = dataLink > 0.45; // Act 3 onward
  const dilationExtreme = dataLink > 0.85; // Act 4-5: the unreadable blur

  // The briefing available for the CURRENT phase (null if none).
  const briefing = PHASE_BRIEFINGS[phase] ?? null;

  // Close any open briefing when the phase changes (the card belongs to its
  // phase). And keep the store's scroll-lock flag in sync with the modal.
  useEffect(() => {
    setBriefingOpen(false);
  }, [phase]);
  useEffect(() => {
    useExperienceStore.getState().setIsBriefingOpen(briefingOpen);
  }, [briefingOpen]);

  // Gravity / integrity (kept as technical flavor)
  const gravityDisplay = formatGravity(gravity);
  const gravityColor = gravity > 0.7 ? DANGER : gravity > 0.3 ? WARN : OK;
  const integrityValue = Math.max(0, Math.round(100 - gravity * 100));
  const integrityColor = integrityValue < 30 ? DANGER : integrityValue < 60 ? WARN : OK;
  const integrityLabel = integrityValue < 30 ? "CRITICAL" : integrityValue < 60 ? "UNSTABLE" : "NOMINAL";

  // DATA_LINK percent
  const dataPct = Math.round(dataLink * 100);
  const dataColor = dataPct >= 100 ? DANGER : dataPct > 70 ? WARN : OK;

  // ─── FPS Counter + LOCAL_TIME tick ────────────────────────────────────────
  useEffect(() => {
    let animId: number;
    let prev = performance.now();
    const tick = () => {
      frames.current++;
      const now = performance.now();
      // Advance the probe clock by real elapsed time (calm 1s/s).
      const dt = (now - prev) / 1000;
      prev = now;
      useExperienceStore.getState().tickLocalTime(dt);

      if (now - lastTime.current >= 1000) {
        setFps(frames.current);
        frames.current = 0;
        lastTime.current = now;
      }
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // ─── Global Keyboard Toggle ───────────────────────────────────────────────
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "h") {
        useExperienceStore.getState().setIsHelmetOn((p) => !p);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  // ─── Parallax Animation Loop ──────────────────────────────────────────────
  useEffect(() => {
    if (!isHelmetOn) return;
    const onMove = (e: MouseEvent) => {
      tgt.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      tgt.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMove);
    const loop = () => {
      mouse.current.x += (tgt.current.x - mouse.current.x) * 0.08;
      mouse.current.y += (tgt.current.y - mouse.current.y) * 0.08;
      if (hudRef.current) {
        hudRef.current.style.transform = `translate3d(${mouse.current.x * -20}px,${mouse.current.y * -20}px,0)`;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isHelmetOn]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <AnimatePresence>
        {isHelmetOn && (
        <motion.div
          key="helmet"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          className="hidden md:block"
          style={{ position: "fixed", inset: 0, zIndex: 40, overflow: "hidden", pointerEvents: "none", contain: "strict" }}
        >
          <style>{`
            @keyframes scanMove { 0% { transform: translateY(-100%);} 100% { transform: translateY(100vh);} }
            @keyframes glow { 0%,100%{opacity:1;box-shadow:0 0 10px ${C_BRIGHT};}50%{opacity:.5;box-shadow:0 0 4px ${C_BRIGHT}88;} }
            @keyframes dangerPulseFast { 0%,100%{opacity:1;box-shadow:0 0 15px ${DANGER};background:${DANGER};}50%{opacity:.3;box-shadow:0 0 5px ${DANGER}44;background:${DANGER}88;} }
            @keyframes earthFlicker { 0%,100%{opacity:1;}50%{opacity:0.82;} }
            @keyframes chromaShift { 0%,100%{text-shadow:0 0 4px ${TIME_AMBER}66, 1px 0 ${DANGER}, -1px 0 #4cf;}50%{text-shadow:0 0 6px ${TIME_AMBER}88, -1px 0 ${DANGER}, 1px 0 #4cf;} }
            @keyframes horizonFlash { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
            @keyframes horizonBgPulse { 0%,100%{background:rgba(140,0,0,0.18);} 50%{background:rgba(200,20,20,0.34);} }
            @keyframes briefPulse { 0%,100%{filter:brightness(1);} 50%{filter:brightness(1.35);} }
            @keyframes briefBlink { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
          `}</style>

          <div style={{ position: "absolute", inset: 0, zIndex: 35, pointerEvents: "none", background: "radial-gradient(ellipse at center, transparent 40%, rgba(200,30,30,0.08) 100%)", opacity: isDanger ? 1 : 0, transition: "opacity 0.5s ease" }} />

          <HelmetShellSVG variant={shellVariant} />

          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, zIndex: 58, pointerEvents: "none", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)", animation: "scanMove 8s linear infinite", willChange: "transform" }} />

          {/* ─── Act 4: EVENT HORIZON CROSSED — minimalist top banner ───── */}
          <AnimatePresence>
            {horizonCrossed && (
              <motion.div
                key="horizon-crossed"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
                style={{
                  position: "absolute", top: "5vh",
                  left: 0, right: 0, marginInline: "auto",
                  width: "fit-content", zIndex: 70,
                  pointerEvents: "none",
                  display: "flex", alignItems: "center", gap: 12,
                  fontFamily: MONO,
                  padding: "9px 22px",
                  borderRadius: 4,
                  border: "1.5px solid rgba(255,43,43,0.85)",
                  background: "rgba(50,0,0,0.6)",
                  boxShadow: "0 0 28px rgba(255,0,0,0.45), inset 0 0 12px rgba(255,0,0,0.15)",
                  animation: "horizonFlash 0.9s steps(1) infinite",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff2b2b", boxShadow: "0 0 10px #ff2b2b" }} />
                <span style={{ fontSize: 13, fontWeight: "bold", letterSpacing: "0.24em", color: "#ff7070", textShadow: "0 0 10px rgba(255,0,0,0.8)" }}>
                  EVENT HORIZON CROSSED · NO ESCAPE VECTOR
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={hudRef} style={{ position: "absolute", inset: 0, zIndex: 50, willChange: "transform" }}>

            {/* ─── Left Telemetry Panel ──────────────────────────────────── */}
            <div style={{
              position: "absolute", left: "5vw", top: "50%",
              transform: "translateY(-50%) rotateY(12deg)", transformOrigin: "right center",
              width: 178, background: PANEL_BG,
              border: `1px solid ${isDanger ? "rgba(239,68,68,0.3)" : BORDER}`,
              borderRadius: 6, padding: "14px 16px", fontFamily: MONO,
              boxShadow: isDanger ? "0 0 20px rgba(239,68,68,0.1), inset 0 0 10px rgba(0,0,0,0.6)" : "0 0 20px rgba(0,0,0,0.3), inset 0 0 10px rgba(0,0,0,0.6)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: isDanger ? DANGER : C_BRIGHT, letterSpacing: "0.25em", textShadow: isDanger ? `0 0 4px ${DANGER}88` : `0 0 4px ${C_BRIGHT}44` }}>
                  {isDanger ? "⚠ WARNING" : "TELEMETRY"}
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 14 }}>
                  {[1, 2, 3, 4].map((bar) => {
                    const isOn = gravity < (1.0 - (bar * 0.2));
                    return <div key={bar} style={{ width: 6, height: 4 + bar * 3, background: isOn ? (isDanger ? DANGER : OK) : "rgba(255,255,255,0.15)", borderRadius: 1 }} />;
                  })}
                </div>
              </div>
              <div style={{ borderBottom: `1px solid ${isDanger ? "rgba(239,68,68,0.3)" : C_DIM}`, marginBottom: 14 }} />

              {/* LOCAL_TIME — the probe's calm clock */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: C_LABEL, letterSpacing: "0.15em", marginBottom: 3 }}>LOCAL_TIME</div>
                <div style={{ fontSize: 16, fontWeight: "bold", letterSpacing: "0.06em", color: C_BRIGHT, textShadow: `0 0 4px ${C_BRIGHT}33` }}>
                  {formatLocalTime(localTimeSec)}
                </div>
              </div>

              {/* EARTH_SYNC — Earth's runaway year */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: C_LABEL, letterSpacing: "0.15em", marginBottom: 3 }}>
                  EARTH_SYNC
                  {dilationActive && <span style={{ float: "right", color: TIME_AMBER, opacity: 0.8 }}>⟳ DILATING</span>}
                </div>
                <div style={{
                  fontSize: 16, fontWeight: "bold", letterSpacing: "0.06em",
                  color: TIME_AMBER,
                  textShadow: `0 0 5px ${TIME_AMBER}66`,
                  animation: dilationExtreme ? "chromaShift 0.25s infinite" : dilationActive ? "earthFlicker 0.6s infinite" : "none",
                  filter: dilationExtreme ? "blur(0.4px)" : "none",
                }}>
                  {formatEarthYear(earthYear)}
                </div>
              </div>

              <div style={{ borderBottom: `1px solid ${C_DIM}`, opacity: 0.4, marginBottom: 12 }} />

              {/* FPS / GRAVITY / INTEGRITY — technical flavor */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: C_LABEL, letterSpacing: "0.15em", marginBottom: 3 }}>GRAVITY</div>
                <div style={{ fontSize: 16, fontWeight: "bold", letterSpacing: "0.1em", color: gravityColor, textShadow: `0 0 4px ${gravityColor}44` }}>{gravityDisplay}</div>
                <div style={{ height: 2, borderRadius: 1, marginTop: 4, width: "100%", background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, gravity * 100)}%`, background: gravityColor }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: C_LABEL, letterSpacing: "0.15em", marginBottom: 3 }}>
                  INTEGRITY<span style={{ float: "right", opacity: 0.6 }}>{integrityLabel}</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: "bold", letterSpacing: "0.1em", color: integrityColor, textShadow: `0 0 4px ${integrityColor}44` }}>{integrityValue}%</div>
                <div style={{ height: 2, borderRadius: 1, marginTop: 4, width: "100%", background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${integrityValue}%`, background: integrityColor }} />
                </div>
              </div>
              {/* tiny FPS line */}
              <div style={{ marginTop: 8, fontSize: 8, color: C_DIM, letterSpacing: "0.1em" }}>
                SYS {fps}FPS
              </div>
            </div>

            {/* ─── Phase Briefing trigger (under the telemetry panel) ─────── */}
            <AnimatePresence>
              {briefing && !briefingOpen && (
                <motion.button
                  key={`brief-btn-${phase}`}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  onClick={() => setBriefingOpen(true)}
                  style={{
                    position: "absolute", left: "5vw", top: "calc(50% + 196px)",
                    transform: "rotateY(12deg)", transformOrigin: "right center",
                    width: 178, boxSizing: "border-box",
                    background: `linear-gradient(135deg, ${briefing.accent}33, ${briefing.accent}14)`,
                    border: `1.5px solid ${briefing.accent}`,
                    borderRadius: 6, padding: "11px 14px", fontFamily: MONO,
                    color: briefing.accent, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8,
                    boxShadow: `0 0 16px ${briefing.accent}55, inset 0 0 12px ${briefing.accent}18`,
                    pointerEvents: "auto",
                    animation: "briefPulse 2s ease-in-out infinite",
                  }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <span style={{ fontSize: 14, animation: "briefBlink 1.1s steps(1) infinite" }}>▣</span>
                  <span style={{ fontSize: 11, fontWeight: "bold", letterSpacing: "0.16em", textShadow: `0 0 8px ${briefing.accent}88` }}>{briefing.tag}</span>
                  <span style={{ marginLeft: "auto", fontSize: 9, opacity: 0.85, letterSpacing: "0.1em" }}>▸ OPEN</span>
                </motion.button>
              )}
            </AnimatePresence>

            {/* ─── Bottom Center: DATA_LINK upload bar ─────────────────────── */}
            <div style={{
              position: "absolute", bottom: "5vh", left: "50%", transform: "translateX(-50%)",
              background: PANEL_BG, border: `1px solid ${isDanger ? "rgba(239,68,68,0.3)" : BORDER}`,
              borderRadius: 6, padding: "10px 20px", fontFamily: MONO, minWidth: 320,
              boxShadow: isDanger ? "0 0 30px rgba(239,68,68,0.1), inset 0 0 20px rgba(0,0,0,0.4)" : "0 0 30px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.3)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: dataColor, animation: dataPct >= 100 ? "dangerPulseFast 0.8s infinite" : "glow 2s ease-in-out infinite" }} />
                  <span style={{ fontSize: 11, color: dataColor, letterSpacing: "0.2em", textShadow: `0 0 8px ${dataColor}55` }}>
                    DATA_LINK
                  </span>
                </div>
                <span style={{ fontSize: 12, fontWeight: "bold", color: dataColor, letterSpacing: "0.1em", textShadow: `0 0 6px ${dataColor}55` }}>
                  {dataPct >= 100 ? "TRANSFER COMPLETE" : `${dataPct}%`}
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 2, width: "100%", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${dataPct}%`, background: `linear-gradient(90deg, ${OK}, ${dataColor})`, transition: "width 0.2s ease-out", boxShadow: `0 0 8px ${dataColor}88` }} />
              </div>
            </div>

            {/* ─── Phase Briefing modal (opening locks the scroll) ─────────── */}
            <AnimatePresence>
              {briefing && briefingOpen && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 100 }}>
                  <motion.div
                    drag
                    dragMomentum={false}
                    dragElastic={0.06}
                    initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    style={{
                      width: 440, maxWidth: "86vw",
                      background: "rgba(8, 14, 26, 0.94)",
                      border: `1.5px solid ${briefing.accent}aa`,
                      borderRadius: 8, padding: "22px 24px",
                      fontFamily: "system-ui, sans-serif",
                      boxShadow: `0 20px 50px rgba(0,0,0,0.7), 0 0 30px ${briefing.accent}3a, inset 0 0 0 1px rgba(255,255,255,0.05)`,
                      pointerEvents: "auto",
                      cursor: "grab",
                    }}
                    whileDrag={{ cursor: "grabbing", scale: 1.02, boxShadow: `0 30px 70px rgba(0,0,0,0.8), 0 0 40px ${briefing.accent}55` }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: `${briefing.accent}88`, fontSize: 12, letterSpacing: "0.05em" }}>⠿</span>
                        <div style={{ fontFamily: MONO, color: briefing.accent, fontSize: 10, letterSpacing: "0.2em" }}>{briefing.tag}</div>
                      </div>
                      <button onClick={() => setBriefingOpen(false)} onPointerDownCapture={(e) => e.stopPropagation()} style={{ background: "none", border: "none", color: C_DIM, cursor: "pointer", fontSize: 16, padding: "4px", pointerEvents: "auto" }}>✕</button>
                    </div>

                    <h3 style={{ color: "#e8e6e3", fontSize: 21, fontWeight: 300, letterSpacing: "0.08em", marginBottom: 14 }}>{briefing.title}</h3>

                    {briefing.body && (
                      <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.65, marginBottom: briefing.lines || briefing.equation ? 16 : 0 }}>{briefing.body}</p>
                    )}

                    {briefing.lines && (
                      <div style={{ background: "rgba(0,0,0,0.3)", padding: "12px 14px", borderRadius: 4, fontFamily: MONO, fontSize: 11, display: "flex", flexDirection: "column", gap: 8 }}>
                        {briefing.lines.map((ln, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                            {ln.label && <span style={{ color: "#64748b", letterSpacing: "0.1em" }}>{ln.label}</span>}
                            <span style={{ color: briefing.accent, textAlign: "right" }}>{ln.value}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {briefing.equation && (
                      <div style={{ background: "rgba(0,0,0,0.3)", padding: "16px 14px", borderRadius: 4, fontFamily: MONO, fontSize: 13, color: "#cbd5e1", textAlign: "center" }}>
                        <div style={{ fontSize: 16, letterSpacing: "0.04em", marginBottom: 8 }}>
                          t<sub>earth</sub> = t<sub>local</sub> / √(1 − r<sub>s</sub>/r)
                        </div>
                        <div style={{ fontSize: 9, color: "#64748b", letterSpacing: "0.08em", lineHeight: 1.6 }}>
                          rs = SCHWARZSCHILD RADIUS · r = DISTANCE TO LETHE
                        </div>
                      </div>
                    )}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}