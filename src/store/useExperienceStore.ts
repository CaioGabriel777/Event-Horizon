/**
 * Event Horizon — Experience Store (Zustand)
 * ==========================================
 * Central state machine for the cinematic experience.
 * Manages the global scroll progress, cinematic phases, and the
 * single-source-of-truth timelines for the orbital approach and the
 * singularity transition.
 *
 * CINEMATIC STATE CONTRACT:
 *  - isOrbitActive / orbitProgress: owned by useOrbitCamera. While
 *    active, the scroll resolver is suspended (useScrollPhase locks),
 *    so phase/gravity set manually by the orbit are never overwritten.
 *  - isSingularityActive / singularityProgress: owned by SingularityPass.
 *  - HUD components may freely READ orbitProgress/singularityProgress
 *    to derive reactions (telemetry, warnings, integrity decay) without
 *    coupling to the cinematic controllers.
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { Phase, QualityTier, ExperienceState } from "@/types";
import type { GpuProfile } from "@/lib/gpuProfile";
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
    gpuProfile: "high",
    isTransitioning: false,
    isReady: false,
    isHelmetOn: true,
    dpr: 0.75,
    antialias: false,
    singularityProgress: 0,
    isSingularityActive: false,
    shouldResetScroll: false,
    isOrbitActive: false,
    orbitProgress: 0,

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

    setPhase: (phase: Phase) => {
      set({ phase });
    },

    setGravity: (v: number) => {
      set({ gravity: v });
    },

    setQualityTier: (tier: QualityTier) => {
      set({ qualityTier: tier });
    },

    setGpuProfile: (profile: GpuProfile) => {
      set({ gpuProfile: profile });
    },

    setReady: () => {
      set({ isReady: true });
    },

    setIsHelmetOn: (v) => {
      set((state) => ({
        isHelmetOn: typeof v === "function" ? v(state.isHelmetOn) : v,
      }));
    },

    setDpr: (v: number) => set({ dpr: v }),
    setAntialias: (v: boolean) => set({ antialias: v }),
    setSingularityProgress: (v: number) => set({ singularityProgress: v }),
    setIsSingularityActive: (v: boolean) => set({ isSingularityActive: v }),
    setShouldResetScroll: (v: boolean) => set({ shouldResetScroll: v }),
    setIsOrbitActive: (v: boolean) => set({ isOrbitActive: v }),
    setOrbitProgress: (v: number) => set({ orbitProgress: v }),
  }))
);