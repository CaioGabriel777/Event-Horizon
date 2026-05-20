/**
 * useGeodesicLUT — WASM-powered Geodesic Lookup Table
 * ====================================================
 * Loads the Rust/WASM geodesic module in a Web Worker, computes a
 * 256×256 Float32 DataTexture containing precomputed ray paths,
 * and provides it as a Three.js DataTexture for the shader.
 *
 * Architecture:
 * - Main thread: creates Worker, receives result, builds DataTexture
 * - Web Worker: loads WASM, runs compute_geodesic_lut(), transfers data back
 *
 * This keeps the UI fully responsive during the ~1-17s computation.
 * The resulting texture is reused every frame as a shader uniform.
 */

"use client";

import { useState, useEffect } from "react";
import {
  DataTexture,
  FloatType,
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
      // Create the Web Worker
      worker = new Worker(
        new URL("../workers/geodesicLUT.worker.ts", import.meta.url)
      );

      worker.onmessage = (e: MessageEvent) => {
        if (cancelled) return;

        if (e.data.type === "result") {
          const { data, lutSize, timeMs } = e.data;

          // Create Three.js DataTexture from the Worker output
          const texture = new DataTexture(
            data as Float32Array,
            lutSize,
            lutSize,
            RGBAFormat,
            FloatType
          );
          texture.minFilter = LinearFilter;
          texture.magFilter = LinearFilter;
          texture.wrapS = ClampToEdgeWrapping;
          texture.wrapT = ClampToEdgeWrapping;
          texture.needsUpdate = true;

          console.log(
            `[GeodesicLUT] Computed ${lutSize}×${lutSize} LUT in ${timeMs}ms (Web Worker)`
          );

          setState({
            texture,
            loading: false,
            error: null,
            computeTimeMs: timeMs,
          });

          // Worker no longer needed
          worker?.terminate();
          worker = null;
        }

        if (e.data.type === "error") {
          console.warn("[GeodesicLUT] Worker error:", e.data.message);
          console.warn("[GeodesicLUT] Falling back to shader-based RK4");

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
        console.warn("[GeodesicLUT] Falling back to shader-based RK4");

        setState({
          texture: null,
          loading: false,
          error: err.message || "Worker failed",
          computeTimeMs: null,
        });

        worker?.terminate();
        worker = null;
      };

      // Start computation
      worker.postMessage({ type: "compute" });
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to create Worker";
      console.warn("[GeodesicLUT] Cannot create Worker:", errorMsg);
      console.warn("[GeodesicLUT] Falling back to shader-based RK4");

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
