#![allow(static_mut_refs)]

/**
 * Schwarzschild Geodesic Lookup Table Generator
 * =========================================================================
 * This WASM module computes the exact light paths (geodesics) around a
 * Schwarzschild black hole using 4th-order Runge-Kutta (RK4) integration.
 * The results are baked into a static 2D Lookup Table (LUT) for the shader.
 *
 * LUT Data Structure (RGBA32F converted to RGBA16F in JS):
 *
 *  - R/G Channels: Store (cos(disk_angle), sin(disk_angle)). By storing the 
 *    2D vector instead of the raw angle, bilinear interpolation in the shader 
 *    never crosses the ±π discontinuity, keeping the atan2 reconstruction 
 *    perfectly smooth.
 *
 *  - B Channel: Stores the crossing radius (disk_r) at the equatorial plane.
 *    If the ray didn't hit the plane, this value is 0.
 *
 *  - A Channel: Stores a Signed Distance Field (SDF) relative to the disk edge.
 *       sdf > 0 → ray crossed the plane inside the opaque disk (ISCO..OUTER).
 *       sdf < 0 → ray missed the disk (magnitude = distance).
 *    This allows the shader to use `aaStep(0.0, sdf)` for perfect sub-texel 
 *    anti-aliasing of the accretion disk's outer and inner boundaries.
 *
 * Projection Mapping:
 *  - U Axis: Linear mapping of impact parameter (b) from [0.0, 18.0]. This
 *    covers the entire screen projection, including front-of-disk rays.
 *  - V Axis: Linear mapping of initial camera ray angle (theta) from [0, 2π].
 */

use wasm_bindgen::prelude::*;

const LUT_SIZE: usize = 256;
const SCHWARZSCHILD_R: f64 = 1.0;
const DISK_INNER: f64 = 3.0;
const DISK_OUTER: f64 = 12.0;
const RK4_STEPS: usize = 1500;
const MAX_DISTANCE: f64 = 50.0;

// Impact parameter range — must match fragment.glsl exactly.
// Starting from 0.0 ensures the full screen projection is covered;
// the previous 1.5 cut off the front-of-disk rays causing the cone pinch.
const LUT_B_MIN: f64 = 0.0;
const LUT_B_MAX: f64 = 18.0;
const LUT_B_RANGE: f64 = LUT_B_MAX - LUT_B_MIN; // 18.0

#[inline]
fn geodesic_acceleration(pos: [f64; 3], vel: [f64; 3]) -> [f64; 3] {
    let r2 = pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2];
    let r = r2.sqrt();
    let r5 = r2 * r2 * r;

    let hx = pos[1] * vel[2] - pos[2] * vel[1];
    let hy = pos[2] * vel[0] - pos[0] * vel[2];
    let hz = pos[0] * vel[1] - pos[1] * vel[0];
    let h2 = hx * hx + hy * hy + hz * hz;

    let factor = -1.5 * SCHWARZSCHILD_R * h2 / r5;
    [pos[0] * factor, pos[1] * factor, pos[2] * factor]
}

#[inline]
fn step_rk4(pos: &mut [f64; 3], vel: &mut [f64; 3], dt: f64) {
    let a1 = geodesic_acceleration(*pos, *vel);
    let k1v = [a1[0] * dt, a1[1] * dt, a1[2] * dt];
    let k1p = [vel[0] * dt, vel[1] * dt, vel[2] * dt];

    let p2 = [pos[0] + k1p[0] * 0.5, pos[1] + k1p[1] * 0.5, pos[2] + k1p[2] * 0.5];
    let v2 = [vel[0] + k1v[0] * 0.5, vel[1] + k1v[1] * 0.5, vel[2] + k1v[2] * 0.5];
    let a2 = geodesic_acceleration(p2, v2);
    let k2v = [a2[0] * dt, a2[1] * dt, a2[2] * dt];
    let k2p = [v2[0] * dt, v2[1] * dt, v2[2] * dt];

    let p3 = [pos[0] + k2p[0] * 0.5, pos[1] + k2p[1] * 0.5, pos[2] + k2p[2] * 0.5];
    let v3 = [vel[0] + k2v[0] * 0.5, vel[1] + k2v[1] * 0.5, vel[2] + k2v[2] * 0.5];
    let a3 = geodesic_acceleration(p3, v3);
    let k3v = [a3[0] * dt, a3[1] * dt, a3[2] * dt];
    let k3p = [v3[0] * dt, v3[1] * dt, v3[2] * dt];

    let p4 = [pos[0] + k3p[0], pos[1] + k3p[1], pos[2] + k3p[2]];
    let v4 = [vel[0] + k3v[0], vel[1] + k3v[1], vel[2] + k3v[2]];
    let a4 = geodesic_acceleration(p4, v4);
    let k4v = [a4[0] * dt, a4[1] * dt, a4[2] * dt];
    let k4p = [v4[0] * dt, v4[1] * dt, v4[2] * dt];

    for i in 0..3 {
        pos[i] += (k1p[i] + 2.0 * k2p[i] + 2.0 * k3p[i] + k4p[i]) / 6.0;
        vel[i] += (k1v[i] + 2.0 * k2v[i] + 2.0 * k3v[i] + k4v[i]) / 6.0;
    }
}

/// Continuous trace result. Note: NO MORE binary flags.
/// All fields are smooth quantities that interpolate well.
struct TraceResult {
    /// (cos, sin) of the angle where the ray crossed the disk plane.
    /// Zero vector (0,0) means "didn't cross" — distinguishable because
    /// magnitude is zero, while valid crossings have magnitude 1.
    disk_cos: f64,
    disk_sin: f64,

    /// Crossing radius. If < DISK_INNER or > DISK_OUTER, it's outside the
    /// disk but the value is still useful to reconstruct geometry in the shader.
    /// If the ray didn't cross anything, disk_r = 0.
    disk_r: f64,

    /// Disk SDF: signed distance to the nearest edge.
    /// > 0 inside the ring (magnitude = how deep).
    /// < 0 outside the ring (magnitude = how far).
    /// This is the channel the shader uses for the anti-aliased edge.
    disk_sdf: f64,
}

fn trace_geodesic(impact_param: f64, initial_angle: f64) -> TraceResult {
    let cam_dist = 40.0_f64;
    let cam_height = 3.5_f64;
    let cam_pos = [0.0, cam_height, cam_dist];

    let b = impact_param;
    let target_x = b * initial_angle.cos();
    let target_y = b * initial_angle.sin();

    let dx = target_x - cam_pos[0];
    let dy = target_y - cam_pos[1];
    let dz = 0.0 - cam_pos[2];
    let len = (dx * dx + dy * dy + dz * dz).sqrt();

    let mut pos = cam_pos;
    let mut vel = [dx / len, dy / len, dz / len];

    let dt = MAX_DISTANCE / RK4_STEPS as f64;

    let mut result = TraceResult {
        disk_cos: 0.0,
        disk_sin: 0.0,
        disk_r: 0.0,
        disk_sdf: -1000.0, // default: far outside
    };

    for _ in 0..RK4_STEPS {
        let r = (pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2]).sqrt();
        if r < SCHWARZSCHILD_R {
            break; // Captured; capture is detected in shader via b
        }

        let prev_y = pos[1];
        let prev_x = pos[0];
        let prev_z = pos[2];
        step_rk4(&mut pos, &mut vel, dt);
        let curr_y = pos[1];
        let new_r = (pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2]).sqrt();

        if prev_y * curr_y < 0.0 {
            let t = prev_y.abs() / (prev_y.abs() + curr_y.abs() + 1e-10);
            let hit_x = prev_x + (pos[0] - prev_x) * t;
            let hit_z = prev_z + (pos[2] - prev_z) * t;
            let hit_r = (hit_x * hit_x + hit_z * hit_z).sqrt();

            // SDF: signed distance to the ring boundary.
            // Inside: min(hit_r - INNER, OUTER - hit_r), positive.
            // Outside below: hit_r - INNER, negative.
            // Outside above: OUTER - hit_r, negative.
            let dist_to_inner = hit_r - DISK_INNER;
            let dist_to_outer = DISK_OUTER - hit_r;
            let sdf = dist_to_inner.min(dist_to_outer);

            // Always store the crossing if it's closer to the disk (or deeper inside)
            // This prevents discontinuites and ensures we get the best hit.
            if sdf > result.disk_sdf {
                let inv_r = if hit_r > 1e-6 { 1.0 / hit_r } else { 0.0 };
                result.disk_cos = hit_x * inv_r;
                result.disk_sin = hit_z * inv_r;
                result.disk_r = hit_r;
                result.disk_sdf = sdf;
            }

            // Break early ONLY if we hit the actual opaque disk
            if sdf > 0.0 {
                break;
            }
        }

        if new_r > MAX_DISTANCE {
            break;
        }
    }

    result
}

static mut LUT_DATA: [f32; LUT_SIZE * LUT_SIZE * 4] = [0.0; LUT_SIZE * LUT_SIZE * 4];

// 2. Export a safe way for JS to get the exact memory pointer
#[wasm_bindgen]
pub fn get_lut_ptr() -> usize {
    unsafe { LUT_DATA.as_ptr() as usize }
}

#[wasm_bindgen]
pub fn get_lut_size() -> usize {
    LUT_SIZE
}

// 3. The calculation function that writes directly into our safe buffer
#[wasm_bindgen]
pub fn compute_geodesic_lut_raw() {
    unsafe {
        for y in 0..LUT_SIZE {
            for x in 0..LUT_SIZE {
                let u = (x as f64 + 0.5) / LUT_SIZE as f64;
                let b = LUT_B_MIN + u * LUT_B_RANGE;

                let v = (y as f64 + 0.5) / LUT_SIZE as f64;
                let theta = v * std::f64::consts::TAU;

                let result = trace_geodesic(b, theta);
                let idx = (y * LUT_SIZE + x) * 4;

                LUT_DATA[idx + 0] = result.disk_cos as f32;
                LUT_DATA[idx + 1] = result.disk_sin as f32;
                LUT_DATA[idx + 2] = result.disk_r as f32;
                LUT_DATA[idx + 3] = result.disk_sdf as f32;
            }
        }
    }
}