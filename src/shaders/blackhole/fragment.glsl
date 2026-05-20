/**
 * Black Hole — Fragment Shader (Hybrid: LUT + RK4 Fallback)
 * ===========================================================
 * Physically-based black hole renderer with TWO render paths:
 *
 * 1. LUT PATH (uUseLUT > 0.5):
 *    Single texture2D() read from precomputed WASM geodesic table.
 *    Maps screen UV → impact parameter b at z=0 plane → LUT lookup.
 *
 * 2. RK4 PATH (fallback):
 *    Full per-pixel Runge-Kutta 4th order integration.
 *
 * Both paths share disk sampling, Doppler beaming, blackbody coloring.
 *
 * Reference: "Gravitational Lensing by Spinning Black Holes"
 * — Oliver James, Kip Thorne (2014)
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

// LUT uniforms
uniform sampler2D uGeodesicLUT;
uniform float uUseLUT;

// ─── Physical Constants ─────────────────────────────────────────────────────

const float SCHWARZSCHILD_R = 1.0;
const float DISK_INNER = 3.0;
const float DISK_OUTER = 12.0;
const int   MAX_STEPS = 80;
const float PI = 3.14159265359;
const float TAU = 6.28318530718;

// LUT mapping constants (must match Rust crate)
const float LUT_B_MIN = 1.5;
const float LUT_B_RANGE = 28.5; // 30.0 - 1.5

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

// ─── Blackbody Radiation ────────────────────────────────────────────────────

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

// ─── Geodesic Acceleration ──────────────────────────────────────────────────

vec3 geodesicAcceleration(vec3 pos, vec3 vel) {
    float r2 = dot(pos, pos);
    float r = sqrt(r2);
    float r5 = r2 * r2 * r;
    vec3 h = cross(pos, vel);
    float h2 = dot(h, h);
    return -1.5 * SCHWARZSCHILD_R * h2 * pos / r5;
}

// ─── RK4 Integration Step ───────────────────────────────────────────────────

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

vec4 sampleDiskAtAngle(float r, float angle) {
    if (r < DISK_INNER || r > DISK_OUTER) return vec4(0.0);

    float radialT = 1.0 - (r - DISK_INNER) / (DISK_OUTER - DISK_INNER);
    radialT = clamp(radialT, 0.0, 1.0);

    int octaves = radialT > 0.5 ? 4 : 2;

    float turb = fbm(vec2(
        angle * 4.0 + uTime * 0.08,
        r * 1.5 - uTime * 0.02
    ), octaves);

    float detail = fbm(vec2(
        angle * 12.0 - uTime * 0.15,
        r * 3.0 + uTime * 0.03
    ), 2);

    float pattern = turb * 0.55 + detail * 0.45;
    pattern = 0.3 + pattern * 0.7;

    float temp = pow(radialT, 0.75) * pattern;

    float orbitalV = 0.5 / sqrt(r / DISK_INNER);
    float doppler = 1.0 + 0.6 * orbitalV * sin(angle + uTime * 0.1);

    temp = clamp(temp * doppler, 0.0, 1.0);
    vec3 color = blackbody(temp);

    float intensity = pow(radialT, 0.6) * pattern;
    intensity *= smoothstep(DISK_INNER, DISK_INNER + 0.3, r);
    intensity *= 1.0 - smoothstep(DISK_OUTER - 1.0, DISK_OUTER, r);
    intensity *= (0.7 + 0.3 * doppler);

    return vec4(color * intensity, clamp(intensity, 0.0, 1.0));
}

vec4 sampleDisk(vec3 hitPos, float r) {
    float angle = atan(hitPos.z, hitPos.x);
    return sampleDiskAtAngle(r, angle);
}

// ─── Camera Setup (shared) ──────────────────────────────────────────────────

struct CameraRay {
    vec3 pos;
    vec3 dir;
};

CameraRay setupCamera(vec2 uv) {
    float camDist = 40.0;
    float camHeight = 3.5;
    vec3 camPos = vec3(0.0, camHeight, camDist);
    vec3 camTarget = vec3(0.0);

    vec3 fwd = normalize(camTarget - camPos);
    vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, fwd);

    vec2 screenUV = (uv - 0.5) * 2.0;
    float fov = tan(uFov * 0.5);
    vec3 rd = normalize(fwd + screenUV.x * fov * right + screenUV.y * fov * up);

    return CameraRay(camPos, rd);
}

// ─── LUT Rendering Path ────────────────────────────────────────────────────

vec4 renderWithLUT(vec2 uv) {
    CameraRay cam = setupCamera(uv);

    // Project ray onto z=0 plane to get (b, theta) matching Rust parameterization
    // The ray goes from camPos toward the BH; find where undeflected ray crosses z=0
    float tZ = -cam.pos.z / cam.dir.z;
    vec3 target = cam.pos + cam.dir * tZ;

    // b = distance from origin to target point in XY plane
    float b = length(target.xy);

    // theta = angle of target point
    float theta = atan(target.y, target.x);
    if (theta < 0.0) theta += TAU;

    // Inverse of Rust's quadratic mapping: u = sqrt((b - B_MIN) / B_RANGE)
    float lutU = sqrt(clamp((b - LUT_B_MIN) / LUT_B_RANGE, 0.0, 1.0));
    float lutV = theta / TAU;

    // LUT channels: R=diskAngle, G=diskR, B=hitDisk, A=captured
    vec4 geodesic = texture2D(uGeodesicLUT, vec2(lutU, lutV));
    float diskAngle = geodesic.r;
    float diskR     = geodesic.g;
    float hitDisk   = geodesic.b;
    float captured  = geodesic.a;

    vec3 accColor = vec3(0.0);
    float accAlpha = 0.0;

    // Event horizon: ray was captured by the black hole
    if (captured > 0.5) {
        accAlpha = 1.0;
        return vec4(vec3(0.0), 1.0);
    }

    // Rays with b < photon sphere radius are also captured
    if (b < 2.6 * SCHWARZSCHILD_R) {
        accAlpha = smoothstep(2.6, 1.5, b);
    }

    // Disk hit: sample the accretion disk at the precomputed position
    if (hitDisk > 0.5 && diskR > 0.0) {
        vec4 diskSample = sampleDiskAtAngle(diskR, diskAngle);

        if (diskSample.a > 0.001) {
            float redshift = sqrt(max(1.0 - SCHWARZSCHILD_R / diskR, 0.0));

            vec3 col = diskSample.rgb * redshift;
            float alp = diskSample.a * redshift;

            accColor += col * (1.0 - accAlpha);
            accAlpha += alp * (1.0 - accAlpha);
        }
    }

    return vec4(accColor, accAlpha);
}

// ─── RK4 Rendering Path (Fallback) ─────────────────────────────────────────

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
            accColor *= 0.0;
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
            float hitR = length(hitPos);

            vec4 diskSample = sampleDisk(hitPos, hitR);
            if (diskSample.a > 0.001) {
                float redshift = sqrt(max(1.0 - SCHWARZSCHILD_R / hitR, 0.0));
                vec3 col = diskSample.rgb * redshift;
                float alp = diskSample.a * redshift;
                accColor += col * (1.0 - accAlpha);
                accAlpha += alp * (1.0 - accAlpha);
            }
        }

        if (accAlpha > 0.95) break;
        float newR = length(pos);
        if (newR > 45.0) break;
        float nextR = length(pos + vel * dt);
        if (newR > 25.0 && nextR > newR && accAlpha < 0.01) break;
    }

    return vec4(accColor, accAlpha);
}

// ─── Main ───────────────────────────────────────────────────────────────────

void main() {
    vec4 result;
    if (uUseLUT > 0.5) {
        result = renderWithLUT(vUv);
    } else {
        result = renderWithRK4(vUv);
    }

    vec3 accColor = result.rgb;
    float accAlpha = result.a;

    // ─── Photon Ring Enhancement ─────────────────────────────────────
    float screenDist = length(vUv - 0.5);
    float photonR = 0.058 * uMass;
    float ring = exp(-pow((screenDist - photonR) * 60.0, 2.0)) * 0.08 * uMass;
    accColor += vec3(1.0, 0.95, 0.85) * ring * (1.0 - accAlpha * 0.7);

    // ─── Event Horizon: True Black Center ──────────────────────────
    // The event horizon MUST be 100% opaque black — no light escapes.
    float ehScreenR = 0.055 * uMass;
    float ehMask = smoothstep(ehScreenR * 1.2, ehScreenR * 0.6, screenDist);
    accColor *= (1.0 - ehMask);  // Zero out color inside EH
    accAlpha = max(accAlpha, ehMask); // Force opaque inside EH

    // ─── Full BH Occlusion Mask ─────────────────────────────────────
    // The entire BH visual area (event horizon + accretion disk +
    // photon ring + lensing zone) must be FULLY OPAQUE so that stars
    // behind it are not visible. The shader itself handles what's
    // visible — lensed deep space is black, accretion disk is colored.
    // Stars should NEVER show through any part of the black hole.
    float bhInfluenceR = 0.18 * uMass;
    float occlusionMask = smoothstep(bhInfluenceR * 1.4, bhInfluenceR * 0.3, screenDist);
    accAlpha = max(accAlpha, occlusionMask);

    // ─── Final Output ───────────────────────────────────────────────
    float alpha = clamp(accAlpha + ring, 0.0, 1.0);

    gl_FragColor = vec4(accColor, alpha);
}
