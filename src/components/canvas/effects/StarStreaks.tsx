"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Points, ShaderMaterial, Vector3 } from "three";
import { useExperienceStore } from "@/store/useExperienceStore";

// Must match the black hole position in SceneManager
const BLACK_HOLE_POS = new Vector3(0, 0, -20);

const vertexShader = /* glsl */ `
  uniform float uStretch;      // 0.0 → 1.0
  uniform vec3  uBlackHolePos; // World position of the black hole
  uniform float uTime;

  attribute float aSize;       // Base size of each star
  attribute float aSpeed;      // Individual speed variation

  varying float vAlpha;
  varying float vStretch;

  void main() {
    vec3 pos = position;

    // Direction of the star towards the black hole
    vec3 toCenter = uBlackHolePos - pos;
    float dist = length(toCenter);
    vec3 dir = normalize(toCenter);

    // Pull: moves the star towards the black hole as uStretch increases
    // Closer stars are pulled faster (gravitational effect)
    float pull = uStretch * aSpeed * (1.0 / max(dist * 0.02, 0.5));
    pos += dir * pull * 8.0;

    vAlpha = 0.6 + uStretch * 0.4;
    vStretch = uStretch;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (1.0 + uStretch * 3.0) * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying float vStretch;

  void main() {
    // Particle shape: radially stretched ellipse
    vec2 uv = gl_PointCoord - 0.5;

    // Stretch the point vertically as vStretch increases
    // creating the speed line
    uv.y *= 1.0 + vStretch * 12.0;

    float d = length(uv);
    if (d > 0.5) discard;

    float alpha = smoothstep(0.5, 0.0, d) * vAlpha;

    // Color: cool white → cyan blue on the edges (Doppler effect)
    vec3 color = mix(vec3(1.0, 1.0, 1.0), vec3(0.6, 0.85, 1.0), vStretch * d * 2.0);

    gl_FragColor = vec4(color, alpha);
  }
`;

export function StarStreaks() {
  const pointsRef = useRef<Points>(null!);
  const materialRef = useRef<ShaderMaterial>(null!);
  const currentStretch = useRef(0);
  const prevPhase = useRef<string>("");

  const { positions, sizes, speeds } = useMemo(() => {
    const COUNT = 2000;
    const pos = new Float32Array(COUNT * 3);
    const siz = new Float32Array(COUNT);
    const spd = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      // Sphere of radius 40-120 units
      const r = 40 + Math.random() * 80;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi) - 10; // Z offset to cover the journey
      siz[i]  = 1.5 + Math.random() * 2.5;
      spd[i] = 0.5 + Math.random() * 1.5;
    }

    return { positions: pos, sizes: siz, speeds: spd };
  }, []);

  const uniforms = useMemo(() => ({
    uStretch: { value: 0 },
    uBlackHolePos: { value: BLACK_HOLE_POS },
    uTime: { value: 0 }
  }), []);

  useFrame(({ clock }) => {
    const { phase, gravity } = useExperienceStore.getState();

    // Instant reset when exiting singularity
    if (prevPhase.current === 'singularity' && phase !== 'singularity') {
      currentStretch.current = 0;
      if (materialRef.current) {
        materialRef.current.uniforms.uStretch.value = 0;
      }
      if (pointsRef.current) {
        pointsRef.current.visible = false;
      }
      prevPhase.current = phase;
      return;
    }
    prevPhase.current = phase;

    const target = phase === 'singularity'
      ? Math.min(1.0, (gravity - 0.85) / 0.12)
      : 0.0;
    
    // Asymmetric lerp: enters slowly, exits instantly
    if (target === 0 && currentStretch.current < 0.01) {
      currentStretch.current = 0;
    } else {
      currentStretch.current += (target - currentStretch.current) * 0.04;
    }
    
    if (materialRef.current) {
      materialRef.current.uniforms.uStretch.value = currentStretch.current;
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
    
    if (pointsRef.current) {
      pointsRef.current.visible = currentStretch.current > 0.001;
    }
  });

  return (
    <points ref={pointsRef} visible={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </points>
  );
}
