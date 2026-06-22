/**
 * Black Hole — Fragment Shader (Volumetric Gargantua)
 * ====================================================================
 * Renders a physically-based Schwarzschild black hole with a volumetric
 * accretion disk, using a precomputed Geodesic LUT from Rust/WASM.
 *
 * LUT Channel Layout (from lib.rs):
 *   R = cos(disk_angle)   — seam-free angular encoding
 *   G = sin(disk_angle)   — seam-free angular encoding
 *   B = disk_r             — equatorial plane crossing radius
 *   A = disk_sdf           — signed distance to disk annulus boundary
 *
 * Hybrid Rendering Architecture:
 *   The LUT's bilinear interpolation is fundamentally corrupted at the
 *   event horizon boundary (b ≈ B_CRITICAL), where captured-ray texels
 *   (all zeros) blend with escaped-ray texels (valid disk data).
 *   To fix this, main() routes pixels near the horizon (b < 3.2) to
 *   the mathematically flawless RK4 integrator, and uses the fast LUT
 *   for the vast background disk (b >= 3.2). A smooth blend zone
 *   (b ∈ [2.8, 3.2]) prevents visible seams between the two engines.
 *
 * ORBITAL CAMERA SUPPORT:
 *   The camera basis arrives via uniforms from the real Three.js camera
 *   (world space). The impact parameter `b` is computed via TRUE 3D
 *   closest-approach geometry — valid for any camera orientation,
 *   including the cinematic orbit. The host component force-disables
 *   the LUT (uUseLUT = 0) while the orbital/singularity sequences run,
 *   because the 2D LUT was "photographed" from the fixed frontal camera
 *   and is geometrically invalid from any other angle.
 *
 * Compositing (LUT path only):
 *   The disk is split into FRONT (diskSin > 0, camera-side) and BACK
 *   (diskSin < 0, far-side) layers. The event horizon shadow occludes
 *   ONLY the back layer. The front layer composites ON TOP via alpha-over.
 *
 * COMPLETENESS FIX (this revision):
 *   The only change vs. the previous running version is the RK4 escape
 *   criterion (see renderWithRK4). Everything else is byte-identical.
 */

varying vec2 vUv;
varying vec3 vRayDir;

uniform float uTime;
uniform float uMass;
uniform float uGravity;
uniform vec3 uBlackHolePos;
uniform float uInnerRadius;
uniform float uOuterRadius;
uniform float uFov;
uniform float uScrollProgress;
uniform float uRevealStart; // black-hole reveal fade-in start (world-anchored)
uniform float uRevealEnd;   // black-hole reveal fade-in end (world-anchored)

uniform sampler2D uGeodesicLUT;
uniform float uUseLUT;

uniform vec3  uCameraPos;
uniform vec3  uCameraRight;
uniform vec3  uCameraUp;
uniform vec3  uCameraForward;
uniform float uAspect;
uniform int   uMaxSteps;
uniform int   uFbmOctaves;

// Physical scale — the black hole is a TITAN seen from an astronaut's
// vantage. Radius scaled 2.5x from unit so it reads colossal as the
// camera approaches (apparent size also grows with proximity — the
// "imposing on reveal, colossal up close" arc). DISK_INNER must stay
// OUTSIDE the photon-capture shadow (b_capture = 3√3/2 × R ≈ 6.5) so
// the accretion ring never renders inside the event-horizon silhouette.
// Physical scale — the EVENT HORIZON is the star of the show. Radius
// scaled to 3.5 so the shadow sphere dominates the composition, with a
// TIGHTER disk (ends at 22 = 2.4× the shadow radius) so the gas frames
// the sphere as an elegant ring instead of burying it in a vast disk.
// DISK_INNER must stay OUTSIDE the photon-capture shadow
// (b_capture = 3√3/2 × R ≈ 9.1).
const float SCHWARZSCHILD_R = 3.5;
const float DISK_INNER = 10.5;  // ~1.15× shadow — disk hugs the photon ring
const float DISK_OUTER = 30.0;  // ~3.3× shadow — substantial ring, sphere still dominant
const float PI = 3.14159265359;
const float TAU = 6.28318530718;

// Impact parameter range — must match Rust lib.rs exactly.
const float LUT_B_MIN = 0.0;
const float LUT_B_MAX = 18.0;
const float LUT_B_RANGE = 18.0;

// Analytic critical impact parameter for a Schwarzschild black hole.
const float B_CRITICAL = 2.598076; // 3√3 / 2 (dimensionless, × R for world units)

// Photon-capture radius in WORLD units. With SCHWARZSCHILD_R scaled up,
// the apparent shadow, the hybrid routing threshold and the corona band
// must all track this — using the raw B_CRITICAL would size them for a
// unit black hole and leave a gap between the shadow and the disk.
const float B_CAPTURE = B_CRITICAL * SCHWARZSCHILD_R; // ≈ 6.50 at R=2.5

// ─── AA Helpers ─────────────────────────────────────────────────────────────

float aaStep(float edge, float x) {
    float w = max(fwidth(x), 1e-5);
    return smoothstep(edge - w, edge + w, x);
}

// ─── Noise ──────────────────────────────────────────────────────────────────

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i), hash(i + vec2(1, 0)), f.x),
        mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x),
        f.y
    );
}

float fbm(vec2 p, int octaves) {
    float v = 0.0, a = 0.5, f = 1.0;
    for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        v += a * noise(p * f);
        f *= 2.1;
        a *= 0.5;
    }
    return v;
}

/** FBM variant using the GPU-profile-driven octave count */
float fbmAdaptive(vec2 p) {
    return fbm(p, uFbmOctaves);
}

// ─── Blackbody ──────────────────────────────────────────────────────────────
// Pure deep reds at the cold end — no gray or soot tones.

vec3 blackbody(float t) {
    vec3 white = vec3(1.0, 0.98, 0.95);
    vec3 gold  = vec3(1.0, 0.82, 0.45);
    vec3 amber = vec3(0.95, 0.55, 0.15);
    vec3 ember = vec3(0.85, 0.30, 0.05);
    vec3 dark  = vec3(0.40, 0.05, 0.00);

    t = clamp(t, 0.0, 1.0);
    if (t > 0.8) return mix(gold, white, (t - 0.8) / 0.2);
    if (t > 0.5) return mix(amber, gold, (t - 0.5) / 0.3);
    if (t > 0.2) return mix(ember, amber, (t - 0.2) / 0.3);
    return mix(dark, ember, t / 0.2);
}

// ─── Geodesic RK4 ───────────────────────────────────────────────────────────
// Hardware-accelerated inversesqrt replaces expensive sqrt + division.

/**
 * geodesicAcceleration — World Space
 * ====================================
 * Computes gravitational ray deflection relative to uBlackHolePos.
 * pos: ray position in world space
 * vel: ray direction (normalized)
 */
vec3 geodesicAcceleration(vec3 pos, vec3 vel) {
  vec3 r = pos - uBlackHolePos; // vector relative to the black hole
  float r2 = dot(r, r);
  float invR = inversesqrt(r2);
  float invR5 = invR * invR * invR * invR * invR;
  vec3 h = cross(r, vel);
  float h2 = dot(h, h);
  return -1.5 * SCHWARZSCHILD_R * h2 * r * invR5;
}

void stepRK4(inout vec3 pos, inout vec3 vel, float dt) {
    vec3 k1v = geodesicAcceleration(pos, vel) * dt;
    vec3 k1p = vel * dt;
    vec3 p2 = pos + k1p * 0.5;
    vec3 v2 = vel + k1v * 0.5;
    vec3 k2v = geodesicAcceleration(p2, v2) * dt;
    vec3 k2p = v2 * dt;
    vec3 p3 = pos + k2p * 0.5;
    vec3 v3 = vel + k2v * 0.5;
    vec3 k3v = geodesicAcceleration(p3, v3) * dt;
    vec3 k3p = v3 * dt;
    vec3 p4 = pos + k3p;
    vec3 v4 = vel + k3v;
    vec3 k4v = geodesicAcceleration(p4, v4) * dt;
    vec3 k4p = v4 * dt;
    pos += (k1p + 2.0 * k2p + 2.0 * k3p + k4p) / 6.0;
    vel += (k1v + 2.0 * k2v + 2.0 * k3v + k4v) / 6.0;
}

// ─── Sample Disk ────────────────────────────────────────────────────────────
// Volumetric gas aesthetic with decoupled opacity and brightness.
// diskSDF controls the anti-aliased edge (from LUT or analytic in RK4).
// Opacity is driven by gas density, independent of Doppler dimming.

vec4 sampleDiskAtAngle(float r, float angle, float diskSDF) {
    // SDF edge gate — static smoothstep, no fwidth needed
    float sdfMask = smoothstep(-0.02, 0.05, diskSDF);
    if (sdfMask < 0.001) return vec4(0.0);

    // Radial density profile with smooth inner fade
    float fadeInner = smoothstep(0.0, 0.4, r - DISK_INNER);
    float radialT = clamp(1.0 - (r - DISK_INNER) / (DISK_OUTER - DISK_INNER), 0.0, 1.0);
    radialT *= fadeInner;

    // Volumetric gas pattern via dual-offset FBM
    vec2 posA = vec2(cos(angle), sin(angle)) * r;
    vec2 posB = vec2(-sin(angle), cos(angle)) * r;

    float ct = cos(uTime * 0.15);
    float st = sin(uTime * 0.15);
    mat2 rot = mat2(ct, -st, st, ct);
    vec2 rotA = rot * posA;
    vec2 rotB = rot * posB;

    // FBM frequencies are scaled for the disk's world size (spans to r=30),
    // tuned so the gas reads as broad turbulent clouds at this scale.
    float turbA = fbmAdaptive(rotA * 0.24);
    float turbB = fbmAdaptive(rotB * 0.24 + 50.0);
    float turb = mix(turbA, turbB, 0.5);

    float detailA = fbmAdaptive(rotA * 0.6 - uTime * 0.1);
    float detailB = fbmAdaptive(rotB * 0.6 + 50.0 - uTime * 0.1);
    float detail = mix(detailA, detailB, 0.5);

    // Gas cloud density from FBM
    float gasClouds = smoothstep(0.1, 0.9, turb * 0.7 + detail * 0.3);
    float pattern = mix(0.3, 1.0, gasClouds);
    float density = radialT * pattern;

    // ─── Gravitational redshift ──────────────────────────────────────
    // Light climbing out of the gravity well loses energy and reddens.
    // sqrt(1 - rs/r); the inner edge (small r) reddens and dims most.
    // The brake is looser than before (0.15 vs 0.3) so the inner edge
    // shows a deeper red gradient — physically the dominant effect there.
    float physR = max(r, DISK_INNER);
    float rs_r = SCHWARZSCHILD_R / physR;
    float gRedshift = mix(1.0 - 0.5 * rs_r, 1.0, 0.15);

    // ─── Relativistic Doppler beaming ────────────────────────────────
    // The disk gas orbits at relativistic speed. The side rotating TOWARD
    // the camera is beamed brighter and blue-shifted; the receding side
    // dims and red-shifts. cos(angle) is +1 on the approaching side,
    // -1 on the receding side. This asymmetry is THE signature that reads
    // as "real black hole" (Interstellar, the EHT image).
    float orbitalV = 0.5 * inversesqrt(physR / DISK_INNER);
    float dopplerFactor = 1.0 + cos(angle) * orbitalV;
    float rawBeaming = dopplerFactor * dopplerFactor * dopplerFactor;
    // Looser brake (0.75) so the bright/dim asymmetry is clearly visible
    // while still keeping the receding side from going fully black.
    float beaming = mix(rawBeaming, 1.0, 0.25);

    // ─── Blackbody temperature + Doppler color shift ─────────────────
    // Base temperature: hotter at the inner edge, modulated by turbulence.
    float temp = clamp(radialT * pattern * mix(dopplerFactor, 1.0, 0.5), 0.0, 1.0);
    vec3 color = blackbody(temp);

    // Doppler color shift: approaching gas (dopplerFactor > 1) pushes
    // toward blue-white, receding gas (< 1) toward deep red. Kept subtle
    // so it reads as a temperature gradient, not a cartoon blue/red split.
    float dShift = clamp((dopplerFactor - 1.0) * 0.8, -0.5, 0.5);
    vec3 blueTint = vec3(0.75, 0.85, 1.0);
    vec3 redTint  = vec3(1.0, 0.55, 0.30);
    color *= mix(vec3(1.0), blueTint, max(dShift, 0.0));   // approaching
    color *= mix(vec3(1.0), redTint, max(-dShift, 0.0));   // receding

    // Brightness: density × beaming × redshift × SDF edge.
    // Base multiplier lowered to 1.8 (was 2.5) so the Doppler-beamed
    // approaching side has headroom to read as clearly BRIGHTER instead
    // of everything saturating at the same ceiling — preserving the
    // characteristic bright/dim asymmetry across the disk.
    float brightness = clamp(density * beaming * gRedshift * 1.8, 0.0, 1.0);

    // Opacity: decoupled from Doppler — dense gas stays opaque even when
    // dimmed by redshift on the receding side. This ensures the disk
    // properly occludes stars and the back layer behind it.
    float alpha = sdfMask * clamp(pow(density * 3.0, 1.2), 0.0, 1.0);

    return vec4(color * brightness, alpha);
}

// ─── Camera ────────────────────────────────────────────────────────────────

struct CameraRay {
    vec3 pos;
    vec3 dir;
};

/**
 * setupCamera — World Space Ray Construction
 * ===========================================
 * Constructs a ray from the real Three.js camera position and orientation.
 * uv: fragment UV (0..1). Uses uAspect to correct non-square viewports.
 * Returns a CameraRay with pos in world space and normalized dir.
 *
 * NOTE: The old 5° pitch tilt that lived here has been removed. The
 * equivalent viewpoint is now achieved PHYSICALLY by SceneManager
 * raising the camera to CAMERA.baseHeight above the disk plane —
 * the shader is 100% driven by the real camera matrix.
 */
CameraRay setupCamera(vec2 uv) {
  vec2 ndc = (uv - 0.5) * 2.0;
  ndc.x *= uAspect;
  float halfFov = tan(uFov * 0.5);

  vec3 rayDir = normalize(
    uCameraForward +
    uCameraRight   * ndc.x * halfFov +
    uCameraUp      * ndc.y * halfFov
  );

  return CameraRay(uCameraPos, rayDir);
}

/**
 * closestApproach — 3D ray/black-hole geometry (World Space)
 * ============================================================
 * Computes the impact parameter (b) and the perpendicular offset vector
 * at the ray's closest approach to the black hole center.
 * Valid for ANY camera orientation — orbital, polar, equatorial.
 *
 * When the closest approach lies BEHIND the ray origin (tC <= 0, i.e.
 * the black hole is behind the camera for this ray), b falls back to
 * the current camera distance. This prevents false coronas and horizon
 * shadows from appearing in the direction OPPOSITE the black hole
 * during close orbital passes.
 *
 * Replaces the old planar-intersection b (tZ = -Δz / dir.z), which
 * divided by cam.dir.z and exploded when the orbital camera looked
 * perpendicular to the Z axis.
 */
float closestApproach(vec3 rayOrigin, vec3 rayDir, out vec3 perpOut) {
    vec3 oc = rayOrigin - uBlackHolePos;
    float tC = -dot(oc, rayDir);
    perpOut = oc + rayDir * tC;
    return (tC > 0.0) ? length(perpOut) : length(oc);
}

// ─── LUT Path ──────────────────────────────────────────────────────────────
// Clean front/back compositing. No ghost suppression masks — the hybrid
// routing in main() ensures this function is never called near B_CRITICAL.
//
// NOTE: This path intentionally keeps the PLANAR (focal-plane) b/theta
// computation below — the Rust LUT was baked against exactly this
// screen-polar parameterization for the frontal scroll camera. The host
// component guarantees this path never runs with an orbital camera
// (uUseLUT is forced to 0 during cinematic sequences).

vec4 renderWithLUT(vec2 uv) {
    CameraRay cam = setupCamera(uv);

    // Theta: Screen-Polar Angle (LUT-specific parameterization)
    float tZ = -(cam.pos.z - uBlackHolePos.z) / cam.dir.z;
    vec3 target = cam.pos + cam.dir * tZ;
    vec3 relTarget = target - uBlackHolePos;
    float b = length(relTarget.xy);
    float theta = atan(relTarget.y, relTarget.x);
    if (theta < 0.0) theta += TAU;

    float lutU = clamp((b - LUT_B_MIN) / LUT_B_RANGE, 0.0, 1.0);
    float lutV = theta / TAU;

    vec4 g = texture2D(uGeodesicLUT, vec2(lutU, lutV));

    float diskCos = g.r;
    float diskSin = g.g;
    float diskAngle = atan(diskSin, diskCos);
    float diskR   = g.b;
    float diskSDF = g.a;

    // ─── DISK SAMPLING & LAYER SPLIT ────────────────────────────────
    vec4 diskSample = vec4(0.0);
    if (diskR > 0.0) {
        diskSample = sampleDiskAtAngle(diskR, diskAngle, diskSDF);
    }

    // Front/Back depth decomposition based on diskSin (from LUT).
    // diskSin > 0 → ray crossed on the camera side (FRONT of BH)
    // diskSin < 0 → ray crossed on the far side (BACK of BH)
    float frontWeight = smoothstep(-0.15, 0.15, diskSin);

    vec3 frontColor = diskSample.rgb * frontWeight;
    float frontAlpha = diskSample.a * frontWeight;

    vec3 backColor = diskSample.rgb * (1.0 - frontWeight);
    float backAlpha = diskSample.a * (1.0 - frontWeight);

    // ─── EVENT HORIZON (analytic silhouette) ────────────────────────
    // captureMask occludes ONLY the back layer.
    // Front disk composites ON TOP via alpha-over.
    float captureMask = 1.0 - aaStep(B_CAPTURE, b);

    vec3 bgColor = backColor * (1.0 - captureMask);
    float bgAlpha = captureMask + backAlpha * (1.0 - captureMask);

    // Alpha-over composite: front disk ON TOP of (shadow + back disk)
    vec3 accColor = frontColor + bgColor * (1.0 - frontAlpha);
    float accAlpha = frontAlpha + bgAlpha * (1.0 - frontAlpha);

    return vec4(accColor, accAlpha);
}

// ─── Lensed Starfield (procedural, direction-sampled) ───────────────────────
// The background stars are a particle system (THREE.Points) that the
// raymarcher cannot sample. To render gravitational lensing of the sky —
// the Einstein ring and the smeared, doubled star field around the
// shadow — we generate stars PROCEDURALLY from a 3D direction instead.
//
// renderWithRK4 feeds this the ray's FINAL (curved) direction: rays that
// pass close to the black hole exit pointing somewhere else entirely, so
// the same patch of sky appears bent around the silhouette. Far from the
// hole the curvature is negligible and these stars read as an ordinary
// background, blending with the StarField particle system.
//
// Implementation: hash a direction quantized onto a spherical grid. Each
// cell may hold one star at a random offset, with random brightness and a
// faint warm/cool tint — matching the StarField palette.

float starHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

vec3 lensedStars(vec3 dir) {
    dir = normalize(dir);

    // Convert direction to spherical coordinates and tile into a grid.
    float u = atan(dir.z, dir.x);          // -PI..PI
    float v = acos(clamp(dir.y, -1.0, 1.0)); // 0..PI
    const float DENSITY = 110.0;
    vec2 grid = vec2(u, v) * DENSITY;
    vec2 cell = floor(grid);
    vec2 f = fract(grid);

    vec3 col = vec3(0.0);

    // Check this cell and neighbours so stars near borders aren't clipped.
    for (int dx = -1; dx <= 1; dx++) {
        for (int dy = -1; dy <= 1; dy++) {
            vec2 c = cell + vec2(float(dx), float(dy));
            float h = starHash(vec3(c, 1.0));
            // Fraction of cells containing a star. Lowered threshold =
            // denser field, so the lensed region has enough stars to
            // trace a visible ring rather than sparse, easily-missed dots.
            if (h > 0.80) {
                // Random sub-cell position
                vec2 starPos = vec2(
                    starHash(vec3(c, 2.0)),
                    starHash(vec3(c, 3.0))
                );
                float d = length(f - vec2(float(dx), float(dy)) - starPos);
                // Sharp point with soft falloff
                float intensity = smoothstep(0.09, 0.0, d);

                // Brightness and subtle tint variation (matches StarField).
                // Mid-level brightness: visible enough that the lensed
                // ring of stars reads clearly near the shadow, while the
                // open-sky stars still sit behind the StarField particles
                // without competing.
                float bright = (0.45 + starHash(vec3(c, 4.0)) * 0.45);
                float tintRoll = starHash(vec3(c, 5.0));
                vec3 tint = vec3(1.0);
                if (tintRoll > 0.9)      tint = vec3(1.0, 0.89, 0.77); // warm
                else if (tintRoll > 0.8) tint = vec3(0.77, 0.85, 1.0); // cool
                col += tint * intensity * bright;
            }
        }
    }
    return col;
}

// ─── RK4 Path ──────────────────────────────────────────────────────────────
// Mathematically flawless ray marching — no LUT interpolation artifacts.
// Used for the core region (b < 3.2) in hybrid mode, and for the ENTIRE
// frame during the orbital approach and singularity sequences.

vec4 renderWithRK4(vec2 uv) {
  CameraRay cam = setupCamera(uv);
  vec3 pos = cam.pos;
  vec3 vel = cam.dir;

  vec3 accColor = vec3(0.0);
  float accAlpha = 0.0;
  float baseStep = 0.5;

  float camDist = length(cam.pos - uBlackHolePos);

  // ─── VACUUM SKIP (THE COMPLETENESS FIX) ───────────────────────────
  // Far from the black hole, spacetime is effectively flat: light
  // travels in a straight line and there is nothing to integrate. The
  // debug pass proved the failure mode — at 46–70 units away, the ray
  // burned its entire ~120-step budget crossing the empty void and ran
  // out before reaching the curved region, so the shadow sphere and the
  // front disk arc never formed. The hole only looked complete once the
  // camera got close enough (revelation, ~29u) for the budget to reach
  // the center — the false impression that completeness depended on phase.
  //
  // The fix costs ZERO extra steps: analytically jump the ray straight
  // to the edge of the gravity zone (a sphere of radius GRAVITY_ZONE
  // around the black hole), then spend ALL steps inside the region that
  // actually bends light. Works identically at 70u or 7u — the hole is
  // complete from the first frame, at any camera distance, on integrated
  // GPUs, without raising uMaxSteps.
  //
  // The jump only happens when the gravity zone lies AHEAD of the ray
  // (tEnter > 0). Rays pointed away from the black hole are untouched.
  const float GRAVITY_ZONE = 34.0; // covers DISK_OUTER (30) + margin; rays integrate the full disk
  vec3 oc = pos - uBlackHolePos;
  float tCenter = -dot(oc, vel);              // param of closest approach
  if (tCenter > 0.0) {
    float closestDist = length(oc + vel * tCenter);
    if (closestDist < GRAVITY_ZONE) {
      // Distance from closest approach back to the gravity-zone sphere
      float halfChord = sqrt(max(GRAVITY_ZONE * GRAVITY_ZONE -
                                 closestDist * closestDist, 0.0));
      float tEnter = tCenter - halfChord;
      // Advance the ray to the sphere entry (never past the BH itself),
      // staying just outside so the first RK4 step is already curving.
      pos += vel * max(tEnter, 0.0);
    }
  }

  // Escape radius is relative to where the ray now sits — generous
  // enough that a ray which grazes the zone and exits is allowed to,
  // while a captured ray still reaches the horizon first.
  float escapeR = GRAVITY_ZONE + 6.0;

  for (int i = 0; i < 120; i++) {
    if (i >= uMaxSteps) break;

    // Distance to the black hole in world space
    vec3 rVec = pos - uBlackHolePos;
    float r = length(rVec);

    if (r < SCHWARZSCHILD_R) {
      accAlpha = 1.0;
      break;
    }

    // Adaptive step size: larger steps far from disk plane, refined near crossing
    float distToPlane = abs(pos.y - uBlackHolePos.y);
    float planeRefine = clamp(distToPlane * 0.5, 0.3, 1.0);
    float dt = baseStep * clamp(r * 0.15, 0.08, 1.5) * (2.0 - planeRefine);
    float prevY = pos.y - uBlackHolePos.y; // Y relative to the BH
    stepRK4(pos, vel, dt);
    float currY = pos.y - uBlackHolePos.y;

    // Equatorial plane crossing of the black hole
    if (prevY * currY < 0.0) {
      float t = abs(prevY) / (abs(prevY) + abs(currY) + 0.0001);
      vec3 hitPos = mix(pos - vel * dt, pos, t);
      // Position relative to the black hole for disk sampling
      vec3 hitLocal = hitPos - uBlackHolePos;
      float hitR = length(hitLocal.xz); // radius in the disk plane
      float angle = atan(hitLocal.z, hitLocal.x);
      float sdf = min(hitR - DISK_INNER, DISK_OUTER - hitR);

      vec4 diskSample = sampleDiskAtAngle(hitR, angle, sdf);
      if (diskSample.a > 0.001) {
        float redshift = sqrt(max(1.0 - SCHWARZSCHILD_R / max(hitR, SCHWARZSCHILD_R), 0.0));
        accColor += diskSample.rgb * redshift * (1.0 - accAlpha);
        accAlpha += diskSample.a * redshift * (1.0 - accAlpha);
      }
    }

    if (accAlpha > 0.95) break;
    vec3 newRVec = pos - uBlackHolePos;
    float newR = length(newRVec);
    // The ray now starts at the gravity-zone edge (post vacuum-skip), so
    // escape once it has left the zone again. dot(dir, outward) > 0 means
    // it is past closest approach and receding — safe to stop.
    if (newR > escapeR && dot(vel, newRVec) > 0.0) break;
  }

  // ─── Lensed background stars ──────────────────────────────────────
  // Wherever the ray ESCAPED showing empty sky (low accumulated alpha),
  // sample the procedural starfield with the ray's FINAL direction `vel`.
  // The RK4 march has already bent `vel` around the black hole, so stars
  // seen through the strongly-curved region near the silhouette are
  // displaced and ring around it (the Einstein ring) — this happens
  // automatically from the curved direction. Stars only appear in
  // still-dark pixels, so they never paint over the disk or the shadow.
  float skyVisibility = 1.0 - clamp(accAlpha, 0.0, 1.0);
  if (skyVisibility > 0.01) {
    vec3 stars = lensedStars(vel);
    vec3 starContribution = stars * skyVisibility;
    accColor += starContribution;
    float starLum = max(max(starContribution.r, starContribution.g), starContribution.b);
    accAlpha = clamp(accAlpha + starLum, 0.0, 1.0);
  }

  return vec4(accColor, accAlpha);
}

// ─── Main ───────────────────────────────────────────────────────────────────
// Hybrid routing: RK4 for the core, LUT for the background disk.
// Smooth blend zone (b ∈ [2.8, 3.2]) prevents visible seams.
//
// Routing and corona geometry use the TRUE 3D closest-approach impact
// parameter — orientation-independent, so the orbital camera renders
// correct lensing from every angle. With the frontal scroll camera the
// 3D and planar computations are numerically equivalent (zero visual
// regression on the existing phases).

void main() {
    CameraRay cam = setupCamera(vUv);

    // ─── 3D closest-approach geometry ────────────────────────────────
    // b:     impact parameter — minimum ray distance to the BH center.
    // perp:  perpendicular offset vector at closest approach; its XY
    //        components provide a continuous polar angle for the
    //        corona's filamentary texture in any camera orientation.
    vec3 perp;
    float b = closestApproach(cam.pos, cam.dir, perp);
    float theta = atan(perp.y, perp.x);

    vec4 result;

    if (uUseLUT > 0.5) {
        // Route the near-horizon core to RK4 and the background disk to
        // the LUT. The blend band sits just OUTSIDE the world-space
        // photon-capture radius (B_CAPTURE), scaling with the black hole
        // size — a fixed 2.8/3.2 band would land deep inside the shadow
        // now that the horizon is at b ≈ 6.5.
        float blendLo = B_CAPTURE + 0.2;
        float blendHi = B_CAPTURE + 0.6;
        float rk4Weight = 1.0 - smoothstep(blendLo, blendHi, b);

        if (rk4Weight > 0.99) {
            result = renderWithRK4(vUv);
        } else if (rk4Weight < 0.01) {
            result = renderWithLUT(vUv);
        } else {
            // Blend zone: both engines run, mix prevents visible seam
            result = mix(renderWithLUT(vUv), renderWithRK4(vUv), rk4Weight);
        }
    } else {
        result = renderWithRK4(vUv);
    }

    vec3 accColor = result.rgb;
    float accAlpha = result.a;

    // ─── INNER CORONA (perspective-correct, b-based) ────────────────
    // Fills the gap between the event horizon (b = B_CRITICAL ≈ 2.6)
    // and the inner edge of the accretion disk (b ≈ DISK_INNER)
    // with a turbulent, fiery gas corona — the lensed photon ring.
    //
    // Uses the 3D impact parameter 'b' and the closest-approach polar
    // angle 'theta'. Both are world-space and orientation-independent,
    // so the corona stays locked to the black hole at every distance
    // AND every orbital angle. The closestApproach() fallback (b =
    // camera distance when the BH is behind the ray) guarantees no
    // false corona ring ever appears opposite the black hole.

    // Corona band: from just outside the shadow (B_CAPTURE) to the disk
    // inner edge (DISK_INNER). Spanning the real gap keeps the lensed
    // photon ring glued to the shadow at the new physical scale.
    float coronaInner = B_CAPTURE;
    float coronaOuter = DISK_INNER;
    float coronaT = smoothstep(coronaInner, coronaOuter, b);

    // Performance gate: only compute FBM within the corona band
    if (coronaT > 0.001 && coronaT < 0.999) {
        // Turbulent gas texture via FBM in polar (theta, b) coordinates.
        // theta creates the filamentary angular structure,
        // b creates radial depth variation. Both are world-space.
        vec2 coronaPolar = vec2(theta * 3.0, b * 12.0);
        float coronaTurb = fbm(coronaPolar + uTime * 0.3, 3);
        float coronaDetail = fbm(coronaPolar * 2.5 - uTime * 0.2, 2);
        float coronaPattern = coronaTurb * 0.7 + coronaDetail * 0.3;

        // Radial intensity: brightest at the shadow edge, fading outward.
        // pow(1-t, 2) mimics gravitational concentration of photons.
        float radialFade = pow(1.0 - coronaT, 2.0);

        // Temperature gradient: hottest (white-gold) at inner edge,
        // cooling to deep red/orange at the outer boundary.
        float coronaTemp = mix(0.9, 0.15, coronaT) * coronaPattern;
        vec3 coronaColor = blackbody(clamp(coronaTemp, 0.0, 1.0));

        float coronaIntensity = clamp(radialFade * coronaPattern * 1.8, 0.0, 1.0);

        // Depth-correct compositing: corona represents gas lensing
        // BEHIND the black hole. It must NOT render over the foreground
        // disk. The (1 - accAlpha) gate ensures it only fills transparent
        // regions of the scene (empty sky or thin disk edges).
        float coronaGate = (1.0 - accAlpha);
        accColor += coronaColor * coronaIntensity * coronaGate;
        accAlpha = clamp(accAlpha + coronaIntensity * coronaGate * 0.6, 0.0, 1.0);
    }

    // Reveal pacing is WORLD-ANCHORED: uRevealStart/uRevealEnd are derived
    // (in constants.ts) from the nebula's physical position — the fade-in
    // tracks the final third of the nebula no matter where the nebula sits.
    // No hand-tuned scroll numbers here anymore.
    float masterOpacity = smoothstep(uRevealStart, uRevealEnd, uScrollProgress);
    float alpha = clamp(accAlpha, 0.0, 1.0) * masterOpacity;

    gl_FragColor = vec4(accColor, alpha);
}
