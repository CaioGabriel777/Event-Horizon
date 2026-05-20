/**
 * Event Horizon — Experience Store (Zustand)
 * ==========================================
 * Central state machine for the cinematic experience.
 * Manages scroll progress, phase transitions, and gravity intensity.
 *
 * PERFORMANCE CRITICAL: Uses derived state with selectors to avoid
 * unnecessary re-renders. The store is updated imperatively from
 * useFrame (no React render cycle).
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { Phase, QualityTier, ExperienceState } from "@/types";
import { PHASES } from "@/lib/constants";
import { computeGravity, clamp, getPhaseProgress } from "@/lib/math";

/**
 * Determine the current phase from global scroll progress.
 * Uses the PHASES config boundaries.
 */
function resolvePhase(scrollProgress: number): Phase {
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (scrollProgress >= PHASES[i].scrollStart) {
      return PHASES[i].id;
    }
  }
  return "nebula";
}

/**
 * Get the config for a given phase ID.
 */
function getPhaseConfig(phase: Phase) {
  return PHASES.find((p) => p.id === phase)!;
}

export const useExperienceStore = create<ExperienceState>()(
  subscribeWithSelector((set, get) => ({
    phase: "nebula",
    scrollProgress: 0,
    phaseProgress: 0,
    gravity: 0,
    qualityTier: "high",
    isTransitioning: false,

    setScrollProgress: (v: number) => {
      const progress = clamp(v, 0, 1);
      const newPhase = resolvePhase(progress);
      const config = getPhaseConfig(newPhase);
      const phaseProgress = getPhaseProgress(
        progress,
        config.scrollStart,
        config.scrollEnd
      );
      const gravity = computeGravity(progress);
      const currentPhase = get().phase;

      set({
        scrollProgress: progress,
        phase: newPhase,
        phaseProgress,
        gravity,
        isTransitioning: currentPhase !== newPhase,
      });

      // Clear transition flag after a tick
      if (currentPhase !== newPhase) {
        requestAnimationFrame(() => {
          set({ isTransitioning: false });
        });
      }
    },

    setQualityTier: (tier: QualityTier) => {
      set({ qualityTier: tier });
    },
  }))
);
