/**
 * usePerformanceMonitor — Real-time GPU Metrics
 * ==============================================
 * Collects renderer statistics from Three.js every second
 * and pushes them to the performance Zustand store.
 *
 * Metrics collected:
 * - FPS (rolling average over 60 frames)
 * - Draw calls, triangles, geometries, textures
 * - Current DPR
 * - Frame time (ms)
 */

"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { usePerformanceStore } from "@/store/usePerformanceStore";
import { PERFORMANCE } from "@/lib/constants";

export function usePerformanceMonitor() {
  const { gl } = useThree();
  const updateMetrics = usePerformanceStore((s) => s.updateMetrics);

  // Rolling FPS buffer
  const fpsBuffer = useRef<number[]>([]);
  const lastUpdate = useRef(0);
  const lastFrameTime = useRef(performance.now());

  useFrame(() => {
    const now = performance.now();
    const delta = now - lastFrameTime.current;
    lastFrameTime.current = now;

    // Track instantaneous FPS
    const instantFPS = 1000 / Math.max(delta, 1);
    fpsBuffer.current.push(instantFPS);

    // Keep buffer at window size
    if (fpsBuffer.current.length > PERFORMANCE.fpsWindowSize) {
      fpsBuffer.current.shift();
    }

    // Update store once per second
    if (now - lastUpdate.current > 1000) {
      lastUpdate.current = now;

      // Rolling average FPS
      const avgFPS =
        fpsBuffer.current.reduce((a, b) => a + b, 0) /
        fpsBuffer.current.length;

      const info = gl.info;

      updateMetrics({
        fps: Math.round(avgFPS),
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        currentDPR: gl.getPixelRatio(),
        frameTime: Math.round(delta * 100) / 100,
      });
    }
  });
}
