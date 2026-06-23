/**
 * Event Horizon — Experience Store (Zustand)
 * ==========================================
 * Central state machine for the cinematic experience.
 *
 * LORE — TIME DILATION (Unit-7 protocol):
 *  - localTimeSec: the PROBE's clock. Advances at real 1s/s (a per-frame
 *    loop in the HUD increments it via tickLocalTime). The constant
 *    "human" reference that stays calm the whole journey.
 *  - earthYear: EARTH's clock, DERIVED from journey progress (not a real
 *    accumulator). Schwarzschild dilation makes Earth's time run away as
 *    the probe falls in; we map progress→year on an exponential so it sits
 *    near 2026 through the calm acts and detonates to YEAR 42,026 exactly
 *    at the horizon crossing — reliably, regardless of how long the user
 *    takes to scroll. See computeEarthYear below.
 *  - dataLink: the DATA_LINK upload bar (0→1) shown where the phase
 *    indicator used to be. Tracks journey progress; hits 1.0 at the
 *    horizon (Act 4 trigger).
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { Phase, QualityTier, ExperienceState } from "@/types";
import type { GpuProfile } from "@/lib/gpuProfile";
import { PHASES } from "@/lib/constants";
import { computeGravity, clamp, getPhaseProgress } from "@/lib/math";

/** Determine the current phase from global scroll progress. */
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

// ─── Lore: time dilation mapping (physically grounded) ──────────────────────
/** Earth's calendar year, derived from journey progress [0..1].
 *
 *  PHYSICS: Schwarzschild dilation makes Earth time run away as the probe
 *  falls in, with factor 1/√(1−rs/r) diverging at the horizon. Integrating
 *  that factor over the approach gives the total Earth time elapsed; the
 *  integral fits closely to progress^5.48 (the curve stays near-flat through
 *  the calm early acts and detonates near the horizon, exactly as the real
 *  factor does). We scale it to a fixed span so the epilogue always reads
 *  the same final year.
 *
 *  Year starts in 2133 (near-future tech) and accumulates +20,000 years
 *  across the full fall, landing on YEAR 22,133 at the horizon — matching
 *  the epilogue terminal exactly.
 *
 *  MONOTONIC: callers feed the FURTHEST progress reached (a high-water mark),
 *  so scrolling back never rewinds Earth's clock — elapsed time only moves
 *  forward, which is the physically correct behavior. */
export const EARTH_START_YEAR = 2133;
export const EARTH_YEAR_SPAN = 20000;
export const EARTH_END_YEAR = EARTH_START_YEAR + EARTH_YEAR_SPAN; // 22133
const EARTH_DILATION_EXP = 5.48; // fit of the integrated Schwarzschild factor
export function computeEarthYear(progress: number): number {
  const p = clamp(progress, 0, 1);
  return EARTH_START_YEAR + EARTH_YEAR_SPAN * Math.pow(p, EARTH_DILATION_EXP);
}

/** Combined journey progress used for the lore clocks and DATA_LINK. During
 *  the scroll phases it's scrollProgress; the orbit pushes it from ~0.82 to
 *  ~0.97, and the singularity finishes it to 1.0 — so the clocks keep
 *  accelerating through the cinematic even though scroll is locked. */
export function computeJourneyProgress(
  scrollProgress: number,
  orbitProgress: number,
  isOrbitActive: boolean,
  singularityProgress: number,
  isSingularityActive: boolean
): number {
  if (isSingularityActive) {
    return 0.97 + 0.03 * clamp(singularityProgress, 0, 1);
  }
  if (isOrbitActive) {
    return 0.82 + 0.15 * clamp(orbitProgress, 0, 1);
  }
  return clamp(scrollProgress, 0, 1);
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

    // Act 6: once true, the singularity has reached total black and the
    // experience FREEZES here — the Epilogue component takes over (typed
    // terminal message from Earth) instead of the old auto-restart loop.
    isEpilogue: false,

    // Point 7: true while a phase briefing modal is open. Locks the scroll
    // (via useScrollPhase) so the user can't drift to another phase while
    // reading — the briefing belongs to the phase that opened it.
    isBriefingOpen: false,

    // ─── Lore: time dilation + data link ──────────────────────────────
    localTimeSec: 0, // probe clock, advanced per-frame by the HUD
    earthYear: EARTH_START_YEAR, // derived from journey progress
    dataLink: 0, // upload bar 0..1, tracks journey progress
    dataLinkArmed: true, // false after a reset until scroll settles near start

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

      const state = get();
      const journey = computeJourneyProgress(
        progress,
        state.orbitProgress,
        state.isOrbitActive,
        state.singularityProgress,
        state.isSingularityActive
      );

      // DATA_LINK re-arm: after a post-singularity reset the bar is held at
      // 0 (disarmed) until the real scroll has settled back near the start.
      // Residual scroll right after the reset was otherwise rebounding the
      // bar to ~16% via the Math.max below. Once scroll dips under the
      // threshold we re-arm, and the upload tracks the journey again.
      let armed = state.dataLinkArmed;
      if (!armed && progress < 0.03) armed = true;
      const nextDataLink = armed
        ? Math.max(state.dataLink, journey)
        : 0;

      set({
        scrollProgress: progress,
        phase: newPhase,
        phaseProgress,
        gravity,
        isTransitioning: currentPhase !== newPhase,
        // Earth's clock tracks the FURTHEST progress reached (nextDataLink is
        // the monotonic high-water mark), so it never rewinds when scrolling
        // back and holds steady when stationary — elapsed time only moves
        // forward, the physically correct behavior.
        earthYear: computeEarthYear(nextDataLink),
        // DATA_LINK is a one-way upload: it only ever advances. Scrolling
        // back holds it at the furthest point reached, then it resumes
        // climbing once the camera passes that point again.
        dataLink: nextDataLink,
        dataLinkArmed: armed,
      });

      if (currentPhase !== newPhase) {
        requestAnimationFrame(() => {
          set({ isTransitioning: false });
        });
      }
    },

    setPhase: (phase: Phase) => set({ phase }),
    setGravity: (v: number) => set({ gravity: v }),
    setQualityTier: (tier: QualityTier) => set({ qualityTier: tier }),
    setGpuProfile: (profile: GpuProfile) => set({ gpuProfile: profile }),
    setReady: () => set({ isReady: true }),

    setIsHelmetOn: (v) => {
      set((state) => ({
        isHelmetOn: typeof v === "function" ? v(state.isHelmetOn) : v,
      }));
    },

    setDpr: (v: number) => set({ dpr: v }),
    setAntialias: (v: boolean) => set({ antialias: v }),

    setSingularityProgress: (v: number) => {
      const s = get();
      const journey = computeJourneyProgress(
        s.scrollProgress, s.orbitProgress, s.isOrbitActive, v, s.isSingularityActive
      );
      const nextDataLink = s.dataLinkArmed ? Math.max(s.dataLink, journey) : 0;
      set({
        singularityProgress: v,
        earthYear: computeEarthYear(nextDataLink),
        dataLink: nextDataLink,
      });
    },
    setIsSingularityActive: (v: boolean) => set({ isSingularityActive: v }),
    setShouldResetScroll: (v: boolean) => set({ shouldResetScroll: v }),
    setIsOrbitActive: (v: boolean) => set({ isOrbitActive: v }),
    setIsEpilogue: (v: boolean) =>
      // Power the helmet down as the epilogue takes over (Act 5→6): the
      // visor frame would clash with the full-screen terminal message.
      set(v ? { isEpilogue: true, isHelmetOn: false } : { isEpilogue: false }),
    setIsBriefingOpen: (v: boolean) => set({ isBriefingOpen: v }),
    setOrbitProgress: (v: number) => {
      const s = get();
      const journey = computeJourneyProgress(
        s.scrollProgress, v, s.isOrbitActive, s.singularityProgress, s.isSingularityActive
      );
      const nextDataLink = s.dataLinkArmed ? Math.max(s.dataLink, journey) : 0;
      set({
        orbitProgress: v,
        earthYear: computeEarthYear(nextDataLink),
        dataLink: nextDataLink,
      });
    },

    // Per-frame tick for the probe's own clock (called by the HUD loop).
    tickLocalTime: (deltaSec: number) =>
      set((s) => ({ localTimeSec: s.localTimeSec + deltaSec })),

    // Hard reset of the lore state for the post-singularity loop. The
    // DATA_LINK is normally monotonic (Math.max), so it would stay pinned
    // at 100% when the experience loops back to the start — this forces it
    // (and the dilation clocks) back to their initial values. Called from
    // SingularityPass.executeAtomicReset during the pitch-black moment.
    resetLore: () =>
      set({
        dataLink: 0,
        dataLinkArmed: false,
        localTimeSec: 0,
        earthYear: EARTH_START_YEAR,
      }),
  }))
);