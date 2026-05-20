/**
 * GravityText — The Signature Effect
 * ===================================
 * Drei <Text> component with custom ShaderMaterial that reacts
 * to gravitational pull. Text deforms progressively:
 *
 * 1. Tremor → 2. Spaghettification → 3. Pull → 4. Collapse
 *
 * This component uses troika-three-text under the hood (via Drei).
 * We apply custom vertex/fragment shaders by extending the material
 * using troika's `onBeforeCompile`-style material customization.
 *
 * ARCHITECTURE NOTE: Because troika manages its own MSDF shader pipeline,
 * we can't simply replace the material. Instead, we use the `material`
 * prop to inject a custom ShaderMaterial, and we use the `onSync` callback
 * to apply additional vertex transformations.
 *
 * For maximum compatibility, we use a simpler approach:
 * - Create a custom ShaderMaterial
 * - Use Text's built-in material override
 * - Handle SDF rendering ourselves in the fragment shader
 *
 * PRAGMATIC APPROACH: We use Drei's <Text> with `material-*` props
 * for uniforms, then apply shader modifications via `onBeforeCompile`.
 */

"use client";

import { useRef, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { ShaderMaterial, Color } from "three";
import { useExperienceStore } from "@/store/useExperienceStore";

// ─── Vertex Shader Injection ────────────────────────────────────────────────
// This code is PREPENDED to troika's vertex shader via onBeforeCompile
const vertexPreamble = /* glsl */ `
  uniform float uGravity;
  uniform float uTime;
  uniform vec3 uBlackHolePos;
  uniform float uNoiseScale;
  uniform float uStretchFactor;

  // Simplex noise
  vec3 mod289v(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289v(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permutev(vec3 x) { return mod289v(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289v(i);
    vec3 p = permutev(permutev(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m * m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
`;

// This code REPLACES the position transformation in troika's vertex shader
const vertexTransform = /* glsl */ `
  // ─── Phase 1: Tremor ────────────────────────────────────────
  float tremor = smoothstep(0.0, 0.2, uGravity);
  position.x += snoise(vec2(position.x * uNoiseScale + uTime * 2.0, position.y * uNoiseScale)) * tremor * 0.02;
  position.y += snoise(vec2(position.y * uNoiseScale + uTime * 1.5, position.x * uNoiseScale + 100.0)) * tremor * 0.015;

  // ─── Phase 2: Spaghettification ─────────────────────────────
  float stretch = smoothstep(0.2, 0.5, uGravity);
  position.y += position.y * stretch * uStretchFactor;
  position.x *= 1.0 - stretch * 0.15;

  // ─── Phase 3: Directional Pull ──────────────────────────────
  float pull = smoothstep(0.5, 0.8, uGravity);
  vec3 toBH = uBlackHolePos - position;
  float distToBH = length(toBH);
  vec3 pullDir = normalize(toBH);
  float pullStrength = pull * 0.5 / (distToBH * 0.1 + 1.0);
  position += pullDir * pullStrength;
  position.x += snoise(vec2(position.x * 5.0 + uTime * 3.0, position.y * 5.0)) * pull * 0.08;

  // ─── Phase 4: Collapse ──────────────────────────────────────
  float collapse = smoothstep(0.8, 1.0, uGravity);
  position = mix(position, uBlackHolePos, collapse * collapse);
  position.x += snoise(vec2(uTime * 10.0, position.y * 20.0)) * collapse * 0.1;
`;

// ─── Fragment Shader Injection ──────────────────────────────────────────────
const fragmentPreamble = /* glsl */ `
  uniform float uGravity;
  uniform float uTime;

  float hashGT(float n) {
    return fract(sin(n) * 43758.5453123);
  }
`;

const fragmentColorTransform = /* glsl */ `
  // ─── Doppler Color Shift ───────────────────────────────────
  float blueShift = smoothstep(0.0, 0.3, uGravity);
  float redShift = smoothstep(0.3, 0.7, uGravity);
  float dimming = smoothstep(0.7, 1.0, uGravity);

  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.7, 0.8, 1.0), blueShift * 0.3);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.5, 0.2), redShift * 0.4);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.2, 0.05, 0.0), dimming * 0.7);

  // ─── Scanline Glitch ───────────────────────────────────────
  float scanlinePhase = smoothstep(0.5, 0.7, uGravity);
  float scanline = step(0.97, fract(vTroikaGlyphUV.y * 40.0 + uTime * 5.0));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.3, 0.1), scanline * scanlinePhase * 0.5);

  // ─── Opacity Decay ─────────────────────────────────────────
  gl_FragColor.a *= 1.0 - dimming * 0.85;

  // ─── Flicker ───────────────────────────────────────────────
  float flicker = 1.0 - step(0.96, hashGT(uTime * 100.0 + vTroikaGlyphUV.x * 50.0))
                  * smoothstep(0.6, 0.9, uGravity) * 0.5;
  gl_FragColor.a *= flicker;
`;

// ─── Component ──────────────────────────────────────────────────────────────

interface GravityTextProps {
  children: string;
  position?: [number, number, number];
  fontSize?: number;
  color?: string;
  maxWidth?: number;
  blackHolePosition?: [number, number, number];
  anchorX?: "left" | "center" | "right";
  anchorY?: "top" | "top-baseline" | "middle" | "bottom-baseline" | "bottom";
}

export function GravityText({
  children,
  position = [0, 0, 0],
  fontSize = 0.5,
  color = "#e8e6e3",
  maxWidth = 10,
  blackHolePosition = [0, -2, -10],
  anchorX = "center",
  anchorY = "middle",
}: GravityTextProps) {
  const textRef = useRef<any>(null);
  const gravity = useExperienceStore((s) => s.gravity);

  // Apply custom shader modifications when the text mesh syncs
  const handleSync = useCallback((troikaMesh: any) => {
    if (!troikaMesh?.material) return;

    const mat = troikaMesh.material as ShaderMaterial;

    // Inject our custom uniforms
    if (!mat.uniforms?.uGravity) {
      mat.uniforms.uGravity = { value: 0 };
      mat.uniforms.uTime = { value: 0 };
      mat.uniforms.uBlackHolePos = { value: blackHolePosition };
      mat.uniforms.uNoiseScale = { value: 2.5 };
      mat.uniforms.uStretchFactor = { value: 2.0 };
    }

    // Use troika's built-in shader customization hooks
    troikaMesh.material.onBeforeCompile = (shader: any) => {
      // Merge our uniforms
      shader.uniforms.uGravity = mat.uniforms.uGravity;
      shader.uniforms.uTime = mat.uniforms.uTime;
      shader.uniforms.uBlackHolePos = mat.uniforms.uBlackHolePos;
      shader.uniforms.uNoiseScale = mat.uniforms.uNoiseScale;
      shader.uniforms.uStretchFactor = mat.uniforms.uStretchFactor;

      // Inject vertex shader code
      shader.vertexShader = vertexPreamble + "\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n" + vertexTransform
      );

      // Inject fragment shader code
      shader.fragmentShader = fragmentPreamble + "\n" + shader.fragmentShader;

      // Append color transform before the final output
      shader.fragmentShader = shader.fragmentShader.replace(
        /}\s*$/,
        fragmentColorTransform + "\n}"
      );
    };

    // Force recompilation
    mat.needsUpdate = true;
  }, [blackHolePosition]);

  // Update uniforms every frame imperatively (no React render)
  useFrame((state) => {
    if (!textRef.current?.material?.uniforms) return;

    const mat = textRef.current.material;
    if (mat.uniforms.uGravity) {
      mat.uniforms.uGravity.value = gravity;
      mat.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <Text
      ref={textRef}
      position={position}
      fontSize={fontSize}
      color={color}
      maxWidth={maxWidth}
      anchorX={anchorX}
      anchorY={anchorY}
      font="/fonts/SpaceGrotesk-Medium.ttf"
      onSync={handleSync}
    >
      {children}
    </Text>
  );
}
