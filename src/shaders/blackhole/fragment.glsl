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
 * Compositing (LUT path only):
 *   The disk is split into FRONT (diskSin > 0, camera-side) and BACK
 *   (diskSin < 0, far-side) layers. The event horizon shadow occludes
 *   ONLY the back layer. The front layer composites ON TOP via alpha-over.
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

uniform sampler2D uGeodesicLUT;
uniform float uUseLUT;

const float SCHWARZSCHILD_R = 1.0;
const float DISK_INNER = 3.0;
const float DISK_OUTER = 12.0;
const int   MAX_STEPS = 80;
const float PI = 3.14159265359;
const float TAU = 6.28318530718;

// Impact parameter range — must match Rust lib.rs exactly.
const float LUT_B_MIN = 0.0;
const float LUT_B_MAX = 18.0;
const float LUT_B_RANGE = 18.0;

// Analytic critical impact parameter for a Schwarzschild black hole.
const float B_CRITICAL = 2.598076; // 3√3 / 2

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

vec3 geodesicAcceleration(vec3 pos, vec3 vel) {
    float r2 = dot(pos, pos);
    float invR = inversesqrt(r2);
    float invR5 = invR * invR * invR * invR * invR;
    vec3 h = cross(pos, vel);
    float h2 = dot(h, h);
    return -1.5 * SCHWARZSCHILD_R * h2 * pos * invR5;
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

    float turbA = fbm(rotA * 0.6, 3);
    float turbB = fbm(rotB * 0.6 + 50.0, 3);
    float turb = mix(turbA, turbB, 0.5);

    float detailA = fbm(rotA * 1.5 - uTime * 0.1, 2);
    float detailB = fbm(rotB * 1.5 + 50.0 - uTime * 0.1, 2);
    float detail = mix(detailA, detailB, 0.5);

    // Gas cloud density from FBM
    float gasClouds = smoothstep(0.1, 0.9, turb * 0.7 + detail * 0.3);
    float pattern = mix(0.3, 1.0, gasClouds);
    float density = radialT * pattern;

    // Gravitational redshift: sqrt(1 - rs/r) ≈ 1 - 0.5 * rs/r
    float physR = max(r, DISK_INNER);
    float rs_r = SCHWARZSCHILD_R / physR;
    float gRedshift = mix(1.0 - 0.5 * rs_r, 1.0, 0.3);

    // Relativistic beaming (Doppler): artistic brake at 0.5
    // prevents the receding side from going pitch black
    float orbitalV = 0.5 * inversesqrt(physR / DISK_INNER);
    float dopplerFactor = 1.0 + cos(angle) * orbitalV;
    float rawBeaming = dopplerFactor * dopplerFactor * dopplerFactor;
    float beaming = mix(rawBeaming, 1.0, 0.5);

    // Blackbody temperature: hotter at inner edge, modulated by turbulence
    float temp = clamp(radialT * pattern * mix(dopplerFactor, 1.0, 0.5), 0.0, 1.0);
    vec3 color = blackbody(temp);

    // Brightness: density × beaming × redshift × SDF edge
    float brightness = clamp(density * beaming * gRedshift * 2.5, 0.0, 1.0);

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

CameraRay setupCamera(vec2 uv) {
    float camDist = 40.0;
    float camHeight = 3.5;
    vec3 camPos = vec3(0.0, camHeight, camDist);
    vec3 fwd = normalize(-camPos);
    vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, fwd);

    vec2 screenUV = (uv - 0.5) * 2.0;
    float fov = tan(uFov * 0.5);
    vec3 rd = normalize(fwd + screenUV.x * fov * right + screenUV.y * fov * up);
    return CameraRay(camPos, rd);
}

// ─── LUT Path ──────────────────────────────────────────────────────────────
// Clean front/back compositing. No ghost suppression masks — the hybrid
// routing in main() ensures this function is never called near B_CRITICAL.

vec4 renderWithLUT(vec2 uv) {
    CameraRay cam = setupCamera(uv);

    float tZ = -cam.pos.z / cam.dir.z;
    vec3 target = cam.pos + cam.dir * tZ;

    float b = length(target.xy);
    float theta = atan(target.y, target.x);
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
    float captureMask = 1.0 - aaStep(B_CRITICAL, b);

    vec3 bgColor = backColor * (1.0 - captureMask);
    float bgAlpha = captureMask + backAlpha * (1.0 - captureMask);

    // Alpha-over composite: front disk ON TOP of (shadow + back disk)
    vec3 accColor = frontColor + bgColor * (1.0 - frontAlpha);
    float accAlpha = frontAlpha + bgAlpha * (1.0 - frontAlpha);

    return vec4(accColor, accAlpha);
}

// ─── RK4 Path ──────────────────────────────────────────────────────────────
// Mathematically flawless ray marching — no LUT interpolation artifacts.
// Used for the core region (b < 3.2) where the LUT is corrupted.

vec4 renderWithRK4(vec2 uv) {
    CameraRay cam = setupCamera(uv);
    vec3 pos = cam.pos;
    vec3 vel = cam.dir;

    vec3 accColor = vec3(0.0);
    float accAlpha = 0.0;
    float baseStep = 0.5;

    for (int i = 0; i < MAX_STEPS; i++) {
        float r = length(pos);
        if (r < SCHWARZSCHILD_R) {
            accAlpha = 1.0;
            break;
        }

        float dt = baseStep * clamp(r * 0.15, 0.08, 1.5);
        float prevY = pos.y;
        stepRK4(pos, vel, dt);
        float currY = pos.y;

        if (prevY * currY < 0.0) {
            float t = abs(prevY) / (abs(prevY) + abs(currY) + 0.0001);
            vec3 hitPos = mix(pos - vel * dt, pos, t);
            float hitR = length(hitPos.xz);
            float angle = atan(hitPos.z, hitPos.x);
            float sdf = min(hitR - DISK_INNER, DISK_OUTER - hitR);

            vec4 diskSample = sampleDiskAtAngle(hitR, angle, sdf);
            if (diskSample.a > 0.001) {
                float redshift = sqrt(max(1.0 - SCHWARZSCHILD_R / hitR, 0.0));
                accColor += diskSample.rgb * redshift * (1.0 - accAlpha);
                accAlpha += diskSample.a * redshift * (1.0 - accAlpha);
            }
        }

        if (accAlpha > 0.95) break;
        float newR = length(pos);
        if (newR > 45.0) break;
        if (newR > 25.0 && length(pos + vel * dt) > newR && accAlpha < 0.01) break;
    }

    return vec4(accColor, accAlpha);
}

// ─── Main ───────────────────────────────────────────────────────────────────
// Hybrid routing: RK4 for the core, LUT for the background disk.
// Smooth blend zone (b ∈ [2.8, 3.2]) prevents visible seams.

void main() {
    CameraRay cam = setupCamera(vUv);
    float tZ = -cam.pos.z / cam.dir.z;
    vec3 target = cam.pos + cam.dir * tZ;
    float b = length(target.xy);

    vec4 result;

    if (uUseLUT > 0.5) {
        // Smooth blend weight: 1.0 for RK4 at b < 2.8, 0.0 for LUT at b > 3.2
        float rk4Weight = 1.0 - smoothstep(2.8, 3.2, b);

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
    // and the inner edge of the accretion disk (b ≈ DISK_INNER = 3.0)
    // with a turbulent, fiery gas corona — the lensed photon ring.
    //
    // Uses the analytic impact parameter 'b' and ray angle 'theta'
    // (both already computed for hybrid routing), NOT screen-space UV.
    // This ensures the corona scales correctly with camera zoom/FOV
    // and remains locked to the 3D black hole at all distances.
    float theta = atan(target.y, target.x);

    // Corona band: from just outside the shadow to the disk inner edge.
    float coronaInner = B_CRITICAL;
    float coronaOuter = B_CRITICAL + 0.6;
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

    float masterOpacity = smoothstep(0.35, 0.50, uScrollProgress);
    float alpha = clamp(accAlpha, 0.0, 1.0) * masterOpacity;

    gl_FragColor = vec4(accColor, alpha);
}