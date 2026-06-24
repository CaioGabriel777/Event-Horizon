/**
 * Event Horizon — Core Type Definitions
 * =====================================
 * Centralized types for the cinematic experience state machine,
 * performance monitoring, and shader uniforms.
 */

import type { GpuProfile } from "@/lib/gpuProfile";

/** The cinematic phases of the experience */
export type Phase =
  | "home"
  | "awakening"
  | "traversal"
  | "revelation"
  | "discovery"
  | "approach"
  | "event-horizon"
  | "singularity";

/** GPU performance tier for adaptive quality */
export type QualityTier = "high" | "medium" | "low";

/** Phase configuration — defines scroll boundaries and visual parameters */
export interface PhaseConfig {
  readonly id: Phase;
  readonly label: string;
  readonly scrollStart: number; // 0 → 1
  readonly scrollEnd: number;   // 0 → 1
  readonly gravity: number;     // base gravity for this phase
  readonly cameraZ: number;     // camera Z position target
}

/** Experience store state */
export interface ExperienceState {
  phase: Phase;
  scrollProgress: number;       // 0 → 1 global scroll
  phaseProgress: number;        // 0 → 1 within current phase
  gravity: number;              // 0 → 1 gravitational intensity
  qualityTier: QualityTier;
  /** Detected GPU capability tier — drives resolution scale, step count, FBM octaves */
  gpuProfile: GpuProfile;
  isTransitioning: boolean;
  isReady: boolean;             // True when Canvas is fully compiled
  isHelmetOn: boolean;          // True when the astronaut helmet overlay is active
  dpr: number;
  antialias: boolean;

  /** True when the cinematic orbit is running */
  isOrbitActive: boolean;
  /** Cinematic orbit progress (0.0 to 1.0) */
  orbitProgress: number;

  /** Timeline progress (0.0 to 1.0) of the singularity cinematic sequence */
  singularityProgress: number;

  /** True when the singularity cinematic is currently running, locking the scroll */
  isSingularityActive: boolean;

  /** Signal flag set by SingularityPass to instruct useScrollPhase to synchronously reset the DOM scroll */
  shouldResetScroll: boolean;

  // ─── Lore: time dilation + data link (Unit-7 protocol) ───────────────
  /** The probe's own clock in seconds — advances at real 1s/s. */
  localTimeSec: number;
  /** Earth's calendar year, derived from journey progress (→ 42026). */
  earthYear: number;
  /** DATA_LINK upload bar [0..1], tracks journey progress, hits 1 at horizon. */
  dataLink: number;
  /** False after a reset until scroll settles near the start — holds DATA_LINK at 0. */
  dataLinkArmed: boolean;

  isEpilogue: boolean;
  isBriefingOpen: boolean;

  // Actions
  setScrollProgress: (v: number) => void;
  setPhase: (v: Phase) => void;
  setGravity: (v: number) => void;
  setQualityTier: (tier: QualityTier) => void;
  setGpuProfile: (profile: GpuProfile) => void;
  setReady: () => void;
  setIsHelmetOn: (v: boolean | ((prev: boolean) => boolean)) => void;
  setIsBriefingOpen: (v: boolean) => void;
  setDpr: (v: number) => void;
  setAntialias: (v: boolean) => void;
  setIsOrbitActive: (v: boolean) => void;
  setOrbitProgress: (v: number) => void;
  setSingularityProgress: (v: number) => void;
  setIsSingularityActive: (v: boolean) => void;
  setShouldResetScroll: (v: boolean) => void;
  /** Advance the probe clock by deltaSec (called per-frame by the HUD). */
  tickLocalTime: (deltaSec: number) => void;
  /** Hard reset of lore state (DATA_LINK + clocks) for the post-singularity loop. */
  resetLore: () => void;
  setIsEpilogue: (v: boolean) => void;
}

/** Performance metrics for the tech dashboard */
export interface PerformanceMetrics {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  currentDPR: number;
  gpuTier: QualityTier;
  frameTime: number;

  // Actions
  updateMetrics: (metrics: Partial<PerformanceMetrics>) => void;
}

