/**
 * Event Horizon — Constants & Cinematic Timeline
 * ================================================
 * Single source of truth for the scroll-driven experience.
 *
 * TIMELINE (scroll 0.0 → 1.0):
 * ─────────────────────────────────────────────────────────
 * Phase 0 - HOME      (0.00)       Camera still, nebula blurred, UI visible
 * Phase 1 - AWAKENING (0.00→0.15)  UI fades, blur→0, nebula revealed
 * Phase 2 - TRAVERSAL (0.15→0.40)  Camera advances through nebula
 * Phase 3 - REVELATION(0.40→0.60)  Nebula fades, BH appears
 * Phase 4 - DISCOVERY  (0.60→0.72) BH visible, scientific text
 * Phase 5 - APPROACH   (0.72→0.82) Close to BH, gravity takes hold
 * Phase 6 - EVENT HOR. (0.82→0.90) Point of no return
 * Phase 7 - SINGULARITY(0.90→1.00) Suck-in, blackout, reset
 * ─────────────────────────────────────────────────────────
 */

import { PhaseConfig } from "@/types";

// ─── Color Palette ──────────────────────────────────────────────────────────
export const COLORS = {
  void: "#000000",
  deepSpace: "#030308",
  spaceBlue: "#0a0e1a",
  starWhite: "#e8e6e3",
  softWhite: "#c4c0ba",
  dimGray: "#3a3a3a",
  accretionHot: "#fff4e0",
  accretionWarm: "#e87c2a",
  accretionCool: "#8b2500",
  accretionGlow: "#ff9a3c",
  uiPrimary: "#94a3b8",
  uiSecondary: "#64748b",
  uiAccent: "#cbd5e1",
  uiMuted: "#1e293b",
} as const;

// ─── Cinematic Phase Configurations ─────────────────────────────────────────
export const PHASES: readonly PhaseConfig[] = [
  {
    id: "home",
    label: "Home",
    scrollStart: 0.0,
    scrollEnd: 0.0,
    gravity: 0.0,
    cameraZ: 50,
  },
  {
    id: "awakening",
    label: "Awakening",
    scrollStart: 0.0,
    scrollEnd: 0.15,
    gravity: 0.0,
    cameraZ: 50,       // Camera stays still during awakening
  },
  {
    id: "traversal",
    label: "Traversal",
    scrollStart: 0.15,
    scrollEnd: 0.40,
    gravity: 0.0,
    cameraZ: 28,        // Camera advances through nebula
  },
  {
    id: "revelation",
    label: "Revelation",
    scrollStart: 0.40,
    scrollEnd: 0.60,
    gravity: 0.05,
    cameraZ: 15,        // Nebula fading, BH appearing
  },
  {
    id: "discovery",
    label: "Discovery",
    scrollStart: 0.60,
    scrollEnd: 0.72,
    gravity: 0.15,
    cameraZ: 10,
  },
  {
    id: "approach",
    label: "Approach",
    scrollStart: 0.72,
    scrollEnd: 0.82,
    gravity: 0.6,
    cameraZ: 5,
  },
  {
    id: "event-horizon",
    label: "Event Horizon",
    scrollStart: 0.82,
    scrollEnd: 0.90,
    gravity: 0.9,
    cameraZ: 1,
  },
  {
    id: "singularity",
    label: "Singularity",
    scrollStart: 0.90,
    scrollEnd: 1.0,
    gravity: 1.0,
    cameraZ: -18,
  },
] as const;

// ─── Camera Z Keyframes (for continuous interpolation) ──────────────────────
// Maps scroll progress → camera Z position using linear segments
export const CAMERA_KEYFRAMES = [
  { scroll: 0.00, z: 50 },   // Home: still
  { scroll: 0.15, z: 50 },   // Awakening: still (blur clearing)
  { scroll: 0.40, z: 28 },   // Traversal: through nebula
  { scroll: 0.60, z: 15 },   // Revelation: nebula fading
  { scroll: 0.72, z: 10 },   // Discovery
  { scroll: 0.82, z: 5 },    // Approach
  { scroll: 0.90, z: 1 },    // Event Horizon
  { scroll: 1.00, z: -18 },  // Singularity
] as const;

// ─── Performance ────────────────────────────────────────────────────────────
export const PERFORMANCE = {
  fpsHigh: 55,
  fpsMedium: 35,
  fpsLow: 20,
  particles: { high: 15000, medium: 8000, low: 3000 },
  dprRange: [1, 1] as [number, number],
  dprMedium: 1.5,
  dprLow: 1,
  fpsWindowSize: 20,
  qualityDropDelay: 200,
} as const;

// ─── Shader Constants ───────────────────────────────────────────────────────
export const SHADER = {
  schwarzschildRadius: 0.04,
  accretionInnerRadius: 0.12,
  accretionOuterRadius: 0.45,
  lensingMass: 0.008,
  textStretchMax: 3.0,
  textNoiseScale: 2.5,
  textGlitchIntensity: 0.15,
  bloomIntensity: 0.5,
  bloomThreshold: 0.75,
  chromaticMaxOffset: 0.003,
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
  pages: 8,       // More pages = finer scroll control
  damping: 0.18,
  eps: 0.0005,
} as const;
