/**
 * HelmetHUD — Immersive Astronaut Visor Overlay
 * ============================================================================
 * Diegetic UI simulating a physical helmet visor with:
 *   - Hexagonal SVG shell via HelmetShellSVG (CSS variable theming)
 *   - Layered vignette, glass reflections, chromatic aberrations
 *   - Interior foam padding, seams, and technical material textures
 *   - Left telemetry panel with 3D perspective curvature
 *   - Phase-reactive variant system (nominal / warning / danger)
 */

"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useExperienceStore } from "@/store/useExperienceStore";
import { PHASES } from "@/lib/constants";
import { HelmetShellSVG } from "./HelmetShellSVG";

// ─── Design Tokens ──────────────────────────────────────────────────────────

const C_BRIGHT = "#ffffff";
const C_LABEL = "rgba(255, 255, 255, 0.85)";
const C_DIM = "rgba(255, 255, 255, 0.55)";
const OK = "#4ade80";
const WARN = "#ffaf38";
const DANGER = "#ff6b6b";
const PANEL_BG = "rgba(2,8,20,0.5)";
const BORDER = "rgba(255, 255, 255, 0.15)";
const MONO = "'Courier New','Lucida Console',monospace";

/** Maps experience phase to shell visual variant */
function useShellVariant(phase: string, isSingularity: boolean) {
  return useMemo(() => {
    if (isSingularity) return "danger" as const;
    if (phase === "approach" || phase === "event-horizon") return "warning" as const;
    return "nominal" as const;
  }, [phase, isSingularity]);
}

// ─── Component ──────────────────────────────────────────────────────────────

export function HelmetHUD() {
  // ─── State & Refs ─────────────────────────────────────────────────────────

  const [fps, setFps] = useState(60);
  const [showApproachWarning, setShowApproachWarning] = useState(false);

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

  const isSingularity = phase === "singularity";
  const isEventHorizon = phase === "event-horizon";
  const isDanger = isSingularity || isEventHorizon;
  const shellVariant = useShellVariant(phase, isSingularity);

  // Phase Information
  const hudPhases = PHASES.slice(2); // Skip home and awakening for HUD count
  const hudPhaseIndex = hudPhases.findIndex((p) => p.id === phase);
  const phaseLabel = hudPhaseIndex >= 0
    ? `PHASE: ${hudPhaseIndex + 1}/${hudPhases.length} — ${hudPhases[hudPhaseIndex].label.toUpperCase()}`
    : "STANDBY";

  // Right Panel Content (Migrated from SceneOverlay)
  let rightPanelContent = null;
  if (phase === "traversal") {
    rightPanelContent = {
      title: "PHASE I",
      header: "TRAVERSAL",
      desc: "Entering nebulous volume. Visibility restricted.",
      color: C_BRIGHT,
    };
  } else if (phase === "revelation") {
    rightPanelContent = {
      title: "PHASE II",
      header: "REVELATION",
      desc: "Nebula thinning. Massive structure detected ahead.",
      color: C_BRIGHT,
    };
  } else if (phase === "discovery") {
    rightPanelContent = {
      title: "PHASE III",
      header: "DISCOVERY",
      desc: "Light bends. Space warps. Something massive lies ahead.",
      color: C_BRIGHT,
    };
  } else if (phase === "approach") {
    rightPanelContent = {
      title: "PHASE IV",
      header: "APPROACH",
      desc: "The fabric of spacetime stretches.",
      color: WARN,
    };
  } else if (phase === "event-horizon") {
    rightPanelContent = {
      title: "PHASE V",
      header: "EVENT HORIZON",
      desc: "Extreme gravitational lensing detected.",
      color: DANGER,
    };
  }

  // Gravity display: 1.00G at rest → ramps up with store gravity
  const gravityDisplay = `${(1.0 + gravity * 99.0).toFixed(1)}G`;
  const gravityColor = gravity > 0.7 ? DANGER : gravity > 0.3 ? WARN : OK;

  // Integrity: drops as gravity increases
  const integrityValue = Math.max(0, Math.round(100 - gravity * 100));
  const integrityColor = integrityValue < 30 ? DANGER : integrityValue < 60 ? WARN : OK;
  const integrityLabel = integrityValue < 30 ? "CRITICAL" : integrityValue < 60 ? "UNSTABLE" : "NOMINAL";

  // ─── FPS Counter ──────────────────────────────────────────────────────────

  useEffect(() => {
    let animId: number;
    const tick = () => {
      frames.current++;
      const now = performance.now();
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
          {/* ─── Diegetic CSS Keyframes ─────────────────────────────────── */}
          <style>{`
            @keyframes condense {
              0%, 100% { opacity: 0.015; }
              50% { opacity: 0.03; }
            }
            @keyframes scanMove {
              0% { transform: translateY(-100%); }
              100% { transform: translateY(100vh); }
            }
            @keyframes glow {
              0%, 100% { opacity: 1; box-shadow: 0 0 10px ${C_BRIGHT}; }
              50% { opacity: 0.5; box-shadow: 0 0 4px ${C_BRIGHT}88; }
            }
            @keyframes dangerPulseFast {
              0%, 100% { opacity: 1; box-shadow: 0 0 15px ${DANGER}; background: ${DANGER}; }
              50% { opacity: 0.3; box-shadow: 0 0 5px ${DANGER}44; background: ${DANGER}88; }
            }
          `}</style>

          {/* ─── Aggressive Danger State ─────────────────────────────── */}
          <div style={{
            position: "absolute", inset: 0, zIndex: 35, pointerEvents: "none",
            background: "radial-gradient(ellipse at center, transparent 40%, rgba(200,30,30,0.08) 100%)",
            opacity: isDanger ? 1 : 0,
            transition: "opacity 0.5s ease"
          }} />

          {/* ─── Layer 1: Physical Helmet Shell (SVG) ────────────────────── */}
          <HelmetShellSVG variant={shellVariant} />

          {/* ─── Layer 1.4: Scan Beam (Hardware Accelerated) ─────────── */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 2, zIndex: 58, pointerEvents: "none",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
            animation: "scanMove 8s linear infinite",
            willChange: "transform",
          }} />

          {/* ─── Layer 2: Parallax Telemetry ─────────────────────────────── */}
          <div ref={hudRef} style={{ position: "absolute", inset: 0, zIndex: 50, willChange: "transform" }}>

            {/* ─── Left Telemetry Panel ──────────────────────────────────── */}
            <div style={{
              position: "absolute",
              left: "8vw", top: "50%",
              transform: "translateY(-50%) rotateY(12deg)",
              transformOrigin: "right center",
              width: 160,
              background: PANEL_BG,
              border: `1px solid ${isDanger ? "rgba(239,68,68,0.3)" : BORDER}`,
              borderRadius: 6,
              padding: "14px 16px",
              fontFamily: MONO,
              boxShadow: isDanger
                ? "0 0 20px rgba(239,68,68,0.1), inset 0 0 10px rgba(0,0,0,0.6)"
                : "0 0 20px rgba(0,0,0,0.3), inset 0 0 10px rgba(0,0,0,0.6)",
            }}>
              {/* Panel header & Signal */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
                <div style={{
                  fontSize: 10, color: isDanger ? DANGER : C_BRIGHT, letterSpacing: "0.25em",
                  textShadow: isDanger ? `0 0 4px ${DANGER}88` : `0 0 4px ${C_BRIGHT}44`,
                }}>
                  {isDanger ? "⚠ WARNING" : "TELEMETRY"}
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 14 }}>
                  {[1, 2, 3, 4].map((bar) => {
                    const isOn = gravity < (1.0 - (bar * 0.2));
                    return <div key={bar} style={{ width: 6, height: 4 + bar * 3, background: isOn ? (isDanger ? DANGER : OK) : "rgba(255,255,255,0.15)", borderRadius: 1 }} />
                  })}
                </div>
              </div>
              <div style={{ borderBottom: `1px solid ${isDanger ? "rgba(239,68,68,0.3)" : C_DIM}`, marginBottom: 14 }} />

              {/* FPS */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: C_LABEL, letterSpacing: "0.15em", marginBottom: 3 }}>FPS</div>
                <div style={{
                  fontSize: 18, fontWeight: "bold", letterSpacing: "0.1em",
                  color: fps >= 50 ? OK : fps >= 30 ? WARN : DANGER,
                  textShadow: `0 0 4px ${fps >= 50 ? "rgba(74,222,128,0.3)" : fps >= 30 ? "rgba(255,175,56,0.3)" : "rgba(255,107,107,0.3)"}`,
                }}>
                  {fps}
                </div>
                <div style={{ height: 2, borderRadius: 1, marginTop: 4, width: "100%", background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (fps / 60) * 100)}%`, background: fps >= 50 ? OK : fps >= 30 ? WARN : DANGER }} />
                </div>
              </div>

              {/* GRAVITY */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: C_LABEL, letterSpacing: "0.15em", marginBottom: 3 }}>GRAVITY</div>
                <div style={{
                  fontSize: 18, fontWeight: "bold", letterSpacing: "0.1em",
                  color: gravityColor,
                  textShadow: `0 0 4px ${gravityColor}44`,
                }}>
                  {gravityDisplay}
                </div>
                <div style={{ height: 2, borderRadius: 1, marginTop: 4, width: "100%", background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, gravity * 100)}%`, background: gravityColor }} />
                </div>
              </div>

              {/* INTEGRITY */}
              <div>
                <div style={{ fontSize: 9, color: C_LABEL, letterSpacing: "0.15em", marginBottom: 3 }}>
                  INTEGRITY
                  <span style={{ float: "right", opacity: 0.6 }}>{integrityLabel}</span>
                </div>
                <div style={{
                  fontSize: 18, fontWeight: "bold", letterSpacing: "0.1em",
                  color: integrityColor,
                  textShadow: `0 0 4px ${integrityColor}44`,
                }}>
                  {integrityValue}%
                </div>
                <div style={{ height: 2, borderRadius: 1, marginTop: 4, width: "100%", background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${integrityValue}%`, background: integrityColor }} />
                </div>
              </div>
            </div>

            {/* ─── Bottom Center Phase Indicator ─────────────────────────── */}
            <div style={{
              position: "absolute",
              bottom: "5vh", left: "50%",
              transform: "translateX(-50%)",
              background: PANEL_BG,
              border: `1px solid ${isDanger ? "rgba(239,68,68,0.3)" : BORDER}`,
              borderRadius: 6,
              padding: "12px 24px",
              fontFamily: MONO,
              boxShadow: isDanger
                ? "0 0 30px rgba(239,68,68,0.1), inset 0 0 20px rgba(0,0,0,0.4)"
                : "0 0 30px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.3)",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: isDanger ? DANGER : C_BRIGHT,
                animation: isDanger ? "dangerPulseFast 0.8s infinite" : "glow 2s ease-in-out infinite",
              }} />
              <div style={{
                fontSize: 12, color: isDanger ? DANGER : C_BRIGHT, letterSpacing: "0.2em",
                textShadow: isDanger ? "0 0 8px rgba(239,68,68,0.4)" : `0 0 8px ${C_BRIGHT}44`,
              }}>
                {phaseLabel}
              </div>
            </div>

            {/* ─── Right Telemetry Panel (Phase Intel) ───────────────────── */}
            <AnimatePresence>
              {rightPanelContent && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="text-right" style={{
                    position: "absolute",
                    right: "8vw", top: "50%",
                    transform: "translateY(-50%)",
                    width: 260,
                    textShadow: `0 0 10px ${rightPanelContent.color}44`,
                  }}
                >
                  <div
                    className="text-xs tracking-[0.6em] uppercase mb-3"
                    style={{ color: rightPanelContent.color, opacity: 0.8 }}
                  >
                    {rightPanelContent.title}
                  </div>
                  <div
                    className="text-2xl md:text-3xl font-light tracking-[0.1em]"
                    style={{ color: rightPanelContent.color }}
                  >
                    {rightPanelContent.header}
                  </div>
                  <div
                    className="text-xs mt-3 ml-auto"
                    style={{ color: rightPanelContent.color, opacity: 0.6 }}
                  >
                    {rightPanelContent.desc}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── Approach Phase Warning System ─────────────────────────── */}
            <AnimatePresence>
              {phase === "approach" && !showApproachWarning && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setShowApproachWarning(true)}
                  style={{
                    position: "absolute",
                    left: "8vw", top: "70%",
                    transform: "translateY(-50%) rotateY(12deg)",
                    transformOrigin: "right center",
                    background: "rgba(255,175,56,0.15)",
                    border: `1px solid ${WARN}`,
                    borderRadius: 4,
                    padding: "8px 16px",
                    fontFamily: MONO,
                    color: WARN,
                    cursor: "pointer",
                    boxShadow: `0 0 15px rgba(255,175,56,0.3), inset 0 0 10px rgba(255,175,56,0.2)`,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    pointerEvents: "auto",
                  }}
                  whileHover={{ backgroundColor: "rgba(255,175,56,0.25)", scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span style={{ fontSize: 16 }}>⚠</span>
                  <span style={{ fontSize: 10, letterSpacing: "0.1em" }}>INCOMING DATA</span>
                </motion.button>
              )}

              {showApproachWarning && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 100 }}>
                  <motion.div
                    drag
                    dragMomentum={false}
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    style={{
                      width: 400,
                      background: "rgba(15, 23, 42, 0.85)",
                      border: `1px solid ${C_DIM}`,
                      borderRadius: 8,
                      padding: "24px",
                      fontFamily: "system-ui, sans-serif",
                      boxShadow: "0 20px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)",
                      pointerEvents: "auto",
                      cursor: "grab",
                    }}
                    whileDrag={{ cursor: "grabbing", scale: 1.02, boxShadow: "0 30px 60px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.1)" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <div style={{ fontFamily: MONO, color: WARN, fontSize: 10, letterSpacing: "0.2em" }}>
                        ⚠ ALERT // GRAVITATIONAL ANOMALY
                      </div>
                      <button
                        onClick={() => setShowApproachWarning(false)}
                        style={{
                          background: "none", border: "none", color: C_DIM, cursor: "pointer",
                          fontSize: 16, padding: "4px",
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    <h3 style={{ color: "#e8e6e3", fontSize: 24, fontWeight: 300, letterSpacing: "0.1em", marginBottom: 12 }}>
                      TIME IS RELATIVE
                    </h3>

                    <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                      As you approach the event horizon, time dilates. What feels like seconds here is centuries elsewhere.
                    </p>

                    <div style={{
                      background: "rgba(0,0,0,0.3)", padding: "10px 12px", borderRadius: 4,
                      fontFamily: MONO, fontSize: 10, color: "#64748b",
                      display: "flex", flexDirection: "column", gap: 6
                    }}>
                      <div style={{ color: "#e8e6e3" }} >SCHWARZSCHILD RADIUS: 2GM/c²</div>
                      <div style={{ color: WARN }}>GRAVITATIONAL REDSHIFT ACTIVE</div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}