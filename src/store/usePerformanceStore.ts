/**
 * Event Horizon — Performance Store (Zustand)
 * ============================================
 * Tracks real-time rendering metrics for the tech dashboard
 * and adaptive quality system.
 */

import { create } from "zustand";
import type { PerformanceMetrics, QualityTier } from "@/types";

export const usePerformanceStore = create<PerformanceMetrics>()((set) => ({
  fps: 60,
  drawCalls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  currentDPR: 1,
  gpuTier: "high" as QualityTier,
  frameTime: 0,

  updateMetrics: (metrics) => {
    set((state) => ({ ...state, ...metrics }));
  },
}));
