/**
 * useScrollPhase — Scroll Control and Reset Bridge
 * =================================================
 * Connects the Drei ScrollControls with the central ExperienceStore.
 * Responsible for locking the scroll overflow during the cinematic
 * sequences (orbital approach + singularity collapse) and performing
 * synchronous scroll resets when triggered.
 *
 * CINEMATIC LOCK: from the moment the orbit engages (event-horizon
 * phase) until the singularity timeline completes, the scroll element
 * is physically locked — the user has crossed the point of no return.
 * While locked, scrollProgress/phase derivation is suspended, so the
 * manual setPhase/setGravity calls from the cinematic controllers are
 * never overwritten by the scroll resolver.
 */

"use client";

import { useScroll } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useExperienceStore } from "@/store/useExperienceStore";

export function useScrollPhase() {
  const scroll = useScroll();

  useFrame(() => {
    const state = useExperienceStore.getState();

    // Synchronous scroll reset (no async/rAF required)
    if (state.shouldResetScroll) {
      scroll.el.style.overflow = 'auto';
      scroll.el.scrollTop = 0;
      state.setScrollProgress(0);
      state.setShouldResetScroll(false);  // clear signal flag
      return;
    }

    // Lock scrolling during the cinematic sequences.
    // isOrbitActive:       event-horizon orbital approach (point of no return)
    // isSingularityActive: 4-act collapse + blackout reset window
    if (state.isOrbitActive || state.isSingularityActive) {
      scroll.el.style.overflow = 'hidden';
      return;
    }

    // Restore standard overflow and update scroll progress normally
    if (scroll.el.style.overflow !== 'auto') {
      scroll.el.style.overflow = 'auto';
    }
    state.setScrollProgress(scroll.offset);
  });
}