"use client";

/**
 * Black Hole Component (React Three Fiber)
 * =========================================================================
 * Renders a Gargantua-style black hole via a two-pass architecture:
 *
 *  Pass 1 — RAYMARCH: Renders the full-screen shader into an off-screen FBO
 *           at reduced resolution (driven by GPU profile).
 *  Pass 2 — COMPOSITE: A second full-screen quad samples the FBO texture
 *           with bilinear filtering, producing a smooth upscale to native res.
 *
 * This decouples raymarch cost from display resolution — the single biggest
 * performance lever for integrated GPUs and mobile devices.
 *
 * CINEMATIC LUT BYPASS (orbital camera support):
 *   The Geodesic LUT was "photographed" from a fixed frontal camera. It is
 *   only valid while the scroll camera travels its straight-line approach.
 *   During the orbital approach and the singularity sequence the camera
 *   moves to arbitrary angles — and even at close range, peripheral screen
 *   rays still carry impact parameters above the hybrid threshold (b > 3.2),
 *   so the LUT would NOT shut off "organically". We therefore force
 *   uUseLUT = 0 whenever `isOrbitActive || isSingularityActive`, letting the
 *   world-space RK4 integrator own the full frame. The reduced-resolution
 *   FBO keeps this affordable even on integrated GPUs.
 *
 * Shader Quality Uniforms:
 *  - uMaxSteps:   RK4 integration cap (from GPU profile)
 *  - uFbmOctaves: FBM noise octaves for disk turbulence (from GPU profile)
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree, createPortal } from "@react-three/fiber";
import {
  ShaderMaterial,
  DataTexture,
  FloatType,
  RGBAFormat,
  Scene,
  OrthographicCamera,
  WebGLRenderTarget,
  LinearFilter,
  HalfFloatType,
} from "three";
import * as THREE from "three";
import { SHADER, BLACK_HOLE_POSITION, TIMELINE_CUES } from "@/lib/constants";
import { useExperienceStore } from "@/store/useExperienceStore";
import { useGeodesicLUT } from "@/hooks/useGeodesicLUT";
import { GPU_PROFILES } from "@/lib/gpuProfile";

import vertexShader from "@/shaders/blackhole/vertex.glsl";
import fragmentShader from "@/shaders/blackhole/fragment.glsl";

interface BlackHoleProps {
  position?: [number, number, number];
  scale?: number;
  visible?: boolean;
}

// Creates an empty 1x1 fallback texture to satisfy the WebGL program
// before the actual Rust LUT is computed and loaded.
function createDummyTexture(): DataTexture {
  const tex = new DataTexture(
    new Float32Array([0, 0, 0, 0]),
    1, 1,
    RGBAFormat,
    FloatType
  );
  tex.needsUpdate = true;
  return tex;
}

export function BlackHole({
  position = [...BLACK_HOLE_POSITION],
  scale = 12,
  visible = true,
}: BlackHoleProps) {
  const materialRef = useRef<ShaderMaterial>(null!);
  const compositeMaterialRef = useRef<ShaderMaterial>(null!);

  const gravity = useExperienceStore((s) => s.gravity);
  const scrollProgress = useExperienceStore((s: any) => s.scrollProgress);
  const gpuProfile = useExperienceStore((s) => s.gpuProfile);

  const { texture: lutTexture } = useGeodesicLUT();
  const { size, gl } = useThree();

  const dummyTex = useMemo(() => createDummyTexture(), []);

  // True once the Rust LUT texture has been computed and bound.
  // The actual per-frame uUseLUT decision also factors in the
  // cinematic state (see frame loop below).
  const lutReadyRef = useRef(false);
  // Tracks the last applied LUT switch so the transition is logged once.
  const lastLutStateRef = useRef(false);

  // ─── FBO for reduced-resolution raymarch ─────────────────────────────
  const fboRef = useRef<WebGLRenderTarget | null>(null);
  const fboScene = useMemo(() => new Scene(), []);
  const fboCam = useMemo(() => {
    const cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return cam;
  }, []);

  // Resize FBO when viewport or GPU profile changes
  useEffect(() => {
    const profile = GPU_PROFILES[gpuProfile];
    const w = Math.max(1, Math.floor(size.width * profile.bhResScale));
    const h = Math.max(1, Math.floor(size.height * profile.bhResScale));

    if (fboRef.current) {
      fboRef.current.dispose();
    }

    fboRef.current = new WebGLRenderTarget(w, h, {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      format: RGBAFormat,
      type: HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    });

    console.log(`[BlackHole] FBO resized: ${w}x${h} (scale=${profile.bhResScale}, profile=${gpuProfile})`);
  }, [size.width, size.height, gpuProfile]);

  // Initialize shader uniforms
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMass: { value: 0.8 },
      uGravity: { value: 0 },
      uInnerRadius: { value: SHADER.accretionInnerRadius },
      uOuterRadius: { value: SHADER.accretionOuterRadius },
      uFov: { value: 1.3 },
      uScrollProgress: { value: 0 },
      // Black-hole reveal window, derived from the nebula's physical
      // position (TIMELINE_CUES) so the fade-in is always glued to the
      // final third of the nebula instead of a hand-tuned scroll value.
      uRevealStart: { value: TIMELINE_CUES.blackHoleRevealStart },
      uRevealEnd: { value: TIMELINE_CUES.blackHoleRevealEnd },
      uGeodesicLUT: { value: dummyTex },
      uUseLUT: { value: 0.0 },
      uCameraPos: { value: new THREE.Vector3() },
      uCameraRight: { value: new THREE.Vector3() },
      uCameraUp: { value: new THREE.Vector3() },
      uCameraForward: { value: new THREE.Vector3() },
      uAspect: { value: 1.0 },
      uBlackHolePos: { value: new THREE.Vector3(...(position ?? BLACK_HOLE_POSITION)) },
      uMaxSteps: { value: 80 },
      uFbmOctaves: { value: 3 },
    }),
    [dummyTex]
  );

  // Composite pass shader — simple fullscreen texture blit
  const compositeUniforms = useMemo(
    () => ({
      uTexture: { value: null as THREE.Texture | null },
    }),
    []
  );

  const _right = useMemo(() => new THREE.Vector3(), []);
  const _up = useMemo(() => new THREE.Vector3(), []);
  const _forward = useMemo(() => new THREE.Vector3(), []);

  // ─── ATOMIC LUT ACTIVATION ───────────────────────────────────────────
  // Binds the texture and flags readiness. The per-frame loop decides
  // whether the LUT is actually USED, based on the cinematic state.
  useEffect(() => {
    if (!lutTexture || !materialRef.current) return;
    materialRef.current.uniforms.uGeodesicLUT.value = lutTexture;
    lutReadyRef.current = true;
  }, [lutTexture]);

  // ─── FRAME LOOP ──────────────────────────────────────────────────────
  useFrame((state) => {
    if (!materialRef.current || !fboRef.current) return;

    const cam = state.camera as THREE.PerspectiveCamera;

    // Extract world-space camera basis
    cam.matrixWorld.extractBasis(_right, _up, _forward);
    _forward.negate();

    materialRef.current.uniforms.uCameraPos.value.copy(cam.position);
    materialRef.current.uniforms.uCameraRight.value.copy(_right);
    materialRef.current.uniforms.uCameraUp.value.copy(_up);
    materialRef.current.uniforms.uCameraForward.value.copy(_forward);
    materialRef.current.uniforms.uAspect.value = state.size.width / state.size.height;
    materialRef.current.uniforms.uFov.value = THREE.MathUtils.degToRad(cam.fov);

    // ─── PURE RK4 MODE (LUT disabled) ─────────────────────────────────
    // The vacuum-skip optimization made full-screen RK4 affordable even on
    // integrated GPUs, so the hybrid LUT is no longer needed. Disabling it
    // also removes a whole class of bugs: the LUT was baked in Rust against
    // a FIXED frontal camera AND a fixed disk geometry (R=1, disk 3..12),
    // so it broke under the orbital camera and again when the black hole
    // was scaled up (R=2.5, disk 7..20). Pure RK4 renders correct geometry
    // at any size, distance, and angle.
    //
    // To RE-ENABLE the LUT later (Caminho 1): regenerate lib.rs with the
    // current SCHWARZSCHILD_R / DISK_INNER / DISK_OUTER / LUT_B_MAX, then
    // flip USE_LUT back to true here.
    const USE_LUT = false;
    const expState = useExperienceStore.getState();
    const cinematicActive =
      expState.isOrbitActive || expState.isSingularityActive;
    const lutEnabled = USE_LUT && lutReadyRef.current && !cinematicActive;
    materialRef.current.uniforms.uUseLUT.value = lutEnabled ? 1.0 : 0.0;

    if (lutEnabled !== lastLutStateRef.current) {
      lastLutStateRef.current = lutEnabled;
      console.log(
        lutEnabled
          ? "[BlackHole] LUT engaged — hybrid LUT+RK4 mode (frontal camera)"
          : "[BlackHole] Pure RK4 mode (LUT disabled)"
      );
    }

    // Set quality params from GPU profile
    const profile = GPU_PROFILES[gpuProfile];
    materialRef.current.uniforms.uMaxSteps.value = profile.maxSteps;
    materialRef.current.uniforms.uFbmOctaves.value = profile.fbmOctaves;

    // Update continuous time for accretion disk turbulence
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;

    // Sync external store states
    materialRef.current.uniforms.uGravity.value = gravity;
    materialRef.current.uniforms.uScrollProgress.value = scrollProgress;

    // Smoothly interpolate the black hole mass
    const targetMass = 0.3 + gravity * 0.7;
    materialRef.current.uniforms.uMass.value +=
      (targetMass - materialRef.current.uniforms.uMass.value) * 0.05;

    // ─── PASS 1: Raymarch into FBO ────────────────────────────────────
    const prevTarget = gl.getRenderTarget();
    const prevClearAlpha = gl.getClearAlpha();
    const _prevClearColor = new THREE.Color();
    gl.getClearColor(_prevClearColor);

    // Clear FBO with fully transparent black so stars/nebula show through
    gl.setRenderTarget(fboRef.current);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    gl.render(fboScene, fboCam);

    // Restore previous state
    gl.setClearColor(_prevClearColor, prevClearAlpha);
    gl.setRenderTarget(prevTarget);

    // ─── PASS 2: Composite quad reads FBO texture ────────────────────
    if (compositeMaterialRef.current) {
      compositeMaterialRef.current.uniforms.uTexture.value = fboRef.current.texture;
    }
  });

  // Log initialization
  useEffect(() => {
    console.log("[BlackHole] mounted — world space raymarcher initialized");
    console.log("[BlackHole] BH position:", position);
    console.log("[BlackHole] initial scale:", scale);
  }, []);

  useEffect(() => {
    if (!lutTexture) return;
    console.log("[BlackHole] LUT computed — available for frontal phases");
  }, [lutTexture]);

  return (
    <>
      {/* Pass 1: Off-screen raymarch quad (rendered into FBO via portal) */}
      {createPortal(
        <mesh frustumCulled={false}>
          <planeGeometry args={[2, 2]} />
          <shaderMaterial
            ref={materialRef}
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            uniforms={uniforms}
            depthTest={false}
            depthWrite={false}
            transparent={true}
          />
        </mesh>,
        fboScene
      )}

      {/* Pass 2: Composite quad — upscales FBO to native resolution.
          frustumCulled={false} is MANDATORY: the vertex shader pins this
          quad in clip space (always fullscreen), but Three.js CPU culling
          still tests its world-space bounding sphere — a tiny 2x2 plane
          sitting at the origin. The orbital camera frequently leaves the
          origin outside (or behind) its frustum, which culled the mesh
          and made the black hole vanish/flicker mid-orbit. */}
      <mesh renderOrder={10} visible={visible} frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={compositeMaterialRef}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = vec4(position.xy, 0.0, 1.0);
            }
          `}
          fragmentShader={`
            varying vec2 vUv;
            uniform sampler2D uTexture;
            void main() {
              gl_FragColor = texture2D(uTexture, vUv);
            }
          `}
          uniforms={compositeUniforms}
          depthTest={false}
          depthWrite={false}
          transparent={true}
          premultipliedAlpha={true}
          blending={THREE.NormalBlending}
        />
      </mesh>
    </>
  );
}