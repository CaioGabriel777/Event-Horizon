/**
 * Black Hole — Fragment Shader v4 (Gargantua Aesthetics)
 * ========================================================
 * Depends on LUT v2 from Rust (lib.rs) which stores:
 *   R = cos(disk_angle)
 *   G = sin(disk_angle)
 *   B = disk_r (disk crossing radius)
 *   A = disk_sdf (signed distance to the disk annulus boundary)
 *
 * All channels are CONTINUOUS — bilinear interpolation works correctly
 * without destroying artificial discontinuities.
 *
 * v4 changes:
 *  - LUT range expanded to [0.0, 18.0] (was [1.5, 15.0]) to eliminate
 *    the front-of-disk cone pinching caused by b < 1.5 edge clamping.
 *  - Proper relativistic beaming: (1 + cos(angle) * v_orbital)^3 formula.
 *  - Gravitational redshift dimming near ISCO.
 *  - Capture silhouette via analytic b vs b_critical (not from LUT).
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

// Linear b mapping — must match Rust lib.rs exactly.
const float LUT_B_MIN = 0.0;
const float LUT_B_MAX = 18.0;
const float LUT_B_RANGE = 18.0;

// Schwarzschild critical impact parameter — analytic horizon boundary.
const float B_CRITICAL = 2.598076; // 3√3/2


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

vec3 blackbody(float t) {
    vec3 white = vec3(1.0, 0.98, 0.95);
    vec3 gold  = vec3(1.0, 0.82, 0.45);
    vec3 amber = vec3(0.95, 0.55, 0.15);
    vec3 ember = vec3(0.6, 0.2, 0.03);
    vec3 dark  = vec3(0.15, 0.03, 0.0);

    t = clamp(t, 0.0, 1.0);
    if (t > 0.8) return mix(gold, white, (t - 0.8) / 0.2);
    if (t > 0.5) return mix(amber, gold, (t - 0.5) / 0.3);
    if (t > 0.2) return mix(ember, amber, (t - 0.2) / 0.3);
    return mix(dark, ember, t / 0.2);
}

// ─── Geodesic RK4 (fallback) ────────────────────────────────────────────────

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
// Receives disk SDF as parameter. From LUT: channel A (bilinear interpolated).
// From RK4: computed analytically. Edge uses aaStep(0, sdf) — pure AA.

vec4 sampleDiskAtAngle(float r, float angle, float diskSDF) {
    // ─── Soften Bottom Edge (Analytic SDF) ───────────────────────────
    // Analytic sub-texel AA via static smoothstep.
    // Removed fwidth() because derivatives break near the singularity 
    // due to extreme gravitational lensing (neighboring pixels jump to infinity).
    float sdfMask = smoothstep(-0.02, 0.05, diskSDF);
    if (sdfMask < 0.001) return vec4(0.0);

    // Smooth inner fade so it disappears before hitting the absolute zero of the SDF
    float fadeInner = smoothstep(0.0, 0.4, r - DISK_INNER);
    float radialT = clamp(1.0 - (r - DISK_INNER) / (DISK_OUTER - DISK_INNER), 0.0, 1.0);
    radialT *= fadeInner;

    // ─── Volumetric plasma pattern (dual-offset cartesian FBM) ───────
    vec2 posA = vec2(cos(angle), sin(angle)) * r;
    vec2 posB = vec2(-sin(angle), cos(angle)) * r;

    // ─── OTIMIZAÇÃO DE PERFORMANCE (TAREFA 1) ────────────────────────
    float ct = cos(uTime * 0.2);
    float st = sin(uTime * 0.2);
    mat2 rot = mat2(ct, -st, st, ct);
    vec2 rotA = rot * posA;
    vec2 rotB = rot * posB;

    // Reduced octaves from 6 to 3 for massive performance gain.
    float turbA = fbm(rotA * 0.7, 3);
    float turbB = fbm(rotB * 0.7 + 50.0, 3);
    float turb = mix(turbA, turbB, 0.5);

    // Reduced detail octaves from 3 to 2
    float detailA = fbm(rotA * 1.8 - uTime * 0.15, 2);
    float detailB = fbm(rotB * 1.8 + 50.0 - uTime * 0.15, 2);
    float detail = mix(detailA, detailB, 0.5);

    float pattern = 0.35 + (turb * 0.5 + detail * 0.2) * 0.65;

    // Fast approximation of redshift sqrt: sqrt(1-x) ≈ 1 - 0.5x
    // Since r >= DISK_INNER (3.0), rs/r is at most 1/3. Approximation works well.
    float rs_r = SCHWARZSCHILD_R / max(r, 1.0);
    float gRedshiftRaw = 1.0 - 0.5 * rs_r;
    float gRedshift = mix(gRedshiftRaw, 1.0, 0.3); // never below ~0.57

    // Relativistic Beaming (Doppler Shift) — Artistically Clamped
    // Using inversesqrt instead of sqrt(/) for speed
    float orbitalV = 0.5 * inversesqrt(max(r, 0.1) / DISK_INNER);
    float dopplerFactor = 1.0 + cos(angle) * orbitalV;
    float rawBeaming = dopplerFactor * dopplerFactor * dopplerFactor; // ^3
    float beaming = mix(rawBeaming, 1.0, 0.35); // artistic brake

    // Temperature drives blackbody color: hotter at inner edge
    // Removed pow(radialT, 0.75) for performance, raw radialT looks great
    float temp = radialT * pattern;
    temp = clamp(temp * mix(rawBeaming, 1.0, 0.5), 0.0, 1.0);
    vec3 color = blackbody(temp);

    // Final intensity: radial falloff × turbulence × SDF edge × beaming × redshift
    float intensity = radialT * pattern;
    intensity *= sdfMask;
    intensity *= beaming;
    intensity *= gRedshift;

    return vec4(color * intensity, clamp(intensity, 0.0, 1.0));
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

vec4 renderWithLUT(vec2 uv) {
    CameraRay cam = setupCamera(uv);

    // Project ray onto z=0 plane to extract (b, θ) — identical to Rust.
    float tZ = -cam.pos.z / cam.dir.z;
    vec3 target = cam.pos + cam.dir * tZ;

    float b = length(target.xy);
    float theta = atan(target.y, target.x);
    if (theta < 0.0) theta += TAU;

    // Linear U mapping (no sqrt) — must match Rust lib.rs.
    float lutU = clamp((b - LUT_B_MIN) / LUT_B_RANGE, 0.0, 1.0);
    float lutV = theta / TAU;

    vec4 g = texture2D(uGeodesicLUT, vec2(lutU, lutV));

    // Reconstruct angle from (cos, sin) — seam-free across ±π.
    // Bilinear interpolated vectors may have magnitude < 1 near real
    // discontinuities, but atan2 still returns a valid angle.
    float diskCos = g.r;
    float diskSin = g.g;
    float diskAngle = atan(diskSin, diskCos);

    float diskR   = g.b;
    float diskSDF = g.a;

    vec3 accColor = vec3(0.0);
    float accAlpha = 0.0;

    // ─── DISK ─────────────────────────────────────────────────────────
    // Edge controlled by LUT SDF, not by binary flag.
    // sampleDiskAtAngle does aaStep(0, sdf) internally and already
    // applies gravitational redshift + relativistic beaming.
    if (diskR > 0.0) {
        vec4 diskSample = sampleDiskAtAngle(diskR, diskAngle, diskSDF);
        if (diskSample.a > 0.001) {
            // Redshift already baked into sampleDiskAtAngle — composite directly.
            accColor += diskSample.rgb * (1.0 - accAlpha);
            accAlpha += diskSample.a * (1.0 - accAlpha);
        }
    }

    // ─── EVENT HORIZON (analytic silhouette with smooth occlusion) ───
    // TAREFA 2: CORREÇÃO DA SILHUETA CINZA (OCCLUSION LEAK)
    // The event horizon emits NO light (adds 0 to accColor), but it is
    // perfectly opaque (blocks all background light). Any light currently
    // in accColor came from the FOREGROUND disk passing in front.
    // By simply pushing accAlpha to 1.0 where b < B_CRITICAL, we completely
    // block the background stars without artificially darkening the 
    // foreground plasma.
    float captureMask = 1.0 - aaStep(B_CRITICAL, b);
    accAlpha = max(accAlpha, captureMask);

    return vec4(accColor, accAlpha);
}

// ─── RK4 Path (fallback) ───────────────────────────────────────────────────
// The fallback computes the SDF analytically from hit_r — no LUT needed.

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

void main() {
    vec4 result = uUseLUT > 0.5 ? renderWithLUT(vUv) : renderWithRK4(vUv);

    vec3 accColor = result.rgb;
    float accAlpha = result.a;

    // Photon ring
    float screenDist = length(vUv - 0.5);
    float photonR = 0.058 * uMass;
    float ring = exp(-pow((screenDist - photonR) * 60.0, 2.0)) * 0.08 * uMass;
    float ringGate = pow(clamp(1.0 - accAlpha, 0.0, 1.0), 2.0);
    accColor += vec3(1.0, 0.95, 0.85) * ring * ringGate;

    float masterOpacity = smoothstep(0.35, 0.50, uScrollProgress);
    float alpha = clamp(accAlpha + ring * ringGate, 0.0, 1.0) * masterOpacity;

    gl_FragColor = vec4(accColor, alpha);
}
