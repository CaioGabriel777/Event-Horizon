/**
 * Event Horizon — Constants
 * =========================
 * Design tokens, physics constants, and phase configurations.
 * Single source of truth for the entire experience.
 */

import { PhaseConfig } from "@/types";

// ─── Color Palette ──────────────────────────────────────────────────────────
// Inspired by: Interstellar, 2001: A Space Odyssey, Arrival
// NO neon, NO cyberpunk, NO gamer aesthetics
export const COLORS = {
  // Deep space blacks
  void: "#000000",
  deepSpace: "#030308",
  spaceBlue: "#0a0e1a",

  // Subtle whites and grays
  starWhite: "#e8e6e3",
  softWhite: "#c4c0ba",
  dimGray: "#3a3a3a",

  // Accretion disk — warm tones
  accretionHot: "#fff4e0",   // Inner edge (white-hot)
  accretionWarm: "#e87c2a",  // Mid-ring (deep orange)
  accretionCool: "#8b2500",  // Outer edge (dark red)
  accretionGlow: "#ff9a3c",  // Bloom glow

  // Scientific UI
  uiPrimary: "#94a3b8",     // Slate-400
  uiSecondary: "#64748b",   // Slate-500
  uiAccent: "#cbd5e1",      // Slate-300
  uiMuted: "#1e293b",       // Slate-800
} as const;

// ─── Phase Configurations ───────────────────────────────────────────────────
// Each phase occupies an equal portion of the scroll (0.2 each)
export const PHASES: readonly PhaseConfig[] = [
  {
    id: "nebula",
    label: "Nebula",
    scrollStart: 0.0,
    scrollEnd: 0.2,
    gravity: 0.0,
    cameraZ: 50,
  },
  {
    id: "discovery",
    label: "Discovery",
    scrollStart: 0.2,
    scrollEnd: 0.4,
    gravity: 0.05,
    cameraZ: 30,
  },
  {
    id: "approach",
    label: "Approach",
    scrollStart: 0.4,
    scrollEnd: 0.6,
    gravity: 0.5,
    cameraZ: 15,
  },
  {
    id: "event-horizon",
    label: "Event Horizon",
    scrollStart: 0.6,
    scrollEnd: 0.8,
    gravity: 0.9,
    cameraZ: 3,
  },
  {
    id: "singularity",
    label: "Singularity",
    scrollStart: 0.8,
    scrollEnd: 1.0,
    gravity: 1.0,
    cameraZ: -18,  // Inside the black hole (BH is at z=-20)
  },
] as const;

// ─── Performance Thresholds ─────────────────────────────────────────────────
export const PERFORMANCE = {
  // FPS thresholds for quality regression
  fpsHigh: 55,
  fpsMedium: 35,
  fpsLow: 20,

  // Particle counts per quality tier
  particles: {
    high: 15000,
    medium: 8000,
    low: 3000,
  },

  // DPR ranges
  dprRange: [1, 2] as [number, number],
  dprMedium: 1.5,
  dprLow: 1,

  // Rolling average window for FPS calculation
  fpsWindowSize: 60,
  qualityDropDelay: 2000, // ms before downgrading
} as const;

// ─── Shader Constants ───────────────────────────────────────────────────────
export const SHADER = {
  // Black hole
  schwarzschildRadius: 0.04,       // Reduced — v1 was too large and created blob artifacts
  accretionInnerRadius: 0.12,
  accretionOuterRadius: 0.45,
  lensingMass: 0.008,              // Reduced — v1 distortion was too aggressive

  // Gravity text
  textStretchMax: 3.0,
  textNoiseScale: 2.5,
  textGlitchIntensity: 0.15,

  // Post-processing
  bloomIntensity: 0.5,             // Slightly higher for accretion glow
  bloomThreshold: 0.75,            // Lower threshold to catch more of the disk glow
  chromaticMaxOffset: 0.003,       // Reduced — was too intense at high gravity
} as const;

// ─── Camera ─────────────────────────────────────────────────────────────────
export const CAMERA = {
  fov: 75,
  near: 0.1,
  far: 1000,
  initialPosition: [0, 0, 50] as [number, number, number],
} as const;

// ─── Scroll ─────────────────────────────────────────────────────────────────
export const SCROLL = {
  pages: 6, // Total scroll pages (5 phases + buffer)
  damping: 0.15, // Higher = smoother, weightier scroll
  eps: 0.0005,   // Lower = more precise snap target detection
} as const;
