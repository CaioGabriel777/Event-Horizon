/**
 * StarField — Points Particle System
 * ==========================================
 * High-performance star field using THREE.Points and ShaderMaterial.
 * Reduces the cost to 1 vertex per star compared to InstancedMesh.
 * Implements an organic twinkling effect via GLSL.
 */

"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Points,
  Vector3,
  Color,
  AdditiveBlending,
  ShaderMaterial
} from "three";
import { useExperienceStore } from "@/store/useExperienceStore";
import { PERFORMANCE, COLORS } from "@/lib/constants";

const vertexShader = `
uniform float uTime;
attribute float size;
attribute vec3 color;
varying vec3 vColor;
varying float vTwinkle;

void main() {
    vColor = color;
    // Create a random twinkling pattern based on star position
    vTwinkle = sin(uTime * 1.5 + position.x * 100.0 + position.y * 50.0) * 0.5 + 0.5;
    
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Size attenuation based on depth
    gl_PointSize = size * (250.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = `
varying vec3 vColor;
varying float vTwinkle;

void main() {
    // Draw a smooth procedural circle from the gl_PointCoord square
    vec2 centerUv = gl_PointCoord.xy - vec2(0.5);
    float dist = length(centerUv);
    
    if (dist > 0.5) discard; // Discard the corners of the square
    
    // Smooth edge and multiply by twinkle effect
    float alpha = smoothstep(0.5, 0.1, dist) * (0.6 + vTwinkle * 0.4);
    
    gl_FragColor = vec4(vColor, alpha);
}
`;

interface StarFieldProps {
  radius?: number;
}

export function StarField({ radius = 300 }: StarFieldProps) {
  const meshRef = useRef<Points>(null!);
  const gravity = useExperienceStore((s) => s.gravity);
  
  const count = PERFORMANCE.particles.high;

  // Pre-compute all instance transforms
  const { positions, colors, sizes } = useMemo(() => {
    const tempPosition = new Vector3();
    const pos = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);
    const szs = new Float32Array(count);

    const starColor = new Color(COLORS.starWhite);
    const dimColor = new Color(COLORS.softWhite);
    // Warm and cool tints for color variety
    const warmColor = new Color("#ffe4c4");
    const coolColor = new Color("#c4d8ff");

    for (let i = 0; i < count; i++) {
      // Distribute on a sphere with some clustering
      // EXCLUSION ZONE: no stars within a cylinder around the BH center
      let attempts = 0;
      do {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = radius * (0.3 + Math.random() * 0.7);
        tempPosition.setFromSphericalCoords(r, phi, theta);
        attempts++;
      } while (
        Math.sqrt(tempPosition.x * tempPosition.x + tempPosition.y * tempPosition.y) < 6 &&
        tempPosition.z > -25 && tempPosition.z < 20 &&
        attempts < 5
      );

      pos[i * 3] = tempPosition.x;
      pos[i * 3 + 1] = tempPosition.y;
      pos[i * 3 + 2] = tempPosition.z;

      szs[i] = Math.random() * 2.0 + 0.5;

      // Color variation: white, warm, and cool tones
      const colorRoll = Math.random();
      let c: Color;
      if (colorRoll > 0.9) c = warmColor;
      else if (colorRoll > 0.8) c = coolColor;
      else if (colorRoll > 0.6) c = starColor;
      else c = dimColor;

      const brightness = 0.7 + Math.random() * 0.3;
      cols[i * 3] = c.r * brightness;
      cols[i * 3 + 1] = c.g * brightness;
      cols[i * 3 + 2] = c.b * brightness;
    }

    return { positions: pos, colors: cols, sizes: szs };
  }, [count, radius]);

  // Subtle rotation of the entire star field
  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // Update uTime in shaderMaterial for twinkling animation
    const material = meshRef.current.material as ShaderMaterial;
    if (material.uniforms) {
      material.uniforms.uTime.value = state.clock.elapsedTime;
    }

    // Skybox Effect: Follow the camera position
    meshRef.current.position.copy(state.camera.position);

    // Slow rotation — stars drift
    meshRef.current.rotation.y += delta * 0.005;

    // At high gravity, stars get pulled inward (scale down)
    const targetScale = 1.0 - gravity * 0.3;
    meshRef.current.scale.lerp(
      new Vector3(targetScale, targetScale, targetScale),
      0.02
    );
  });

  return (
    <points ref={meshRef} frustumCulled={false} renderOrder={-1}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          args={[sizes, 1]}
        />
      </bufferGeometry>
      <shaderMaterial
        transparent={true}
        depthWrite={false}
        blending={AdditiveBlending}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uTime: { value: 0 },
        }}
      />
    </points>
  );
}
