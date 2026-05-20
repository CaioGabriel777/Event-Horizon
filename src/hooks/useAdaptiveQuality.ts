/**
 * useAdaptiveQuality — Dynamic Performance Regression
 * ====================================================
 * Monitors FPS and automatically downgrades quality tier
 * when performance drops below thresholds.
 *
 * Thresholds:
 * - FPS < 35 for 2s → 'medium' tier
 * - FPS < 20 for 2s → 'low' tier
 * - FPS > 55 for 5s → upgrade tier
 *
 * Adjustments per tier:
 * - Particle count (via useExperienceStore.qualityTier)
 * - DPR (via R3F's performance.regress())
 */

"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { usePerformanceStore } from "@/store/usePerformanceStore";
import { useExperienceStore } from "@/store/useExperienceStore";
import { PERFORMANCE } from "@/lib/constants";

export function useAdaptiveQuality() {
  const { performance: perfApi } = useThree();
  const fps = usePerformanceStore((s) => s.fps);
  const qualityTier = useExperienceStore((s) => s.qualityTier);
  const setQualityTier = useExperienceStore((s) => s.setQualityTier);

  const lowFpsSince = useRef<number | null>(null);
  const highFpsSince = useRef<number | null>(null);

  useFrame(() => {
    const now = Date.now();

    // ─── Downgrade check ──────────────────────────────────────
    if (fps < PERFORMANCE.fpsMedium) {
      if (!lowFpsSince.current) {
        lowFpsSince.current = now;
      }

      const elapsed = now - lowFpsSince.current;

      if (elapsed > PERFORMANCE.qualityDropDelay) {
        if (fps < PERFORMANCE.fpsLow && qualityTier !== "low") {
          setQualityTier("low");
          perfApi?.regress();
        } else if (qualityTier === "high") {
          setQualityTier("medium");
          perfApi?.regress();
        }
        lowFpsSince.current = null;
      }

      highFpsSince.current = null;
    }
    // ─── Upgrade check ────────────────────────────────────────
    else if (fps > PERFORMANCE.fpsHigh) {
      lowFpsSince.current = null;

      if (!highFpsSince.current) {
        highFpsSince.current = now;
      }

      const elapsed = now - highFpsSince.current;

      if (elapsed > 5000) {
        if (qualityTier === "low") {
          setQualityTier("medium");
        } else if (qualityTier === "medium") {
          setQualityTier("high");
        }
        highFpsSince.current = null;
      }
    }
    // ─── Stable ───────────────────────────────────────────────
    else {
      lowFpsSince.current = null;
      highFpsSince.current = null;
    }
  });
}
