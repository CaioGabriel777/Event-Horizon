/**
 * Schwarzschild Geodesic Lookup Table Generator
 * ==============================================
 * Computes a 256x256 RGBA Float32 texture containing precomputed
 * geodesic data for real-time black hole rendering.
 *
 * For each pixel (u, v):
 *   u → impact parameter b (1.5 to 30.0), quadratic mapping
 *   v → initial angle θ (0 to 2π)
 *
 * The "impact parameter" b here is the screen-space distance at z=0:
 *   ray target = (b·cos(θ), b·sin(θ), 0)
 *   ray origin = camera at (0, 3.5, 40)
 *
 * Output channels:
 *   R = disk hit angle in radians (atan2(hitZ, hitX)), 0 if no hit
 *   G = disk intersection radius (0 if no hit)
 *   B = disk hit flag (1.0 = hit disk, 0.0 = no hit)
 *   A = event horizon flag (1.0 = captured, 0.0 = escaped)
 *
 * Uses RK4 integration with 1500 steps per ray.
 * Compiled to WASM via wasm-pack for client-side execution.
 */

use wasm_bindgen::prelude::*;

const LUT_SIZE: usize = 256;
const SCHWARZSCHILD_R: f64 = 1.0;
const DISK_INNER: f64 = 3.0;  // ISCO
const DISK_OUTER: f64 = 12.0;
const RK4_STEPS: usize = 1500;
const MAX_DISTANCE: f64 = 50.0;

/// Compute the geodesic acceleration for a photon in Schwarzschild spacetime.
/// a = -1.5 * rs * h² * p / r⁵
#[inline]
fn geodesic_acceleration(pos: [f64; 3], vel: [f64; 3]) -> [f64; 3] {
    let r2 = pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2];
    let r = r2.sqrt();
    let r5 = r2 * r2 * r;

    // Angular momentum h = pos × vel
    let hx = pos[1] * vel[2] - pos[2] * vel[1];
    let hy = pos[2] * vel[0] - pos[0] * vel[2];
    let hz = pos[0] * vel[1] - pos[1] * vel[0];
    let h2 = hx * hx + hy * hy + hz * hz;

    let factor = -1.5 * SCHWARZSCHILD_R * h2 / r5;
    [pos[0] * factor, pos[1] * factor, pos[2] * factor]
}

/// RK4 integration step for geodesic equation
#[inline]
fn step_rk4(pos: &mut [f64; 3], vel: &mut [f64; 3], dt: f64) {
    // k1
    let a1 = geodesic_acceleration(*pos, *vel);
    let k1v = [a1[0] * dt, a1[1] * dt, a1[2] * dt];
    let k1p = [vel[0] * dt, vel[1] * dt, vel[2] * dt];

    // k2
    let p2 = [pos[0] + k1p[0] * 0.5, pos[1] + k1p[1] * 0.5, pos[2] + k1p[2] * 0.5];
    let v2 = [vel[0] + k1v[0] * 0.5, vel[1] + k1v[1] * 0.5, vel[2] + k1v[2] * 0.5];
    let a2 = geodesic_acceleration(p2, v2);
    let k2v = [a2[0] * dt, a2[1] * dt, a2[2] * dt];
    let k2p = [v2[0] * dt, v2[1] * dt, v2[2] * dt];

    // k3
    let p3 = [pos[0] + k2p[0] * 0.5, pos[1] + k2p[1] * 0.5, pos[2] + k2p[2] * 0.5];
    let v3 = [vel[0] + k2v[0] * 0.5, vel[1] + k2v[1] * 0.5, vel[2] + k2v[2] * 0.5];
    let a3 = geodesic_acceleration(p3, v3);
    let k3v = [a3[0] * dt, a3[1] * dt, a3[2] * dt];
    let k3p = [v3[0] * dt, v3[1] * dt, v3[2] * dt];

    // k4
    let p4 = [pos[0] + k3p[0], pos[1] + k3p[1], pos[2] + k3p[2]];
    let v4 = [vel[0] + k3v[0], vel[1] + k3v[1], vel[2] + k3v[2]];
    let a4 = geodesic_acceleration(p4, v4);
    let k4v = [a4[0] * dt, a4[1] * dt, a4[2] * dt];
    let k4p = [v4[0] * dt, v4[1] * dt, v4[2] * dt];

    // Weighted average
    for i in 0..3 {
        pos[i] += (k1p[i] + 2.0 * k2p[i] + 2.0 * k3p[i] + k4p[i]) / 6.0;
        vel[i] += (k1v[i] + 2.0 * k2v[i] + 2.0 * k3v[i] + k4v[i]) / 6.0;
    }
}

/// Trace result: (disk_angle, disk_r, hit_disk, captured_by_eh)
struct TraceResult {
    disk_angle: f64,
    disk_r: f64,
    hit_disk: bool,
    captured: bool,
}

/// Trace a single geodesic ray from the camera through curved spacetime.
fn trace_geodesic(impact_param: f64, initial_angle: f64) -> TraceResult {
    // Camera position (must match shader exactly)
    let cam_dist = 40.0_f64;
    let cam_height = 3.5_f64;
    let cam_pos = [0.0, cam_height, cam_dist];

    // Ray target at z=0 plane, parameterized by (b, θ)
    let b = impact_param;
    let target_x = b * initial_angle.cos();
    let target_y = b * initial_angle.sin();

    // Ray direction: from camera toward target point
    let dx = target_x - cam_pos[0];
    let dy = target_y - cam_pos[1];
    let dz = 0.0 - cam_pos[2];
    let len = (dx * dx + dy * dy + dz * dz).sqrt();

    let mut pos = cam_pos;
    let mut vel = [dx / len, dy / len, dz / len];

    let dt = MAX_DISTANCE / RK4_STEPS as f64;

    let mut result = TraceResult {
        disk_angle: 0.0,
        disk_r: 0.0,
        hit_disk: false,
        captured: false,
    };

    for _ in 0..RK4_STEPS {
        let r = (pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2]).sqrt();

        // Event horizon capture
        if r < SCHWARZSCHILD_R {
            result.captured = true;
            break;
        }

        let prev_y = pos[1];
        step_rk4(&mut pos, &mut vel, dt);
        let curr_y = pos[1];

        let new_r = (pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2]).sqrt();

        // Disk crossing detection (y=0 plane)
        if prev_y * curr_y < 0.0 {
            // Interpolate to find exact crossing point
            let t = prev_y.abs() / (prev_y.abs() + curr_y.abs() + 1e-10);
            let prev_x = pos[0] - vel[0] * dt;
            let prev_z = pos[2] - vel[2] * dt;
            let hit_x = prev_x + (pos[0] - prev_x) * t;
            let hit_z = prev_z + (pos[2] - prev_z) * t;
            let hit_r = (hit_x * hit_x + hit_z * hit_z).sqrt();

            if hit_r >= DISK_INNER && hit_r <= DISK_OUTER && !result.hit_disk {
                result.disk_r = hit_r;
                result.disk_angle = hit_z.atan2(hit_x);
                result.hit_disk = true;
            }
        }

        // Escaped to infinity
        if new_r > MAX_DISTANCE {
            break;
        }
    }

    result
}

/// Main entry point: generates the 256×256 RGBA Float32 lookup table.
/// Called once from JavaScript on page load via Web Worker.
///
/// Returns a flat Vec<f32> of size LUT_SIZE * LUT_SIZE * 4.
#[wasm_bindgen]
pub fn compute_geodesic_lut() -> Vec<f32> {
    let mut data = vec![0.0f32; LUT_SIZE * LUT_SIZE * 4];

    for y in 0..LUT_SIZE {
        for x in 0..LUT_SIZE {
            // Map u → impact parameter b
            // Quadratic mapping: more resolution near photon sphere (b ≈ 2.6)
            let u = x as f64 / LUT_SIZE as f64;
            let b = 1.5 + u * u * 28.5; // b ∈ [1.5, 30.0]

            // Map v → initial angle θ (0 to 2π)
            let theta = (y as f64 / LUT_SIZE as f64) * std::f64::consts::TAU;

            let result = trace_geodesic(b, theta);

            let idx = (y * LUT_SIZE + x) * 4;
            data[idx + 0] = result.disk_angle as f32;                       // R: hit angle
            data[idx + 1] = result.disk_r as f32;                           // G: hit radius
            data[idx + 2] = if result.hit_disk { 1.0 } else { 0.0 };       // B: hit flag
            data[idx + 3] = if result.captured { 1.0 } else { 0.0 };       // A: captured
        }
    }

    data
}

/// Returns the LUT dimensions (for the JS side to create the DataTexture)
#[wasm_bindgen]
pub fn lut_size() -> usize {
    LUT_SIZE
}
