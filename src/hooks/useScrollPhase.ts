/**
 * useScrollPhase — Scroll-to-Phase Bridge with Snap + Singularity Suck-In
 * ========================================================================
 * Reads scroll progress from Drei's ScrollControls, implements:
 *
 * 1. SNAP BEHAVIOR: Smoothly snaps to phase boundaries after the user
 *    stops scrolling, giving a "section-by-section" feel.
 *
 * 2. SINGULARITY SUCK-IN: When the user scrolls past the event-horizon
 *    phase (>78%), the system auto-scrolls RAPIDLY to the end (100%),
 *    simulating being "sucked in" by the black hole. After a brief
 *    blackout, it instantly resets to the beginning.
 *
 * The suck-in is NOT gradual — it's a fast, violent auto-scroll that
 * creates a feeling of losing control to the gravitational pull.
 */

"use client";

import { useRef, useCallback } from "react";
import { useScroll } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useExperienceStore } from "@/store/useExperienceStore";
import { PHASES } from "@/lib/constants";

// Phase snap targets (center of each phase's scroll range)
// Only snap to the first 4 phases (nebula through event-horizon)
// Singularity is handled by the suck-in system, not snap
const SNAP_TARGETS = PHASES.slice(0, 4).map((p) => (p.scrollStart + p.scrollEnd) / 2);

// How close the scroll must be to "settle" before snapping
const SNAP_THRESHOLD = 0.01;
// How long the user must be idle before snap kicks in (ms)
const SNAP_IDLE_MS = 400;

// Suck-in trigger point (percentage of scroll)
const SUCKIN_TRIGGER = 0.78;
// How long to hold at total blackout before resetting (ms)
const BLACKOUT_HOLD_MS = 800;

export function useScrollPhase() {
  const scroll = useScroll();
  const setScrollProgress = useExperienceStore((s) => s.setScrollProgress);

  // Snap state
  const lastScrollTime = useRef(Date.now());
  const lastOffset = useRef(0);
  const isSnapping = useRef(false);
  const snapTarget = useRef<number | null>(null);

  // Suck-in state
  const suckInTriggered = useRef(false);
  const suckInTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetCooldown = useRef(0);

  // Instant scroll to a specific offset (0-1) — no animation
  const instantScrollTo = useCallback(
    (targetOffset: number) => {
      const el = scroll.el;
      if (!el) return;

      const scrollHeight = el.scrollHeight - el.clientHeight;
      el.scrollTop = targetOffset * scrollHeight;
    },
    [scroll]
  );

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

    // ─── Suck-In Trigger ─────────────────────────────────────────
    // When the user scrolls past the event-horizon, trigger the
    // suck-in: rapid auto-scroll to 100%, then blackout + reset.
    if (
      offset > SUCKIN_TRIGGER &&
      !suckInTriggered.current &&
      now > resetCooldown.current
    ) {
      suckInTriggered.current = true;

      // RAPID scroll to the end — this drives the camera suck-in
      // Using a series of rapid instant scrolls for smooth acceleration
      let progress = offset;
      const accelerate = () => {
        progress += (1.0 - progress) * 0.15; // Exponential approach
        if (progress < 0.995) {
          instantScrollTo(progress);
          requestAnimationFrame(accelerate);
        } else {
          instantScrollTo(1.0);

          // Hold at blackout, then instant reset
          suckInTimer.current = setTimeout(() => {
            instantScrollTo(0);
            resetCooldown.current = Date.now() + 3000;
            suckInTriggered.current = false;
            isSnapping.current = false;
            suckInTimer.current = null;
          }, BLACKOUT_HOLD_MS);
        }
      };

      requestAnimationFrame(accelerate);
      return; // Skip snap logic during suck-in
    }

    // Skip snap logic if suck-in is active or in cooldown
    if (suckInTriggered.current || now < resetCooldown.current) return;

    // ─── Snap Behavior ───────────────────────────────────────────
    // After the user stops scrolling for SNAP_IDLE_MS, snap to the
    // nearest phase center for a "section-by-section" feel.
    const idleTime = now - lastScrollTime.current;

    if (
      idleTime > SNAP_IDLE_MS &&
      !isSnapping.current &&
      offset < SUCKIN_TRIGGER // Don't snap near singularity
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

    // Reset suck-in flag if user scrolls back up
    if (offset < 0.7) {
      suckInTriggered.current = false;
      if (suckInTimer.current) {
        clearTimeout(suckInTimer.current);
        suckInTimer.current = null;
      }
    }
  });
}
