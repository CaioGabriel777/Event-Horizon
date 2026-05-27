/**
 * useGeodesicLUT — WASM-powered Geodesic Lookup Table
 * ======================================================================
 * This hook manages the asynchronous generation of the Geodesic Lookup Table
 * using a dedicated Web Worker and Rust/WASM to prevent main thread blocking.
 *
 * Architecture & Data Flow:
 *  1. Worker Communication: Spawns the Web Worker, requests the computation,
 *     and receives the computed Float32Array containing the geodesic data.
 *  
 *  2. HalfFloat Conversion: Converts the received 32-bit floats into 16-bit
 *     half-floats (Uint16Array) using Three.js DataUtils.toHalfFloat().
 *     This precision is sufficient for the LUT and ensures maximum compatibility.
 *  
 *  3. Texture Generation: Wraps the converted data into a Three.js DataTexture
 *     using the HalfFloatType format. This is critical because RGBA16F enjoys 
 *     native LinearFilter support across all WebGL 2 contexts without requiring 
 *     any external OES extensions, guaranteeing the texture is always "complete"
 *     and renders smoothly on all devices.
 */

"use client";

import { useState, useEffect } from "react";
import {
  DataTexture,
  DataUtils,
  HalfFloatType,
  RGBAFormat,
  LinearFilter,
  ClampToEdgeWrapping,
} from "three";

interface GeodesicLUTState {
  texture: DataTexture | null;
  loading: boolean;
  error: string | null;
  computeTimeMs: number | null;
}


export function useGeodesicLUT(): GeodesicLUTState {
  const [state, setState] = useState<GeodesicLUTState>({
    texture: null,
    loading: true,
    error: null,
    computeTimeMs: null,
  });

  useEffect(() => {
    let cancelled = false;
    let worker: Worker | null = null;

    try {
      worker = new Worker(
        new URL("../workers/geodesicLUT.worker.ts", import.meta.url)
      );

      worker.onmessage = (e: MessageEvent) => {
        if (cancelled) return;

        if (e.data.type === "result") {
          const { data, lutSize, timeMs } = e.data;

          // ─── Convert Float32 → Uint16 (Half Float) ────────────────
          // The worker outputs a Float32Array (32-bit per channel).
          // RGBA32F requires OES_texture_float_linear for LinearFilter —
          // some drivers reject the texture as "incomplete" without it.
          // RGBA16F (HalfFloat) has native LinearFilter support in WebGL 2
          // with no extensions. Precision loss is negligible for LUT data:
          // half-float covers ±65504 with ~3 decimal digits of mantissa.
          const f32: Float32Array = e.data.data as Float32Array;
          const f16 = new Uint16Array(f32.length);

          // 2. Converte número por número usando o DataUtils
          for (let i = 0; i < f32.length; i++) {
            f16[i] = DataUtils.toHalfFloat(f32[i]);
          }

          // ─── Create texture with final parameters (all set before upload) ───
          const texture = new DataTexture(
            f16,
            lutSize,
            lutSize,
            RGBAFormat,
            HalfFloatType
          );
          texture.minFilter = LinearFilter;
          texture.magFilter = LinearFilter;
          texture.wrapS = ClampToEdgeWrapping;
          texture.wrapT = ClampToEdgeWrapping;
          texture.generateMipmaps = false;
          texture.needsUpdate = true;

          console.log(
            `[GeodesicLUT] LUT ${lutSize}×${lutSize} ready in ${timeMs}ms (RGBA16F, LinearFilter)`
          );

          setState({
            texture,
            loading: false,
            error: null,
            computeTimeMs: timeMs,
          });

          worker?.terminate();
          worker = null;
        }

        if (e.data.type === "error") {
          console.warn("[GeodesicLUT] Worker error:", e.data.message);
          setState({
            texture: null,
            loading: false,
            error: e.data.message,
            computeTimeMs: null,
          });
          worker?.terminate();
          worker = null;
        }
      };

      worker.onerror = (err) => {
        if (cancelled) return;
        console.warn("[GeodesicLUT] Worker failed:", err.message);
        setState({
          texture: null,
          loading: false,
          error: err.message || "Worker failed",
          computeTimeMs: null,
        });
        worker?.terminate();
        worker = null;
      };

      worker.postMessage({ type: "compute" });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to create Worker";
      console.warn("[GeodesicLUT] Cannot create Worker:", errorMsg);
      setState({
        texture: null,
        loading: false,
        error: errorMsg,
        computeTimeMs: null,
      });
    }

    return () => {
      cancelled = true;
      worker?.terminate();
    };
  }, []);

  return state;
}
