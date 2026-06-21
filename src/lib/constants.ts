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
 * Phase 6 - EVENT HOR. (0.82→0.90) Point of no return — SCROLL LOCKS,
 *                                  the 12s cinematic orbit takes over
 * Phase 7 - SINGULARITY(timer)     Triggered by orbit completion:
 *                                  4-act collapse, blackout, reset
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
    scrollEnd: 0.12,
    gravity: 0.0,
    cameraZ: 50,       // Camera stays still during awakening
  },
  {
    id: "traversal",
    label: "Traversal",
    scrollStart: 0.12,
    scrollEnd: 0.32,
    gravity: 0.0,
    cameraZ: 28,        // Camera advances through nebula
  },
  {
    id: "revelation",
    label: "Revelation",
    scrollStart: 0.32,
    scrollEnd: 0.50,
    gravity: 0.05,
    cameraZ: 15,        // Nebula fading, BH appearing
  },
  {
    id: "discovery",
    label: "Discovery",
    scrollStart: 0.50,
    scrollEnd: 0.66,
    gravity: 0.15,
    cameraZ: 10,
  },
  {
    id: "approach",
    label: "Approach",
    scrollStart: 0.66,
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

// ─── Disk geometry mirror (single source of truth for phase anchoring) ──────
// These MUST match the shader constants in fragment.glsl. The camera
// keyframes below are derived from DISK_OUTER so that changing the black
// hole's size automatically repositions every phase to the correct
// physical relationship with the disk — no manual keyframe tuning.
export const BH_GEOMETRY = {
  blackHoleZ: -20,
  schwarzschildR: 3.5,
  diskInner: 10.5,
  diskOuter: 30.0,
  bCapture: 9.1, // photon-capture radius = 3√3/2 × R
} as const;

// ─── Camera Z Keyframes (DISK-ANCHORED, auto-scaling) ───────────────────────
// Each camera distance is expressed as a MULTIPLE of the disk's outer
// radius, then converted to a world-space Z. This guarantees two things:
//
//  1. SCALE INVARIANCE: if DISK_OUTER changes (e.g. a bigger black hole),
//     every phase keeps its intended relationship to the disk — the
//     "approach" leg always lands at the disk's outer edge, "event-horizon"
//     always crosses into the gas, etc. No more re-tuning Z by hand.
//
//  2. MONOTONIC APPROACH: the multipliers strictly DECREASE, so the camera
//     only ever moves toward the black hole. Scrolling always feels like
//     advancing — fixing the "stuck / moving backward" sensation that the
//     previous hand-tuned keyframes introduced in traversal.
//
// Phase → disk relationship (multiplier of DISK_OUTER):
//   home/awaken : 3.2×  — far, static; the whole system sits in the void
//   traversal   : 2.8×  — gentle approach through the thinning nebula
//   revelation  : 2.2×  — the disk and shadow read clearly, still distant
//   discovery   : 1.6×  — the structure opens up, lensing becomes obvious
//   approach    : 1.15× — the shadow dominates, disk filling the frame
//   event-horizon: 1.0× — camera reaches the disk's OUTER EDGE exactly.
//                         dist == DISK_OUTER is the physical moment of
//                         arrival at the accretion disk, so the orbit
//                         engages here automatically — at ANY disk size.
const DISK_DISTANCE_MULTIPLIERS = [
  { scroll: 0.00, mult: 3.2 },
  { scroll: 0.12, mult: 2.8 },
  { scroll: 0.32, mult: 2.2 },
  { scroll: 0.50, mult: 1.6 },
  { scroll: 0.66, mult: 1.15 },
  { scroll: 0.82, mult: 1.0 },
] as const;

/** Camera keyframes derived from the disk geometry (see above). */
export const CAMERA_KEYFRAMES = DISK_DISTANCE_MULTIPLIERS.map(({ scroll, mult }) => ({
  scroll,
  z: Math.round(BH_GEOMETRY.diskOuter * mult + BH_GEOMETRY.blackHoleZ),
}));

// ─── Orbital Approach (Event Horizon cinematic) ─────────────────────────────
/**
 * Configuration for the automatic camera orbit around the black hole.
 * Consumed exclusively by useOrbitCamera. All values are tunable —
 * the orbital path is fully derived from these constants.
 *
 * Geometry reference (shader units, BH at world (0, 0, -20)):
 *   Schwarzschild radius = 2.5 | shadow (b_capture) ≈ 6.5
 *   disk inner = 7.5 | disk outer = 40.0
 *
 * Design: IMMERSIVE fly-through. The orbit stays within the disk's gas
 * band the whole time, but the vertical arc lifts the camera above the
 * plane and dips it below, so the gas streams past from above and below
 * with the black sphere always anchoring the frame — instead of a flat
 * orange wash.
 */
export const ORBIT = {
  /** Total cinematic orbit duration in seconds */
  durationSec: 12,
  /** Full revolutions around the black hole (1.35 ≈ 486° of sweep) */
  revolutions: 1.35,
  /**
   * Starting orbital radius in world units. Matches the event-horizon
   * keyframe (1.0× DISK_OUTER = 30u) — the camera begins the orbit
   * exactly at the disk's outer edge, then spirals inward. Auto-scales
   * with the disk size via the same multiplier basis.
   */
  startRadius: 30,
  /**
   * Final orbital radius before the singularity dive. 14 sits just
   * inside the disk inner edge (10.5) and well outside the photon
   * shadow (9.1), giving a real decaying spiral from 30 → 14 that
   * crosses the entire gas band before the plunge.
   */
  endRadius: 14,
  /**
   * Peak vertical excursion above/below the disk plane. 13 lifts the
   * camera clear of the gas at the high/low points of the arc — you see
   * the disk as a luminous sheet from above, then plunge back through
   * it. Scaled to the new disk so the view isn't buried in the ring.
   */
  heightAmplitude: 13.0,
  /**
   * Sine cycles for the vertical path. 0.75 = rise above the disk,
   * cross the plane edge-on (~t 0.66, the disk becomes a blade of
   * light), then dip below it.
   */
  heightCycles: 0.75,
  /** Camera height converged to before the singularity hand-off */
  finalHeight: 0.8,
  /** Progress fraction where the height starts settling to finalHeight */
  settleStart: 0.85,
  /**
   * Progress fraction used to blend BOTH position and orientation in
   * from the scroll camera's final state. Widened from 0.08 to 0.15
   * (≈1.8s) so the hand-off reads as a smooth acceleration into orbit
   * rather than an abrupt cutscene cut.
   */
  blendInWindow: 0.15,
} as const;

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
  /**
   * Physical camera height above the accretion disk plane.
   * Replaces the old 5° pitch tilt that was hardcoded inside the black
   * hole fragment shader — the shader is now 100% driven by the real
   * camera matrix. At ~25 world units from the BH this yields the same
   * ≈5° viewing angle as the removed tilt, and the angle naturally
   * deepens as the camera approaches (physically correct).
   */
  /**
   * Physical camera height above the accretion disk plane. Raised to 5
   * so the camera views the disk from a higher angle — this "fattens"
   * the lensed top/bottom arc (more of the disk FACE is visible instead
   * of edge-on), the Interstellar framing. The shader physics are
   * unchanged; this is purely a more flattering vantage point. The
   * look-at tracks camera height every frame, so the gaze stays level on
   * the black hole despite the higher camera.
   */
  baseHeight: 5.0,
  initialPosition: [0, 5.0, 50] as [number, number, number],
} as const;

// ─── Scroll ─────────────────────────────────────────────────────────────────
export const SCROLL = {
  pages: 8,       // More pages = finer scroll control
  damping: 0.18,
  eps: 0.0005,
} as const;