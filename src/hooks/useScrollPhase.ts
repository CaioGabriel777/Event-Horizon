/**
 * useScrollPhase — Scroll Control and Reset Bridge
 * =================================================
 * Connects the Drei ScrollControls with the central ExperienceStore.
 * Responsible for locking the scroll overflow during the singularity 
 * cinematic sequence and performing synchronous scroll resets when triggered.
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

    // Lock scrolling during the cinematic sequence
    if (state.isSingularityActive) {
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
