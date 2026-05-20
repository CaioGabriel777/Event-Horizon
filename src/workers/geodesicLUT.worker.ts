/**
 * Geodesic LUT Web Worker
 * =======================
 * Runs the WASM geodesic computation off the main thread so the
 * UI stays responsive during the ~1-17s computation.
 *
 * Communication:
 *   Main → Worker:  { type: 'compute' }
 *   Worker → Main:  { type: 'result', data: Float32Array, lutSize: number, timeMs: number }
 *   Worker → Main:  { type: 'error', message: string }
 */

// Worker context — no DOM access, but we have fetch and WebAssembly

interface WasmExports {
  memory: WebAssembly.Memory;
  compute_geodesic_lut: () => [number, number];
  lut_size: () => number;
  __wbindgen_free: (ptr: number, size: number, align: number) => void;
  __wbindgen_externrefs: WebAssembly.Table;
  __wbindgen_start: () => void;
}

self.onmessage = async function (e: MessageEvent) {
  if (e.data.type !== "compute") return;

  try {
    // Build the import object that the WASM module expects
    let instanceRef: WebAssembly.Instance;

    const imports = {
      "./geodesic_lut_bg.js": {
        __wbindgen_init_externref_table: function () {
          const exports = instanceRef.exports as unknown as WasmExports;
          const table = exports.__wbindgen_externrefs;
          const offset = table.grow(4);
          table.set(0, undefined);
          table.set(offset + 0, undefined);
          table.set(offset + 1, null);
          table.set(offset + 2, true);
          table.set(offset + 3, false);
        },
      },
    };

    // Instantiate WASM via streaming fetch
    const wasmResponse = fetch("/wasm/geodesic_lut_bg.wasm");
    const { instance } = await WebAssembly.instantiateStreaming(
      wasmResponse,
      imports
    );
    instanceRef = instance;

    const exports = instance.exports as unknown as WasmExports;

    // Initialize WASM
    exports.__wbindgen_start();

    // Compute the LUT (this is the heavy part, but we're in a Worker!)
    const t0 = performance.now();
    const result = exports.compute_geodesic_lut();
    const t1 = performance.now();

    const ptr = result[0] >>> 0;
    const len = result[1] >>> 0;

    // Read Float32Array from WASM memory
    const wasmMemory = new Float32Array(exports.memory.buffer);
    const data = wasmMemory.subarray(ptr / 4, ptr / 4 + len).slice();

    // Free WASM memory
    exports.__wbindgen_free(ptr, len * 4, 4);

    const lutSize = exports.lut_size() >>> 0;
    const timeMs = Math.round(t1 - t0);

    // Transfer the array buffer back to main thread (zero-copy)
    self.postMessage(
      { type: "result", data, lutSize, timeMs },
      // @ts-expect-error — transferable objects
      [data.buffer]
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: "error", message });
  }
};
