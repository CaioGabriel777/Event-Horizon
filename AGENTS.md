<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Event Horizon 🕳️ - AI Agent Codex & Architecture Guidelines

Welcome, AI Agent! This document outlines the project architecture, directory structure, conventions, build workflows, and constraints of the **Event Horizon** repository to help you deliver highly optimized, correct, and premium code.

---

## 🏗️ Technical Architecture & Hybrid Engine

Event Horizon is an immersive, physically-based WebGL ray-marching simulation of a Schwarzschild black hole. To achieve a locked 60 FPS in the browser with maximum physical fidelity across heterogeneous devices (from dedicated GPUs to integrated graphics), it uses a **Layered Spatial Engine (FBO + WebGL)**:

```mermaid
graph TD
    F[Dynamic Resolution Scaler] --> E[GLSL Fragment Shader - Offscreen Pass]
    E --> I[Pure RK4 Geodesic Integrator]
    I --> G[FBO: Render Target]
    G -- Bilinear Upscale --> L[Screen Composite Quad]
```

### 1. The FBO Performance Layer
Raymarching a black hole at native 1080p+ resolution is computationally impossible for integrated GPUs. The engine decouples the raymarch cost from the display resolution:
- The Black Hole is raymarched into an **off-screen WebGLRenderTarget (FBO)** at a fractional resolution (e.g., `0.35x` for low-end GPUs).
- A secondary full-screen quad samples this FBO using `premultipliedAlpha: true` and bilinear filtering. Because the accretion disk is gaseous, the upscale is visually imperceptible, but the performance gain is exponential (locked 60 FPS on Intel UHD 630).

### 2. GLSL Fragment Shader (Pure RK4 Engine)
- Every pixel fires a ray through curved spacetime using a **Runge-Kutta 4th Order (RK4)** integrator.
- A **vacuum-skip optimization** analytically jumps each ray past empty flat space directly to the gravity zone, spending all integration steps where curvature matters. This makes full-screen RK4 affordable even on integrated GPUs.
- The camera basis arrives via uniforms from the real Three.js camera (world space), enabling correct gravitational lensing from any angle — including the cinematic orbital approach.

### 3. Cinematic Timeline & State Management
- Managed via `useExperienceStore` (Zustand).
- **Phases**: `home` → `awakening` → `traversal` → `revelation` → `discovery` → `approach` → `event-horizon` → `singularity`.
- **Lore Integration (Unit-7 Protocol)**: The store tracks time dilation (`localTimeSec` vs `earthYear`), `dataLink` upload progress, and an `isEpilogue` state which freezes the experience after the singularity.
- `SceneManager.tsx` handles scroll-driven camera interpolation and orchestrates the hand-off to the orbital and singularity cinematics.

---

## 📂 Repository Structure & Key Directories

- `src/app/`: Next.js (App Router) pages, layouts, and global styles.
- `src/components/`: React Three Fiber and UI components.
  - `canvas/objects/BlackHole.tsx`: The core FBO dual-pass setup.
  - `canvas/SceneManager.tsx`: Camera lifecycle ownership.
- `src/shaders/`: GLSL shaders (`raw-loader`).
- `src/hooks/`: Reusable hooks (`useOrbitCamera.ts`, `useScrollPhase.ts`).
- `src/store/`: Zustand global state management.

---

## ⚙️ Environment & Compilation Workflows

We use **Docker & Docker Compose** for streamlined, multi-stage development and production environments.

### 🐳 Docker Configuration (Multi-Stage)
1. `base` (Node): Shared node dependencies installed via `npm ci`.
2. `development` (Node): Dev target with **Hot Reload** enabled.
3. `builder` (Node): Compiles the Next.js production build (`npx next build`).
4. `runner` (Node): Lightweight production image with a secure non-root `nextjs` user.

### 💻 Developer Workflow Command Reference

#### 1. Local Development (Docker-based - Recommended)
```bash
docker compose up -d --build
```
- **Hot Reload Integration**: The project code is synchronized via volume mounting (`.:/app`).

#### 2. Manual Local Development (Bare-metal)
```bash
npm run dev
```

---

## 📜 Coding Conventions & Guidelines for AI Agents

### 1. WebGL & Three.js Resource Management
- **Memory Disposal**: Always dispose of Three.js objects (materials, geometries, textures, and render targets) in `useEffect` cleanup return functions to prevent browser tab crashes and memory leaks.
- **FBO Clears**: When using custom WebGLRenderTargets overlaying background elements, ensure clear color is transparent (`alpha=0`) and compositing materials use `premultipliedAlpha={true}`.

### 2. Next.js & React Rules
- Follow Next.js App Router rules strictly.
- Always use `"use client"` directive for components utilizing React Three Fiber, Framer Motion, hooks, or browser-only APIs.

### 3. Documentation & Open Source Standards
- **JSDoc Formatting**: Always write code documentation, function signatures, and component props using strict **JSDoc format in English**. Maintain all code comments, inline notes, and architectural descriptions exclusively in professional English.
- The project is licensed under the **MIT License** (stored in `LICENSE`).
