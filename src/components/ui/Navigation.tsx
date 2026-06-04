/**
 * Navigation — Helmet-Integrated Control Bar
 * ============================================================================
 * Physical buttons embedded into the top bezel of the astronaut visor.
 * DISENGAGE [H] replaces the logo on the left. ABOUT and TECH sit on
 * the right but are only clickable at the initial camera position (home/awakening).
 * When scrolled past the initial position, they become visually disabled.
 */

"use client";

import { useCallback } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useExperienceStore } from "@/store/useExperienceStore";

// ─── Design Tokens (matched with HelmetHUD) ─────────────────────────────────

const MONO = "'Courier New','Lucida Console',monospace";
const WARN = "#ffaf38";
const C_DIM = "rgba(255,255,255,0.85)"; // Brightened for better visibility
const C_BRIGHT = "#ffffff";
const PANEL_BG = "rgba(2,8,20,0.5)";
const BORDER = "rgba(255, 255, 255, 0.15)";

// ─── Component ──────────────────────────────────────────────────────────────

export function Navigation() {
  const phase = useExperienceStore((s) => s.phase);
  const isHelmetOn = useExperienceStore((s) => s.isHelmetOn);

  // Navigation links only work at the initial camera position
  const isAtHome = phase === "home" || phase === "awakening";

  // Dispatch a custom event so HelmetHUD can toggle itself
  const handleDisengage = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "h" }));
  }, []);

  // ─── Shared Button Style ──────────────────────────────────────────────────

  const baseBtn: React.CSSProperties = {
    fontFamily: MONO,
    fontSize: 11, // Increased slightly for readability
    fontWeight: 600, // Added weight to combat blur
    letterSpacing: "0.2em",
    background: PANEL_BG,
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    borderRadius: 6,
    padding: "8px 16px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    textDecoration: "none",
    display: "inline-block",
  };

  const navBtnStyle: React.CSSProperties = {
    ...baseBtn,
    color: isAtHome ? C_DIM : "rgba(255,255,255,0.25)",
    textShadow: isAtHome ? `0 0 6px rgba(255,255,255,0.3)` : "none", // HUD text glow
    border: `1px solid ${isAtHome ? BORDER : "rgba(255,255,255,0.05)"}`,
    boxShadow: isAtHome
      ? "0 0 20px rgba(0,0,0,0.3), inset 0 0 10px rgba(0,0,0,0.6)"
      : "none",
    pointerEvents: isAtHome ? "auto" : "none",
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {isHelmetOn && (
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: "circIn" }}
          className="hidden md:flex fixed top-[5vh] left-[8vw] right-[8vw] z-[70] items-center justify-between pointer-events-none"
        >
          {/* ─── DISENGAGE [H] (Left — aligned with telemetry) ────────────── */}
          <button
            onClick={handleDisengage}
            className="focus:outline-none pointer-events-auto"
            style={{
              ...baseBtn,
              color: WARN,
              textShadow: `0 0 6px ${WARN}66`,
              border: "1px solid rgba(255,175,56,0.3)",
              boxShadow: "0 0 15px rgba(255,175,56,0.1), inset 0 0 10px rgba(0,0,0,0.6)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,175,56,0.6)";
              e.currentTarget.style.boxShadow = "0 0 20px rgba(255,175,56,0.2), inset 0 0 10px rgba(0,0,0,0.6)";
              e.currentTarget.style.color = "#ffc85e";
              e.currentTarget.style.textShadow = `0 0 10px #ffc85e99`;
              e.currentTarget.style.background = "rgba(255,175,56,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,175,56,0.3)";
              e.currentTarget.style.boxShadow = "0 0 15px rgba(255,175,56,0.1), inset 0 0 10px rgba(0,0,0,0.6)";
              e.currentTarget.style.color = WARN;
              e.currentTarget.style.textShadow = `0 0 6px ${WARN}66`;
              e.currentTarget.style.background = PANEL_BG;
            }}
            id="nav-disengage"
          >
            DISENGAGE [H]
          </button>

          {/* ─── ABOUT & TECH (Right — aligned with phase intel) ────────── */}
          <div className="flex gap-4 pointer-events-auto">
            <Link
              href={isAtHome ? "/about" : "#"}
              style={navBtnStyle}
              onClick={(e) => { if (!isAtHome) e.preventDefault(); }}
              onMouseEnter={(e) => {
                if (!isAtHome) return;
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)";
                e.currentTarget.style.color = C_BRIGHT;
                e.currentTarget.style.textShadow = `0 0 10px rgba(255,255,255,0.6)`;
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={(e) => {
                if (!isAtHome) return;
                e.currentTarget.style.borderColor = BORDER;
                e.currentTarget.style.color = C_DIM;
                e.currentTarget.style.textShadow = `0 0 6px rgba(255,255,255,0.3)`;
                e.currentTarget.style.background = PANEL_BG;
              }}
              id="nav-about"
            >
              ABOUT
            </Link>
            <Link
              href={isAtHome ? "/tech" : "#"}
              style={navBtnStyle}
              onClick={(e) => { if (!isAtHome) e.preventDefault(); }}
              onMouseEnter={(e) => {
                if (!isAtHome) return;
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)";
                e.currentTarget.style.color = C_BRIGHT;
                e.currentTarget.style.textShadow = `0 0 10px rgba(255,255,255,0.6)`;
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={(e) => {
                if (!isAtHome) return;
                e.currentTarget.style.borderColor = BORDER;
                e.currentTarget.style.color = C_DIM;
                e.currentTarget.style.textShadow = `0 0 6px rgba(255,255,255,0.3)`;
                e.currentTarget.style.background = PANEL_BG;
              }}
              id="nav-tech"
            >
              TECH
            </Link>
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
