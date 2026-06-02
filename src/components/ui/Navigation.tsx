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
const C_DIM = "rgba(255,255,255,0.6)";
const C_BRIGHT = "#ffffff";
const SHELL_BG = "rgba(13,15,20,0.95)";

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
    fontSize: 10,
    letterSpacing: "0.2em",
    background: SHELL_BG,
    borderRadius: 4,
    padding: "6px 14px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    textDecoration: "none",
    display: "inline-block",
  };

  const navBtnStyle: React.CSSProperties = {
    ...baseBtn,
    color: isAtHome ? C_DIM : "rgba(255,255,255,0.15)",
    border: `1px solid ${isAtHome ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"}`,
    boxShadow: isAtHome
      ? "0 0 10px rgba(255,255,255,0.05), inset 0 0 8px rgba(0,0,0,0.5)"
      : "inset 0 0 8px rgba(0,0,0,0.5)",
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
          className="hidden md:flex fixed top-0 left-0 right-0 z-[70] px-6 py-3 items-center justify-between pointer-events-none"
        >
          {/* ─── DISENGAGE [H] (Left — replaces old logo) ───────────────── */}
          <button
            onClick={handleDisengage}
            className="focus:outline-none pointer-events-auto"
            style={{
              ...baseBtn,
              color: WARN,
              border: "1px solid rgba(255,175,56,0.35)",
              boxShadow: "0 0 10px rgba(255,175,56,0.08), inset 0 0 8px rgba(0,0,0,0.5)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,175,56,0.7)";
              e.currentTarget.style.boxShadow = "0 0 18px rgba(255,175,56,0.25), inset 0 0 8px rgba(0,0,0,0.5)";
              e.currentTarget.style.color = "#ffc85e";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,175,56,0.35)";
              e.currentTarget.style.boxShadow = "0 0 10px rgba(255,175,56,0.08), inset 0 0 8px rgba(0,0,0,0.5)";
              e.currentTarget.style.color = WARN;
            }}
            id="nav-disengage"
          >
            DISENGAGE [H]
          </button>

          {/* ─── ABOUT & TECH (Right — disabled when scrolled) ──────────── */}
          <div className="flex gap-3 pointer-events-auto">
            <Link
              href={isAtHome ? "/about" : "#"}
              style={navBtnStyle}
              onClick={(e) => { if (!isAtHome) e.preventDefault(); }}
              onMouseEnter={(e) => {
                if (!isAtHome) return;
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)";
                e.currentTarget.style.color = C_BRIGHT;
              }}
              onMouseLeave={(e) => {
                if (!isAtHome) return;
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
                e.currentTarget.style.color = C_DIM;
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
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)";
                e.currentTarget.style.color = C_BRIGHT;
              }}
              onMouseLeave={(e) => {
                if (!isAtHome) return;
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
                e.currentTarget.style.color = C_DIM;
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
