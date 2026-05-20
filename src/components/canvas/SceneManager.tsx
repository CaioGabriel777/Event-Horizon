/**
 * SceneManager — Cinematic Scene Orchestrator
 * ============================================
 * Lives inside <ScrollControls> and <Canvas>.
 * Responsibilities:
 * 1. Bridge scroll position → Zustand store
 * 2. Animate camera position based on current phase
 * 3. Render all scenes (conditionally active based on phase)
 * 4. Run performance monitoring hooks
 */

"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { useScrollPhase } from "@/hooks/useScrollPhase";
import { usePerformanceMonitor } from "@/hooks/usePerformanceMonitor";
import { useAdaptiveQuality } from "@/hooks/useAdaptiveQuality";
import { useExperienceStore } from "@/store/useExperienceStore";
import { PHASES, CAMERA } from "@/lib/constants";
import { damp } from "@/lib/math";

// Scene components
import { NebulaScene } from "./scenes/NebulaScene";
import { DiscoveryScene } from "./scenes/DiscoveryScene";
import { ApproachScene } from "./scenes/ApproachScene";
import { EventHorizonScene } from "./scenes/EventHorizonScene";
import { SingularityScene } from "./scenes/SingularityScene";

export function SceneManager() {
  // ─── Hooks ──────────────────────────────────────────────────
  useScrollPhase();          // Bridge scroll → Zustand
  usePerformanceMonitor();   // Track FPS, draw calls
  useAdaptiveQuality();      // Auto-downgrade quality

  const { camera } = useThree();
  const phase = useExperienceStore((s) => s.phase);
  const scrollProgress = useExperienceStore((s) => s.scrollProgress);

  // Camera animation target
  const targetPos = useRef(new Vector3(...CAMERA.initialPosition));

  // ─── Camera Animation ───────────────────────────────────────
  useFrame((_, delta) => {
    // Find current phase config for target camera Z
    const config = PHASES.find((p) => p.id === phase);
    if (!config) return;

    // Smooth camera movement
    targetPos.current.z = config.cameraZ;

    camera.position.x = damp(camera.position.x, 0, 3, delta);
    camera.position.y = damp(camera.position.y, 0, 3, delta);
    camera.position.z = damp(camera.position.z, targetPos.current.z, 2, delta);

    // Always look at origin
    camera.lookAt(0, 0, 0);
  });

  // ─── Render all scenes ──────────────────────────────────────
  // All scenes are always mounted but can internally skip rendering
  // based on phase to avoid mount/unmount overhead
  return (
    <group>
      <NebulaScene active={phase === "nebula"} />
      <DiscoveryScene active={phase === "discovery" || phase === "approach"} />
      <ApproachScene active={
        phase === "approach" ||
        phase === "discovery" ||
        phase === "event-horizon"
      } />
      <EventHorizonScene active={phase === "event-horizon"} />
      <SingularityScene active={phase === "singularity"} />
    </group>
  );
}
