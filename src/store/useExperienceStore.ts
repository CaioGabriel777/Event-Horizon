/**
 * Event Horizon — Experience Store (Zustand)
 * ==========================================
 * Central state machine for the cinematic experience.
 * Updated for the new 8-phase cinematic timeline.
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { Phase, QualityTier, ExperienceState } from "@/types";
import { PHASES } from "@/lib/constants";
import { computeGravity, clamp, getPhaseProgress } from "@/lib/math";

/**
 * Determine the current phase from global scroll progress.
 */
function resolvePhase(scrollProgress: number): Phase {
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (scrollProgress >= PHASES[i].scrollStart) {
      return PHASES[i].id;
    }
  }
  return "home";
}

function getPhaseConfig(phase: Phase) {
  return PHASES.find((p) => p.id === phase)!;
}

export const useExperienceStore = create<ExperienceState>()(
  subscribeWithSelector((set, get) => ({
    phase: "home",
    scrollProgress: 0,
    phaseProgress: 0,
    gravity: 0,
    qualityTier: "high",
    isTransitioning: false,
    isReady: false,
    isHelmetOn: true,

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

      if (currentPhase !== newPhase) {
        requestAnimationFrame(() => {
          set({ isTransitioning: false });
        });
      }
    },

    setQualityTier: (tier: QualityTier) => {
      set({ qualityTier: tier });
    },

    setReady: () => {
      set({ isReady: true });
    },

    setIsHelmetOn: (v) => {
      set((state) => ({
        isHelmetOn: typeof v === "function" ? v(state.isHelmetOn) : v,
      }));
    },
  }))
);
