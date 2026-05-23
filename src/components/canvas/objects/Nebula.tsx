/**
 * Nebula — Optimized Volumetric Particle Cloud
 * =============================================
 * Creates a dense nebula using 600 instanced billboard particles.
 * Optimized for 60 FPS:
 * - 600 instances (single draw call)
 * - PlaneGeometry billboards (4 vertices each)
 * - Lightweight gradient noise in fragment shader (2-octave FBM)
 * - Additive blending for luminous gas
 * - frustumCulled=false (particles always render, cheap to discard in shader)
 */

"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import {
  InstancedMesh,
  Matrix4,
  Vector3,
  ShaderMaterial,
  InstancedBufferAttribute,
  AdditiveBlending,
  DoubleSide,
} from "three";
import { useExperienceStore } from "@/store/useExperienceStore";

import vertexShader from "@/shaders/nebula/vertex.glsl";
import fragmentShader from "@/shaders/nebula/fragment.glsl";

// ─── Config ─────────────────────────────────────────────────────────────────

const PARTICLE_COUNT = 800;
const CLOUD_CENTER_Z = 10; // Pushed far back. Camera is at Z=50. Distance = 40 units.

// ─── Particle Distribution ─────────────────────────────────────────────────

function generateParticles(count: number) {
  const matrices: Matrix4[] = [];
  const colors = new Float32Array(count * 3);
  const mat = new Matrix4();
  const pos = new Vector3();

  for (let i = 0; i < count; i++) {
    let type = Math.random();
    
    // ─── Dust Lanes & Voids ───────────────────────────────────────────────
    // We intentionally cluster particles and leave dark gaps
    let x = (Math.random() - 0.5) * 40;
    let y = (Math.random() - 0.5) * 30;
    let z = CLOUD_CENTER_Z + (Math.random() - 0.5) * 20;

    // Simulate "Dust Lanes" - if the particle falls in a certain sine-wave grid, 
    // we either push it out or make it very faint.
    let isDustLane = Math.sin(x * 0.15) * Math.cos(y * 0.15) > 0.4;
    
    if (isDustLane && Math.random() > 0.2) {
      // Push particle to the edges of the dust lane
      x += (Math.random() > 0.5 ? 5 : -5);
      y += (Math.random() > 0.5 ? 5 : -5);
    }

    pos.set(x, y, z);

    // ─── Massive Cumuliform Volume ────────────────────────────────────────
    const isCore = type < 0.3 && !isDustLane;
    
    // Uniform, massive scale to guarantee AdditiveBlending overlap.
    // Core areas get giant puffs, outer areas get medium puffs.
    const scale = isCore ? 45 + Math.random() * 25 : 30 + Math.random() * 20;

    mat.makeTranslation(pos.x, pos.y, pos.z);
    mat.multiply(new Matrix4().makeRotationZ(Math.random() * Math.PI));
    mat.scale(new Vector3(scale, scale, 1.0)); // Square billboard
    matrices.push(mat.clone());

    // ─── Chemical Colors (Oxygen Blue vs Hydrogen Pink) ──────────────────
    colors[i * 3] = Math.random();
    
    // Density is lower in dust lanes to ensure they stay dark
    const baseDensity = isCore ? 0.3 + Math.random() * 0.2 : 0.1 + Math.random() * 0.15;
    colors[i * 3 + 1] = isDustLane ? baseDensity * 0.1 : baseDensity;
    
    // 40% chance of Oxygen (Cyan), 60% Hydrogen (Pink)
    colors[i * 3 + 2] = Math.random() > 0.6 ? 0.8 : 0.2; 
  }

  return { matrices, colors };
}

// ─── Component ──────────────────────────────────────────────────────────────

import { useScroll } from "@react-three/drei";

export function Nebula() {
  const meshRef = useRef<InstancedMesh>(null!);
  const materialRef = useRef<ShaderMaterial>(null!);
  const initialized = useRef(false);

  const scroll = useScroll();

  const { matrices, colors } = useMemo(() => generateParticles(PARTICLE_COUNT), []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uScroll: { value: 0 }, // Added uScroll uniform
  }), []);

  // Initialize instance matrices and colors once after mount
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

  // Animate uniforms every frame
  useFrame((state) => {
    if (!materialRef.current) return;

    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    
    const scrollProgress = scroll.offset;
    materialRef.current.uniforms.uScroll.value = scrollProgress; // Pass scroll directly

    // Dissolve starts at 0.40 (revelation) and completes by 0.60
    let progress = 0;
    if (scrollProgress > 0.4) {
      progress = Math.min(1, (scrollProgress - 0.4) / 0.2);
    }
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
