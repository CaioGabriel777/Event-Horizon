/**
 * Nebula — Texture-Based Volumetric Particle Cloud
 * ============================================================================
 * Optimized for maximum fill-rate performance using a pre-rendered
 * smoke texture instead of expensive procedural fragment noise.
 *
 * Placement is WORLD-ANCHORED: the cloud center and depth come from
 * constants (NEBULA_CENTER_Z / NEBULA_HALF_DEPTH), which are derived from
 * the journey's world anchors. Moving the nebula in constants.ts moves the
 * particles, the dissolve timing, and the phase boundaries together.
 */

"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useScroll, useTexture } from "@react-three/drei";
import {
  InstancedMesh,
  Matrix4,
  Vector3,
  ShaderMaterial,
  InstancedBufferAttribute,
  AdditiveBlending,
  DoubleSide,
} from "three";
import { NEBULA_CENTER_Z, NEBULA_HALF_DEPTH } from "@/lib/constants";

import vertexShader from "@/shaders/nebula/vertex.glsl";
import fragmentShader from "@/shaders/nebula/fragment.glsl";

// ─── Config ─────────────────────────────────────────────────────────────────

const PARTICLE_COUNT = 20;
const CLOUD_CENTER_Z = NEBULA_CENTER_Z;

// Particle Z-spread is derived from the intended world depth of the cloud.
// The core sits in the dense middle; the halo extends toward the full depth
// but is kept WITHIN the anchored extent (factor ≤ 1.0 each side) so the
// gas never spills past nebulaFarZ into the zone where the black hole must
// be visible.
const CORE_Z_SPREAD = NEBULA_HALF_DEPTH * 1.0;
const HALO_Z_SPREAD = NEBULA_HALF_DEPTH * 1.2;

// ─── Particle Distribution ──────────────────────────────────────────────────

function generateParticles(count: number) {
  const matrices: Matrix4[] = [];
  const colors = new Float32Array(count * 3);
  const mat = new Matrix4();
  const pos = new Vector3();

  for (let i = 0; i < count; i++) {
    let type = Math.random();
    const isCore = type < 0.4;

    // ─── Core Centralization (Circular Distribution) ────────────────────────
    const radiusBias = isCore ? 2.0 : 1.2;
    const radius = Math.pow(Math.random(), radiusBias) * (isCore ? 18 : 35);
    const angle = Math.random() * Math.PI * 2;

    let x = Math.cos(angle) * radius;
    let y = Math.sin(angle) * radius;
    let z =
      CLOUD_CENTER_Z +
      (Math.random() - 0.5) * (isCore ? CORE_Z_SPREAD : HALO_Z_SPREAD);

    let isDustLane = Math.sin(x * 0.15) * Math.cos(y * 0.15) > 0.4 && !isCore;

    pos.set(x, y, z);

    // ─── Colossal Scale ─────────────────────────────────────────────────────
    const scale = isCore ? 80 + Math.random() * 50 : 50 + Math.random() * 40;

    mat.makeTranslation(pos.x, pos.y, pos.z);
    mat.multiply(new Matrix4().makeRotationZ(Math.random() * Math.PI));
    mat.scale(new Vector3(scale, scale, 1.0));
    matrices.push(mat.clone());

    // ─── Colors & Density ───────────────────────────────────────────────────
    colors[i * 3] = Math.random();

    const baseDensity = isCore ? 0.5 + Math.random() * 0.3 : 0.2 + Math.random() * 0.2;
    colors[i * 3 + 1] = isDustLane ? baseDensity * 0.1 : baseDensity;
    colors[i * 3 + 2] = Math.random() > 0.6 ? 0.8 : 0.2;
  }

  return { matrices, colors };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function Nebula() {
  const meshRef = useRef<InstancedMesh>(null!);
  const materialRef = useRef<ShaderMaterial>(null!);
  const initialized = useRef(false);

  const scroll = useScroll();

  // Load the texture from the public folder
  const smokeTexture = useTexture("/smoke.png");

  const { matrices, colors } = useMemo(() => generateParticles(PARTICLE_COUNT), []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uScroll: { value: 0 },
    uTexture: { value: smokeTexture }, // Passing texture to shader
  }), [smokeTexture]);

  useEffect(() => {
    if (!meshRef.current || initialized.current) return;

    for (let i = 0; i < matrices.length; i++) {
      meshRef.current.setMatrixAt(i, matrices[i]);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    meshRef.current.geometry.setAttribute(
      "instanceColor",
      new InstancedBufferAttribute(colors, 3)
    );

    initialized.current = true;
  }, [matrices, colors]);

  useFrame((state) => {
    if (!materialRef.current) return;

    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;

    // ─── Dissolve by FIXED scroll values, EASED so it stays dense ─────
    // The window is 0.18 → 0.35, but a LINEAR fade made the gas go
    // transparent too early — you could see through it right after the
    // start. Raising the linear factor to the 4th power keeps the cloud
    // dense through most of the crossing and only clears it at the very
    // end: at scroll 0.30 the gas is still ~75% opaque, so it genuinely
    // hides the black hole until the final stretch, then opens up. These
    // bounds match the traversal end / reveal in constants.ts (both 0.35).
    const s = scroll.offset;
    const DISSOLVE_START = 0.10;
    const DISSOLVE_END = 0.210; // matches nebulaExit / reveal end in constants.ts
    const t = Math.min(
      1,
      Math.max(0, (s - DISSOLVE_START) / (DISSOLVE_END - DISSOLVE_START))
    );
    const progress = t * t * t * t; // eased: dense until the end, then clears
    materialRef.current.uniforms.uScroll.value = s;
    materialRef.current.uniforms.uProgress.value = progress;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, PARTICLE_COUNT]}
      frustumCulled={false}
      renderOrder={-5}
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        depthTest={true}
        side={DoubleSide}
        blending={AdditiveBlending}
      />
    </instancedMesh>
  );
}