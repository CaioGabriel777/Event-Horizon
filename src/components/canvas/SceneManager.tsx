/**
 * SceneManager — Cinematic Timeline Orchestrator
 * ================================================
 * Lives inside <ScrollControls> and <Canvas>.
 *
 * KEY ARCHITECTURE: Camera Z is driven by continuous keyframe
 * interpolation from CAMERA_KEYFRAMES, NOT discrete phase jumps.
 * This gives butter-smooth camera movement through the entire
 * scroll range.
 *
 * CAMERA OWNERSHIP MODEL (priority order):
 *  1. useOrbitCamera  — owns the camera while `isOrbitActive` (the
 *     cinematic event-horizon orbit). Registered BEFORE this
 *     component's useFrame, so its position is applied first and this
 *     frame loop early-outs.
 *  2. SingularityPass — owns FOV/rendering while `isSingularityActive`.
 *     This frame loop early-outs; the camera stays frozen where the
 *     orbit left it, which is exactly where the spaghettification
 *     effect expects it.
 *  3. This component  — default scroll-driven dolly on every other frame.
 *
 * BLACKOUT CAMERA SNAP: during the singularity timeline, the atomic
 * reset flips the phase back to the early phases while the screen is
 * still pitch black (t ≈ 0.82 → fade-in). In that invisible window we
 * teleport the camera home, so the loop never shows reverse travel.
 *
 * PHYSICAL CAMERA HEIGHT: the camera rides at CAMERA.baseHeight above
 * the disk plane. This replaces the old 5° tilt hack that lived inside
 * the black hole fragment shader — the shader is now 100% physically
 * driven by the real camera matrix.
 *
 * SHADER WARMUP: On frame 0 (!isReady), all heavy 3D components are forced
 * to be visible. This guarantees that Three.js gl.compile() processes them
 * synchronously before the canvas fades in, preventing extreme lag spikes.
 */

"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { useScroll } from "@react-three/drei";
import { useScrollPhase } from "@/hooks/useScrollPhase";
import { useOrbitCamera } from "@/hooks/useOrbitCamera";
import { usePerformanceMonitor } from "@/hooks/usePerformanceMonitor";
import { useAdaptiveQuality } from "@/hooks/useAdaptiveQuality";
import { useExperienceStore } from "@/store/useExperienceStore";
import { CAMERA, CAMERA_KEYFRAMES } from "@/lib/constants";
import { damp, lerp } from "@/lib/math";

// Scene components
import { NebulaScene } from "./scenes/NebulaScene";
import { DiscoveryScene } from "./scenes/DiscoveryScene";
import { ApproachScene } from "./scenes/ApproachScene";
import { EventHorizonScene } from "./scenes/EventHorizonScene";
import { SingularityScene } from "./scenes/SingularityScene";
import { BlackHole } from "./objects/BlackHole";
import { StarStreaks } from "./effects/StarStreaks";

const BH_Z = -20;

/**
 * Interpolate camera Z from the keyframe table.
 * Linear interpolation between the two surrounding keyframes.
 */
function getCameraZ(scroll: number): number {
  const kf = CAMERA_KEYFRAMES;
  if (scroll <= kf[0].scroll) return kf[0].z;
  if (scroll >= kf[kf.length - 1].scroll) return kf[kf.length - 1].z;

  for (let i = 0; i < kf.length - 1; i++) {
    if (scroll >= kf[i].scroll && scroll <= kf[i + 1].scroll) {
      const t = (scroll - kf[i].scroll) / (kf[i + 1].scroll - kf[i].scroll);
      return lerp(kf[i].z, kf[i + 1].z, t);
    }
  }
  return kf[kf.length - 1].z;
}

export function SceneManager() {
  useScrollPhase();
  usePerformanceMonitor();
  useAdaptiveQuality();
  // Registers its useFrame BEFORE this component's — when the orbit is
  // running it positions the camera first, then this loop early-outs.
  useOrbitCamera();

  const { camera } = useThree();
  const phase = useExperienceStore((s) => s.phase);
  const isReady = useExperienceStore((s) => s.isReady);
  const setReady = useExperienceStore((s) => s.setReady);
  const scroll = useScroll();

  const lookTarget = useRef(new Vector3(0, 0, 0));
  const readySignaled = useRef(false);
  const cameraSnapped = useRef(false);

  useFrame((_, delta) => {
    // Signal ready after shaders compile
    if (!readySignaled.current) {
      readySignaled.current = true;
      // Synchronous compilation has already occurred in this frame.
      // The next RequestAnimationFrame triggers the fade-in, releasing the screen to the user.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setReady();
        });
      });
    }

    const expState = useExperienceStore.getState();

    // ─── Blackout Camera Snap ───────────────────────────────────────
    // After the singularity's atomic reset (t ≈ 0.82), the phase has
    // already flipped back to the early phases while the screen is
    // still pitch black. Teleport home invisibly — the user never sees
    // the camera travel in reverse, and the orbit's final position is
    // discarded cleanly.
    if (
      expState.isSingularityActive &&
      expState.phase !== "singularity" &&
      !cameraSnapped.current
    ) {
      cameraSnapped.current = true;
      camera.position.set(
        0,
        CAMERA.baseHeight,
        CAMERA_KEYFRAMES[0].z
      );
      lookTarget.current.set(0, 0, 0);
      camera.lookAt(lookTarget.current);
      console.log("[SceneManager] Camera snapped home during blackout");
    }
    if (!expState.isSingularityActive && cameraSnapped.current) {
      cameraSnapped.current = false;
    }

    // ─── Cinematic ownership guards ─────────────────────────────────
    // Orbit hook owns the camera during the event-horizon approach;
    // the singularity timeline owns rendering during the collapse.
    if (expState.isSingularityActive || expState.isOrbitActive) return;

    const scrollProgress = scroll.offset;

    // ─── Continuous Camera Z from keyframes ────────────────────
    const targetZ = getCameraZ(scrollProgress);
    camera.position.x = damp(camera.position.x, 0, 3, delta);
    // Physical camera height replaces the old in-shader 5° tilt hack:
    // riding above the disk plane lets the world-space raymarcher show
    // the accretion disk's top face with true physical accuracy.
    camera.position.y = damp(camera.position.y, CAMERA.baseHeight, 3, delta);

    // Singularity gets faster damping for suck-in effect
    const isSingularity = phase === "singularity";
    const dampSpeed = isSingularity ? 12 : 3;
    camera.position.z = damp(camera.position.z, targetZ, dampSpeed, delta);

    // ─── Dynamic Look-At ───────────────────────────────────────
    const isEntering = isSingularity || phase === "event-horizon";
    const targetLookZ = isEntering ? BH_Z : 0;
    const lookDamp = isSingularity ? 8 : 1.5;
    lookTarget.current.z = damp(lookTarget.current.z, targetLookZ, lookDamp, delta);
    camera.lookAt(lookTarget.current);
  });

  // ─── Scene Visibility ────────────────────────────────────────
  // Nebula: visible during home → revelation (0.00 - 0.60)
  const nebulaActive =
    phase === "home" ||
    phase === "awakening" ||
    phase === "traversal" ||
    phase === "revelation";

  // BH scenes: visible from revelation onward (0.40+)
  const bhActive =
    phase === "revelation" ||
    phase === "discovery" ||
    phase === "approach" ||
    phase === "event-horizon" ||
    phase === "singularity";

  return (
    <group>
      <BlackHole position={[0, 0, -20]} scale={22} visible={!isReady || true} />
      <NebulaScene active={!isReady || nebulaActive} />
      <DiscoveryScene active={!isReady || phase === "discovery" || phase === "approach" || phase === "revelation"} />
      <ApproachScene active={!isReady || bhActive} />
      <EventHorizonScene active={!isReady || phase === "event-horizon"} />
      <SingularityScene active={!isReady || phase === "singularity"} />
      <StarStreaks />
    </group>
  );
}