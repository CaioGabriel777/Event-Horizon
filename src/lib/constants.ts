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
// NOTE: PHASES is defined further down (see "Derived phases"), AFTER the
// world anchors and the scroll↔world conversion helpers it depends on. It
// can't live here because its scroll boundaries are now DERIVED from the
// nebula's physical position rather than hand-tuned.

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

// ─── Single source of truth for the black hole's world placement ────────────
// Every system that needs the black hole's position (the shader uniform,
// the orbit camera, the scene look-at, the singularity sequence) imports
// these instead of hardcoding the value. Moving the black hole is now a
// one-line change here — no more keeping a literal `-20` in sync across
// five files.
//
// BLACK_HOLE_POSITION is a plain tuple so it has no dependency on three.js
// (constants.ts stays framework-agnostic); each consumer wraps it in a
// Vector3 / prop as needed.
export const BLACK_HOLE_POSITION: readonly [number, number, number] = [
  0,
  0,
  BH_GEOMETRY.blackHoleZ,
];

/** Render scale passed to the <BlackHole> mesh. Kept here so the mesh
 *  size lives alongside the geometry it represents. */
export const BLACK_HOLE_SCALE = 22;

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
//   home/awaken : 4.6×  — far, static; the system is a distant point
//   traversal   : 4.2×  — through the nebula (BH still tiny, hidden in gas)
//   revelation  : 3.6×  — nebula clears; BH emerges SMALL and distant
//   discovery   : 2.5×  — the long approach begins; BH visibly growing
//   approach    : 1.6×  — BH now dominates, disk detail resolves
//   event-horizon: 1.0× — camera reaches the disk's OUTER EDGE exactly.
//
// The multipliers are spread so that MOST of the camera's travel — and
// most of the black hole's apparent growth (≈11% → 40% of screen height)
// — happens AFTER the nebula, across revelation→discovery→approach. This
// is the long, felt approach to a growing titan, rather than the BH
// reaching near-full size right as the nebula clears.
// The multipliers produce a LINEAR camera Z over scroll, so the camera
// moves at a UNIFORM speed across every phase — no phase feels faster or
// more sluggish than another. (z goes 118 → 10 evenly from scroll 0 → 0.82.)
const DISK_DISTANCE_MULTIPLIERS = [
  { scroll: 0.00, mult: 5.0 },
  { scroll: 0.12, mult: 4.42 },
  { scroll: 0.32, mult: 3.44 },
  { scroll: 0.50, mult: 2.56 },
  { scroll: 0.66, mult: 1.78 },
  { scroll: 0.82, mult: 1.0 },
] as const;

/** Camera keyframes derived from the disk geometry (see above). */
export const CAMERA_KEYFRAMES = DISK_DISTANCE_MULTIPLIERS.map(({ scroll, mult }) => ({
  scroll,
  z: Math.round(BH_GEOMETRY.diskOuter * mult + BH_GEOMETRY.blackHoleZ),
}));

// ════════════════════════════════════════════════════════════════════════════
// WORLD-ANCHORED TIMELINE
// ════════════════════════════════════════════════════════════════════════════
// The single source of truth for the whole experience is PHYSICAL POSITION
// in the world (Z coordinates), NOT hand-tuned scroll numbers. Phases,
// scene activations and art cues (black-hole reveal, nebula dissolve) are
// all DERIVED from where the camera is relative to these anchors. Move an
// anchor — the nebula, the black hole — and everything that depends on it
// repositions automatically. No more hand-calculated scroll values drifting
// out of sync.
//
// The camera travels along +Z → −Z (from CAMERA_KEYFRAMES[0].z toward the
// black hole). `scrollToWorldZ` / `worldZToScroll` convert between the two
// coordinate systems by inverting the keyframe map.

/** Camera world-Z at a given scroll [0..1] (piecewise-linear keyframes). */
export function scrollToWorldZ(scroll: number): number {
  const kf = CAMERA_KEYFRAMES;
  if (scroll <= kf[0].scroll) return kf[0].z;
  if (scroll >= kf[kf.length - 1].scroll) return kf[kf.length - 1].z;
  for (let i = 0; i < kf.length - 1; i++) {
    if (scroll >= kf[i].scroll && scroll <= kf[i + 1].scroll) {
      const t = (scroll - kf[i].scroll) / (kf[i + 1].scroll - kf[i].scroll);
      return kf[i].z + (kf[i + 1].z - kf[i].z) * t;
    }
  }
  return kf[kf.length - 1].z;
}

/** Inverse of scrollToWorldZ: the scroll [0..1] at which the camera reaches
 *  a given world-Z. Z decreases as scroll increases, so we walk segments
 *  looking for the one that brackets the target Z. */
export function worldZToScroll(z: number): number {
  const kf = CAMERA_KEYFRAMES;
  if (z >= kf[0].z) return kf[0].scroll;
  if (z <= kf[kf.length - 1].z) return kf[kf.length - 1].scroll;
  for (let i = 0; i < kf.length - 1; i++) {
    const zHi = kf[i].z;
    const zLo = kf[i + 1].z;
    if (z <= zHi && z >= zLo) {
      const t = (zHi - z) / (zHi - zLo);
      return kf[i].scroll + (kf[i + 1].scroll - kf[i].scroll) * t;
    }
  }
  return kf[kf.length - 1].scroll;
}

// ─── World anchors: the physical layout of the journey ──────────────────────
// Edit THESE to reshape the experience. Everything downstream follows.
export const WORLD_ANCHORS = {
  /** Where the camera starts (its home keyframe). */
  cameraStartZ: CAMERA_KEYFRAMES[0].z,
  /** The black hole's Z (from the geometry source of truth). */
  blackHoleZ: BH_GEOMETRY.blackHoleZ,
  /**
   * Nebula extent in world Z. The camera enters at nebulaNearZ (the side
   * closest to the start) and exits at nebulaFarZ (toward the black hole).
   * CRITICAL: nebulaFarZ must stay AHEAD of the revelation camera position
   * (~z=88) so the gas fully clears BEFORE the black hole needs to be
   * visible — otherwise the additive nebula renders over the hole and
   * hides it. The camera exits the gas, then the hole is revealed.
   */
  /**
   * Nebula extent in world Z, placed across the span the camera occupies
   * DURING the traversal phase (scroll 0.12→0.32 ≈ z=102→76). This makes
   * the traversal phase and the physical crossing of the gas coincide.
   * The particles are large (scale 80–130), so the camera sees the cloud
   * ahead from the start, flies into it during traversal, and the cloud
   * dissolves as it exits — clearing for the revelation.
   */
  nebulaNearZ: 100,
  nebulaFarZ: 78,
} as const;

/** Nebula center & half-depth, derived from its near/far anchors. The
 *  Nebula component imports CENTER for CLOUD_CENTER_Z and HALF_DEPTH to
 *  size the particle spread to the intended world extent. */
export const NEBULA_CENTER_Z = Math.round(
  (WORLD_ANCHORS.nebulaNearZ + WORLD_ANCHORS.nebulaFarZ) / 2
);
export const NEBULA_HALF_DEPTH = Math.round(
  Math.abs(WORLD_ANCHORS.nebulaNearZ - WORLD_ANCHORS.nebulaFarZ) / 2
);
/** Near/far world-Z bounds of the nebula, for position-based dissolve. */
export const NEBULA_NEAR_Z = WORLD_ANCHORS.nebulaNearZ;
export const NEBULA_FAR_Z = WORLD_ANCHORS.nebulaFarZ;

// ─── Derived art cues (scroll values computed from world anchors) ───────────
// These REPLACE the hand-tuned scroll thresholds that used to live in the
// shader (black-hole reveal) and the nebula component (dissolve). They are
// computed from the nebula's physical position, so moving the nebula moves
// the cues with it.
// ─── Timeline cues (HARD-CODED scroll values) ──────────────────────────────
// After repeated desync with derived/position-based timing, these are pinned
// to explicit scroll points. They MUST match the nebula dissolve in
// Nebula.tsx (DISSOLVE_START 0.05 → DISSOLVE_END 0.20). The nebula clears at
// 0.20; the traversal phase ends there; the black hole finishes revealing
// there. All three fire together because they share the same numbers.
export const TIMELINE_CUES = {
  /** Traversal begins just before the nebula (a touch after home settles). */
  traversalStart: 0.05,
  /** Camera is in the dense gas. */
  nebulaEnter: 0.12,
  /**
   * Nebula reads as GONE here (0.220) — tuned by reading the live scroll
   * value off the debug HUD as the gas cleared on screen. Traversal ends
   * and the black hole finishes revealing at this same point.
   */
  nebulaExit: 0.210,
  /** Black hole starts emerging from the gas. */
  blackHoleRevealStart: 0.150,
  /** Black hole fully revealed as the nebula reads as gone. */
  blackHoleRevealEnd: 0.210,
} as const;

// ─── Derived phases ─────────────────────────────────────────────────────────
// Phase scroll boundaries are no longer hand-tuned. The nebula-era phases
// (traversal, revelation) are pinned to the nebula's physical position via
// TIMELINE_CUES; the later phases are pinned to the disk-anchored camera
// keyframes (CAMERA_KEYFRAMES, already derived from DISK_OUTER). Editing the
// nebula anchors or the disk multipliers reflows every boundary in sync.
//
// KEY GUARANTEES this delivers:
//  • traversal stays active from just before the nebula until its far edge,
//    then revelation begins automatically AT the nebula exit — never out of
//    step with the gas the camera is actually flying through.
//  • the black-hole reveal (TIMELINE_CUES.blackHoleReveal*) is glued to the
//    final third of the nebula, wherever the nebula sits.
const KF = CAMERA_KEYFRAMES; // scrolls: [0]=0 [1]=.12 [2]=.32 [3]=.50 [4]=.66 [5]=.82
export const PHASES: readonly PhaseConfig[] = [
  {
    id: "home",
    label: "Home",
    scrollStart: 0.0,
    scrollEnd: 0.0,
    gravity: 0.0,
    cameraZ: WORLD_ANCHORS.cameraStartZ,
  },
  {
    id: "awakening",
    label: "Awakening",
    scrollStart: 0.0,
    // Awakening ends where Traversal begins — just BEFORE the nebula.
    scrollEnd: TIMELINE_CUES.traversalStart,
    gravity: 0.0,
    cameraZ: KF[1].z,
  },
  {
    id: "traversal",
    label: "Traversal",
    // Starts as the camera approaches the gas (a margin before the dense
    // near edge) and ends exactly when the camera exits the far edge.
    scrollStart: TIMELINE_CUES.traversalStart,
    scrollEnd: TIMELINE_CUES.nebulaExit,
    gravity: 0.0,
    cameraZ: KF[2].z,
  },
  {
    id: "revelation",
    label: "Revelation",
    // Begins exactly when the nebula clears — the BH is now visible.
    scrollStart: TIMELINE_CUES.nebulaExit,
    scrollEnd: KF[3].scroll,
    gravity: 0.05,
    cameraZ: KF[3].z,
  },
  {
    id: "discovery",
    label: "Discovery",
    scrollStart: KF[3].scroll,
    scrollEnd: KF[4].scroll,
    gravity: 0.15,
    cameraZ: KF[4].z,
  },
  {
    id: "approach",
    label: "Approach",
    scrollStart: KF[4].scroll,
    scrollEnd: KF[5].scroll,
    gravity: 0.6,
    cameraZ: KF[5].z,
  },
  {
    id: "event-horizon",
    label: "Event Horizon",
    scrollStart: KF[5].scroll,
    scrollEnd: 0.90,
    gravity: 0.9,
    cameraZ: KF[5].z,
  },
  {
    id: "singularity",
    label: "Singularity",
    scrollStart: 0.90,
    scrollEnd: 1.0,
    gravity: 1.0,
    cameraZ: BH_GEOMETRY.blackHoleZ,
  },
] as const;

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
  // Initial Z is derived from the first camera keyframe (the "home"
  // position) so the camera always starts exactly where the scroll
  // timeline begins — no jump on boot, and it auto-tracks any change to
  // the black hole position or the distance multipliers.
  initialPosition: [0, 5.0, CAMERA_KEYFRAMES[0].z] as [number, number, number],
} as const;

// ─── Scroll ─────────────────────────────────────────────────────────────────
export const SCROLL = {
  pages: 8,       // More pages = finer scroll control
  damping: 0.18,
  eps: 0.0005,
} as const;