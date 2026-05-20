/**
 * Event Horizon — Core Type Definitions
 * =====================================
 * Centralized types for the cinematic experience state machine,
 * performance monitoring, and shader uniforms.
 */

/** The 5 cinematic phases of the experience */
export type Phase =
  | "nebula"
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
  isTransitioning: boolean;

  // Actions
  setScrollProgress: (v: number) => void;
  setQualityTier: (tier: QualityTier) => void;
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

/** Gravity text shader uniforms */
export interface GravityTextUniforms {
  uGravity: number;
  uTime: number;
  uBlackHolePos: [number, number, number];
  uNoiseScale: number;
  uStretchFactor: number;
}
