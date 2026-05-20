/**
 * useScrollPhase — Scroll-to-Phase Bridge with Snap + Singularity Loop
 * =====================================================================
 * Reads scroll progress from Drei's ScrollControls, implements:
 *
 * 1. SNAP BEHAVIOR: Smoothly snaps to phase boundaries after the user
 *    stops scrolling, giving a "section-by-section" feel.
 *
 * 2. SINGULARITY LOOP: When reaching the final phase (singularity),
 *    waits for the blackout effect, then smoothly scrolls back to the
 *    beginning — creating an infinite cinematic loop.
 *
 * All scroll manipulation is done programmatically via the ScrollControls
 * DOM element, keeping the R3F integration intact.
 */

"use client";

import { useRef, useCallback } from "react";
import { useScroll } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useExperienceStore } from "@/store/useExperienceStore";
import { PHASES } from "@/lib/constants";

// Phase snap targets (center of each phase's scroll range)
const SNAP_TARGETS = PHASES.map((p) => (p.scrollStart + p.scrollEnd) / 2);

// How close the scroll must be to "settle" before snapping
const SNAP_THRESHOLD = 0.01;
// How long the user must be idle before snap kicks in (ms)
const SNAP_IDLE_MS = 400;
// How long to stay at singularity before resetting (ms)
const SINGULARITY_HOLD_MS = 2500;

export function useScrollPhase() {
  const scroll = useScroll();
  const setScrollProgress = useExperienceStore((s) => s.setScrollProgress);

  // Snap state
  const lastScrollTime = useRef(Date.now());
  const lastOffset = useRef(0);
  const isSnapping = useRef(false);
  const snapTarget = useRef<number | null>(null);

  // Singularity loop state
  const singularityTriggered = useRef(false);
  const singularityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetCooldown = useRef(0);

  // Smooth scroll to a specific offset (0-1)
  const smoothScrollTo = useCallback(
    (targetOffset: number) => {
      const el = scroll.el;
      if (!el) return;

      const scrollHeight = el.scrollHeight - el.clientHeight;
      const targetScroll = targetOffset * scrollHeight;

      el.scrollTo({
        top: targetScroll,
        behavior: "smooth",
      });
    },
    [scroll]
  );

  // Find nearest snap target for a given offset
  const findSnapTarget = useCallback((offset: number): number => {
    let closest = SNAP_TARGETS[0];
    let minDist = Math.abs(offset - closest);

    for (let i = 1; i < SNAP_TARGETS.length; i++) {
      const dist = Math.abs(offset - SNAP_TARGETS[i]);
      if (dist < minDist) {
        minDist = dist;
        closest = SNAP_TARGETS[i];
      }
    }

    return closest;
  }, []);

  useFrame(() => {
    const offset = scroll.offset;
    const now = Date.now();

    // Update the store
    setScrollProgress(offset);

    // ─── Detect scroll movement ──────────────────────────────────
    const delta = Math.abs(offset - lastOffset.current);
    if (delta > 0.001) {
      lastScrollTime.current = now;
      isSnapping.current = false;
      snapTarget.current = null;
    }
    lastOffset.current = offset;

    // ─── Snap Behavior ───────────────────────────────────────────
    // After the user stops scrolling for SNAP_IDLE_MS, snap to the
    // nearest phase center for a "section-by-section" feel.
    const idleTime = now - lastScrollTime.current;

    if (
      idleTime > SNAP_IDLE_MS &&
      !isSnapping.current &&
      now > resetCooldown.current
    ) {
      const target = findSnapTarget(offset);
      const distToTarget = Math.abs(offset - target);

      // Only snap if we're not already close enough
      if (distToTarget > SNAP_THRESHOLD) {
        isSnapping.current = true;
        snapTarget.current = target;
        smoothScrollTo(target);
      }
    }

    // ─── Singularity Loop ────────────────────────────────────────
    // When the user reaches the singularity phase (offset > 0.9),
    // hold for a moment, then smoothly reset to the beginning.
    if (
      offset > 0.92 &&
      !singularityTriggered.current &&
      now > resetCooldown.current
    ) {
      singularityTriggered.current = true;

      // Clear any previous timer
      if (singularityTimer.current) {
        clearTimeout(singularityTimer.current);
      }

      // Hold at singularity, then loop back
      singularityTimer.current = setTimeout(() => {
        smoothScrollTo(0);

        // Set cooldown to prevent re-triggering during the scroll back
        resetCooldown.current = Date.now() + 4000;
        singularityTriggered.current = false;
        isSnapping.current = false;
        singularityTimer.current = null;
      }, SINGULARITY_HOLD_MS);
    }

    // Reset singularity flag if user scrolls back up
    if (offset < 0.85) {
      singularityTriggered.current = false;
      if (singularityTimer.current) {
        clearTimeout(singularityTimer.current);
        singularityTimer.current = null;
      }
    }
  });
}
