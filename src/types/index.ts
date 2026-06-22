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

  // Actions
  setScrollProgress: (v: number) => void;
  setPhase: (v: Phase) => void;
  setGravity: (v: number) => void;
  setQualityTier: (tier: QualityTier) => void;
  setGpuProfile: (profile: GpuProfile) => void;
  setReady: () => void;
  setIsHelmetOn: (v: boolean | ((prev: boolean) => boolean)) => void;
  setDpr: (v: number) => void;
  setAntialias: (v: boolean) => void;
  setIsOrbitActive: (v: boolean) => void;
  setOrbitProgress: (v: number) => void;
  setSingularityProgress: (v: number) => void;
  setIsSingularityActive: (v: boolean) => void;
  setShouldResetScroll: (v: boolean) => void;
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
