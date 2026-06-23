/**
 * useScrollPhase — Scroll Control and Reset Bridge
 * =================================================
 * Connects the Drei ScrollControls with the central ExperienceStore.
 * Responsible for locking the scroll overflow during the cinematic
 * sequences (orbital approach + singularity collapse) and performing
 * synchronous scroll resets when triggered.
 *
 * CAMERA-DERIVED PROGRESS (the sync fix):
 * The store's scrollProgress is NOT fed the raw scroll offset. Instead it
 * is derived from the camera's REAL world-Z position (which the
 * SceneManager damps toward the keyframe target). Converting that real Z
 * back into a scroll value via worldZToScroll means every downstream
 * system — phase resolution, nebula dissolve, black-hole reveal — reads
 * the SAME quantity: where the camera physically is. Because the camera
 * is damped (it lags the raw scroll), feeding the raw scroll to the store
 * made phases switch BEFORE the camera arrived, so the nebula (which
 * dissolves by real camera position) lingered past the phase change. Now
 * the phase waits for the camera to actually get there.
 *
 * CINEMATIC LOCK: from the moment the orbit engages (event-horizon phase)
 * until the singularity timeline completes, the scroll element is
 * physically locked — the user has crossed the point of no return. While
 * locked, scrollProgress/phase derivation is suspended, so the manual
 * setPhase/setGravity calls from the cinematic controllers are never
 * overwritten by the scroll resolver.
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
      scroll.el.style.overflow = "auto";
      scroll.el.scrollTop = 0;
      state.setScrollProgress(0);
      state.setShouldResetScroll(false); // clear signal flag
      return;
    }

    // Lock scrolling during the cinematic sequences.
    // isOrbitActive:       event-horizon orbital approach (point of no return)
    // isSingularityActive: 4-act collapse + blackout reset window
    // isBriefingOpen:      open notice - scroll lock
    if (state.isOrbitActive || state.isSingularityActive || state.isBriefingOpen) {
      scroll.el.style.overflow = "hidden";
      return;
    }

    // Restore standard overflow and update scroll progress from the RAW
    // scroll offset. The timeline cues (phase boundaries, nebula dissolve,
    // black-hole reveal) are now pinned to explicit scroll values, so the
    // store must carry the same raw scroll the nebula and shader read —
    // no camera-position derivation, which previously drifted out of sync.
    if (scroll.el.style.overflow !== "auto") {
      scroll.el.style.overflow = "auto";
    }
    state.setScrollProgress(scroll.offset);
  });
}