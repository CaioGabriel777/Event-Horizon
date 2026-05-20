/**
 * Gravity Text — Vertex Shader
 * ============================
 * THE SIGNATURE EFFECT of the Event Horizon experience.
 *
 * This shader deforms text geometry to simulate gravitational pull
 * from a supermassive black hole. The distortion is progressive:
 *
 * uGravity 0.0 → 0.2:  Subtle tremor (noise perturbation)
 * uGravity 0.2 → 0.5:  Vertical stretching (spaghettification begins)
 * uGravity 0.5 → 0.8:  Directional pull toward black hole position
 * uGravity 0.8 → 1.0:  Total collapse (all vertices converge)
 *
 * Works with Drei <Text> / troika-three-text MSDF rendering.
 * The vertex displacement preserves the SDF distance field
 * quality at low-to-mid gravity, only breaking it intentionally
 * at high gravity for the "glitch/decay" aesthetic.
 */

uniform float uGravity;
uniform float uTime;
uniform vec3 uBlackHolePos;
uniform float uNoiseScale;
uniform float uStretchFactor;

varying vec2 vUv;
varying float vGravity;
varying float vDistortion;

// ─── Simplex-like noise (optimized for vertex shader) ───────────────────────

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
    const vec4 C = vec4(
        0.211324865405187,   // (3.0-sqrt(3.0))/6.0
        0.366025403784439,   // 0.5*(sqrt(3.0)-1.0)
        -0.577350269189626,  // -1.0 + 2.0 * C.x
        0.024390243902439    // 1.0 / 41.0
    );

    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;

    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;

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

void main() {
    vUv = uv;
    vGravity = uGravity;

    vec3 pos = position;

    // ─── Phase 1: Subtle Tremor (0.0 → 0.2) ──────────────────────────
    float tremor = smoothstep(0.0, 0.2, uGravity);
    float noiseX = snoise(vec2(pos.x * uNoiseScale + uTime * 2.0, pos.y * uNoiseScale)) * tremor * 0.02;
    float noiseY = snoise(vec2(pos.y * uNoiseScale + uTime * 1.5, pos.x * uNoiseScale + 100.0)) * tremor * 0.015;
    pos.x += noiseX;
    pos.y += noiseY;

    // ─── Phase 2: Vertical Stretching / Spaghettification (0.2 → 0.5) ─
    float stretch = smoothstep(0.2, 0.5, uGravity);

    // Non-uniform Y stretch: vertices further from center stretch MORE
    // This creates the characteristic "spaghettification" effect
    float yOffset = pos.y; // Distance from text baseline
    float stretchAmount = yOffset * stretch * uStretchFactor;
    pos.y += stretchAmount;

    // Slight X compression (tidal forces squeeze horizontally)
    pos.x *= 1.0 - stretch * 0.15;

    // ─── Phase 3: Directional Pull toward Black Hole (0.5 → 0.8) ─────
    float pull = smoothstep(0.5, 0.8, uGravity);

    // Vector from vertex to black hole in model space
    vec3 toBH = uBlackHolePos - pos;
    float distToBH = length(toBH);
    vec3 pullDir = normalize(toBH);

    // Inverse-square falloff: closer vertices get pulled harder
    float pullStrength = pull * 0.5 / (distToBH * 0.1 + 1.0);
    pos += pullDir * pullStrength;

    // Add more aggressive noise at this stage
    float pullNoise = snoise(vec2(pos.x * 5.0 + uTime * 3.0, pos.y * 5.0)) * pull * 0.08;
    pos.x += pullNoise;
    pos.y += snoise(vec2(pos.y * 8.0 + uTime * 4.0, pos.x * 3.0)) * pull * 0.06;

    // ─── Phase 4: Total Collapse (0.8 → 1.0) ─────────────────────────
    float collapse = smoothstep(0.8, 1.0, uGravity);

    // All vertices converge toward the black hole position
    pos = mix(pos, uBlackHolePos, collapse * collapse); // Quadratic ease for dramatic feel

    // Final violent shake
    pos.x += snoise(vec2(uTime * 10.0, pos.y * 20.0)) * collapse * 0.1;
    pos.y += snoise(vec2(uTime * 12.0, pos.x * 20.0)) * collapse * 0.1;

    // ─── Output ───────────────────────────────────────────────────────
    vDistortion = tremor + stretch + pull + collapse;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
