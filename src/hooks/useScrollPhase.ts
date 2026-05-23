/**
 * useScrollPhase — Scroll Bridge + Singularity Suck-In
 * =====================================================
 * Updated for the new 8-phase cinematic timeline.
 *
 * Snap targets are phases 0-6 (home through event-horizon).
 * Singularity (>0.88) triggers the exponential suck-in auto-scroll.
 */

"use client";

import { useRef, useCallback } from "react";
import { useScroll } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useExperienceStore } from "@/store/useExperienceStore";

const SNAP_IDLE_MS = 600;
const SNAP_THRESHOLD = 0.008;
const SUCKIN_TRIGGER = 0.88;
const BLACKOUT_HOLD_MS = 800;

export function useScrollPhase() {
  const scroll = useScroll();
  const setScrollProgress = useExperienceStore((s) => s.setScrollProgress);

  const lastScrollTime = useRef(Date.now());
  const lastOffset = useRef(0);
  const suckInTriggered = useRef(false);
  const suckInTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetCooldown = useRef(0);

  const instantScrollTo = useCallback(
    (targetOffset: number) => {
      const el = scroll.el;
      if (!el) return;
      el.scrollTop = targetOffset * (el.scrollHeight - el.clientHeight);
    },
    [scroll]
  );

  useFrame(() => {
    const offset = scroll.offset;
    const now = Date.now();

    setScrollProgress(offset);

    // Detect scroll movement
    const delta = Math.abs(offset - lastOffset.current);
    if (delta > 0.0005) {
      lastScrollTime.current = now;
    }
    lastOffset.current = offset;

    // ─── Suck-In at singularity ──────────────────────────────────
    if (
      offset > SUCKIN_TRIGGER &&
      !suckInTriggered.current &&
      now > resetCooldown.current
    ) {
      suckInTriggered.current = true;

      let progress = offset;
      const accelerate = () => {
        progress += (1.0 - progress) * 0.12;
        if (progress < 0.995) {
          instantScrollTo(progress);
          requestAnimationFrame(accelerate);
        } else {
          instantScrollTo(1.0);
          suckInTimer.current = setTimeout(() => {
            instantScrollTo(0);
            resetCooldown.current = Date.now() + 3000;
            suckInTriggered.current = false;
            suckInTimer.current = null;
          }, BLACKOUT_HOLD_MS);
        }
      };
      requestAnimationFrame(accelerate);
    }

    // Reset suck-in if user scrolls back
    if (offset < 0.80) {
      suckInTriggered.current = false;
      if (suckInTimer.current) {
        clearTimeout(suckInTimer.current);
        suckInTimer.current = null;
      }
    }
  });
}
