<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Event Horizon 🕳️ - AI Agent Codex & Architecture Guidelines

Welcome, AI Agent! This document outlines the project architecture, directory structure, conventions, build workflows, and constraints of the **Event Horizon** repository to help you deliver highly optimized, correct, and premium code.

---

## 🏗️ Technical Architecture & Hybrid Engine

Event Horizon is an immersive, physically-based WebGL ray-marching simulation of a Schwarzschild black hole. To achieve a locked 60 FPS in the browser with maximum physical fidelity, it uses a **Runtime Hybrid Spatial Engine (WASM + WebGL)**:

```mermaid
graph TD
    A[Rust Geodesic Solver] -- wasm-pack --> B[WASM Module]
    B --> C[Web Worker]
    C -- Background Thread --> D[Precomputed Geodesic LUT Texture]
    D --> E[GLSL Fragment Shader]
    F[Camera/Impact Parameter] --> E
    E --> H{Runtime Spatial Router}
    H -- b < 2.8 --> I[High-Precision Real-Time RK4]
    H -- b > 3.2 --> J[Ultra-Fast Bilinear LUT Lookup]
    H -- 2.8 <= b <= 3.2 --> K[Smooth Linear Blend Zone]
    I --> G[Depth-Correct Compositing & Volumetric Gas Rendering]
    J --> G
    K --> G
```

1. **Rust / WASM (Offline / Initialization):**
   - Calculates geodesic paths of photons under General Relativity using high-precision **Runge-Kutta 4th Order (RK4)** integration.
   - Generates a **256x256 RGBA Float32Array Lookup Table (LUT)** containing seam-free trigonometric crossing parameters `(cos(angle), sin(angle), radius, sdf)`.
2. **Web Worker (Concurrency):**
   - Executes the heavy Rust WASM simulation in a background thread to prevent browser UI thread freezes.
3. **GLSL Fragment Shader (Runtime Hybrid Spatial Engine):**
   - **Dynamic Spatial Routing**: Direct bilinear texture lookups near the black hole silhouette (`b ≈ B_CRITICAL`) are corrupted by bilinear interpolation across the horizon's infinite discontinuity. To prevent gray halos, the shader routes pixels inside `b < 2.8` to run a flawless real-time, hardware-optimized RK4 integrator loop. Outer pixels (`b > 3.2`) sample the ultra-fast precomputed LUT. A transition zone (`b ∈ [2.8, 3.2]`) blends both seamlessly.
   - **Volumetric Gas Aesthetics**: The accretion disk utilizes multi-octave FBM polar noise for gas cloud density patterns, with **decoupled physical opacity** (dimmed gas keeps a robust alpha to correctly occlude background stars/disk layers).
   - **Fiery Inner Corona**: A post-process, perspective-correct filamentary gas ring is generated using the analytic impact parameter `b` and lensed ray angle `theta`, blending seamlessly behind the foreground disk via a strict `(1.0 - accAlpha)` depth gate.
   - **Compositing**: Accretion disk elements are split into front/back layers via `diskSin`. The event horizon `captureMask` occludes ONLY the back layer, with the front layer alpha-compositing on top for the iconic "Gargantua" look.
   - **Initial Fallback**: If the WASM LUT has not loaded yet, the entire screen falls back to the real-time RK4 engine.

### 🌌 Volumetric Nebula Engine (Introduction Phase)

- **Texture-Based Instancing**: To maintain a locked 60 FPS while rendering massive cosmic dust, the Nebula phase utilizes instanced billboarding (50 quads) mapped with a pre-rendered smoke texture instead of expensive purely procedural fragment noise.
- **Organic UV Warping**: The fragment shader distorts the static texture coordinates using time and density-based sines/cosines to create organic fluid behavior, seamlessly merging the 50 instances into a single, cohesive gas cloud.
- **Zero-Accumulation Architecture**: To prevent the classic "plastic wall" artifact caused by intense additive blending, the shader sculpts the smoke using a parabolic luminance curve. Thin smoke outputs `vec3(0.0)` (pure black) instead of low-alpha gray, ensuring that accumulating 50 transparent planes does not blow out into a solid white wall.

---

## 📂 Repository Structure & Key Directories

- `rust/geodesic-lut/`: The Rust crate containing the geodesic equations and RK4 solvers.
  - `src/lib.rs`: Entry point containing the WASM bindings (`wasm-bindgen`).
- `public/wasm/`: The compiled WASM module output (produced by `wasm-pack`). Do not edit files here directly.
- `src/app/`: Next.js (App Router) pages, layouts, and global styles.
  - `favicon.ico`: High-quality 48x48 icon cropped from `black_hole_v2.png`.
- `src/components/`: React Three Fiber and UI components.
- `src/shaders/`: GLSL shaders for WebGL ray-marching and post-processing.
- `src/workers/`: Web Worker files responsible for spawning the WASM geodesic solver.

---

## ⚙️ Environment & Compilation Workflows

We use **Docker & Docker Compose** for streamlined, multi-stage development and production environments.

### 🐳 Docker Configuration (Multi-Stage)
The `Dockerfile` is split into several crucial stages to optimize build speed and image size:
1. `wasm-builder` (Rust): Compiles the Rust geodesic solver into WASM.
2. `base` (Node): Shared node dependencies installed via `npm ci`.
3. `development` (Node): Dev target with **Hot Reload** enabled.
4. `builder` (Node): Compiles the Next.js production build (`npx next build`).
5. `runner` (Node): Lightweight production image with a secure non-root `nextjs` user.

### 💻 Developer Workflow Command Reference

#### 1. Local Development (Docker-based - Recommended)
To run the server locally with **Hot Reload (Fast Refresh)**:
```bash
docker compose up -d --build
```
- **Hot Reload Integration**: The project code is synchronized via volume mounting (`.:/app`).
- **File System Watching**: Enabled via `WATCHPACK_POLLING=true` in `docker-compose.yml` to guarantee immediate updates on Windows (WSL) and macOS hosts.
- Anonymous volumes protect `/app/node_modules`, `/app/.next`, and `/app/rust/geodesic-lut/target` from clashing with host-compiled folders.

#### 2. Manual Local Development (Bare-metal)
If running without Docker, the Rust toolchain with `wasm-pack` is required:
```bash
# Build WASM
npm run build:wasm
# Start dev server
npm run dev
```

---

## 📜 Coding Conventions & Guidelines for AI Agents

### 1. WebGL & Three.js Resource Management
- **Memory Disposal**: Always dispose of Three.js objects (materials, geometries, textures, and render targets) in `useEffect` cleanup return functions to prevent browser tab crashes and memory leaks:
  ```javascript
  return () => {
    material.dispose();
    geometry.dispose();
    texture.dispose();
  };
  ```
- **GLSL Shaders**: Handle GLSL shaders in React Three Fiber by referencing custom shaders in `/src/shaders/`. Note that `next.config.ts` uses raw-loader for `.glsl`, `.vert`, and `.frag` extensions.

### 2. Next.js & React Rules
- Follow Next.js App Router rules strictly.
- Always use `"use client"` directive for components utilizing React Three Fiber, Framer Motion, hooks, or browser-only APIs.
- Keep components small, modular, and focused.

### 3. Open Source Standards
- The project is licensed under the **MIT License** (stored in `LICENSE`). Respect all attribution requirements.
- Maintain all code comments, docstrings, and architectural descriptions in **professional English**.
- Do not check in build artifacts (such as local `.next/`, `node_modules/`, `rust/**/target/`, or local environments) into Git. Ensure they match `.dockerignore` and `.gitignore`.
