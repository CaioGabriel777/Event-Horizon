/**
 * useAdaptiveQuality — Optimistic Scaling
 * ====================================================
 * Pessimistic start with unidirectional auto-upgrade.
 * Avoids ping-pong resolution scaling by manually controlling DPR.
 */

"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useExperienceStore } from "@/store/useExperienceStore";

const SAMPLE_WINDOW = 90;        // frames before taking a decision
const FPS_UPGRADE_THRESHOLD = 55; // min FPS to upgrade
const FPS_DOWNGRADE_THRESHOLD = 35; // max FPS to trigger downgrade
const DPR_STEPS = [0.75, 0.9, 1.0]; // Escalator of quality

export function useAdaptiveQuality() {
  const frames = useRef<number[]>([]);
  const lastDecision = useRef(0);
  const dpr = useExperienceStore((s) => s.dpr);
  const setDpr = useExperienceStore((s) => s.setDpr);

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    frames.current.push(now);

    // Keep window size
    if (frames.current.length > SAMPLE_WINDOW) {
      frames.current.shift();
    }

    // Evaluate every 3 seconds to prevent ping-pong
    if (now - lastDecision.current < 3.0) return;
    if (frames.current.length < SAMPLE_WINDOW) return;

    // Calculate avg FPS
    const elapsed = now - frames.current[0];
    const avgFps = frames.current.length / elapsed;

    lastDecision.current = now;
    const currentStep = DPR_STEPS.indexOf(dpr);

    if (avgFps >= FPS_UPGRADE_THRESHOLD && currentStep < DPR_STEPS.length - 1) {
      // GPU has headroom — upgrade
      setDpr(DPR_STEPS[currentStep + 1]);
    } else if (avgFps < FPS_DOWNGRADE_THRESHOLD && currentStep > 0) {
      // GPU is struggling — downgrade
      setDpr(DPR_STEPS[currentStep - 1]);
    }
  });
}
