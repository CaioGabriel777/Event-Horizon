# Event Horizon 🕳️

<p align="center">
  <img src="public/black_hole_v3.png" height="280" alt="Black Hole Event Horizon" />
  <img src="public/nebula_v2.png" height="280" alt="Volumetric Nebula" />
</p>

An immersive, cinematic, physically-based WebGL experience exploring the gravitational anomalies of a black hole.

**Event Horizon** uses real physics (Schwarzschild metric) to simulate the bending of light around a massive gravitational body. By precomputing a massive Geodesic Lookup Table (LUT) using high-precision Runge-Kutta 4th order (RK4) integration via **Rust and WebAssembly (WASM)**, we achieve real-time ray-marching performance in the browser using **WebGL** and **React Three Fiber**.

---

## 🚀 Features
                  
- **Physically-based Rendering**: Light rays are bent according to General Relativity, accurately simulating the gravitational lensing, the photon ring, and the event horizon.
- **Layered FBO Architecture**: In order to achieve a locked 60 FPS on integrated GPUs, the black hole raymarching occurs in an off-screen render target at a fractional resolution. A secondary pass bilinearly composites the accretion disk over the native-resolution background, decoupling raymarch mathematics from screen pixels.
- **Dynamic Spatial Renderer**: Smoothly blends real-time, hardware-optimized RK4 ray-marching at the horizon boundary with ultra-fast LUT lookups for the outer accretion disk.
- **Orbital Cinematic Bypass**: As the user approaches the Event Horizon, the camera leaves its linear rail and begins a 3D orbital spiral around the black hole. The shader organically bypasses the 2D LUT and engages pure RK4 integration across the entire viewport for flawless 360-degree lensing.
- **Volumetric Gas Aesthetic**: Fluffy, dense accretion clouds driven by FBM noise with decoupled physical opacity, ensuring dimmed or redshifted gas correctly occludes stars and background layers without double-alpha darkening.
- **Fiery Inner Corona**: A perspective-correct, `b`-based lensed inner ring of filamentary gas swirling around the event horizon, correctly depth-sorted behind the foreground disk.
- **WASM Geodesic Precomputation**: A high-performance Rust module calculates the ray paths and intersections offline. This heavy computation runs in a **Web Worker**, ensuring the UI remains 100% responsive.
- **Texture-Based Volumetric Nebula**: The introductory cosmic dust cloud utilizes heavily optimized instanced billboarding mapped with a pre-rendered smoke texture and a "Zero-Accumulation" fragment architecture.

---

## 🏗️ Architecture Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **3D Engine**: [Three.js](https://threejs.org/) & [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/)
- **Shaders**: Vanilla GLSL
- **High-Performance Compute**: [Rust](https://www.rust-lang.org/) & [WebAssembly](https://webassembly.org/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)

---

## ⚙️ How it Works

The biggest challenge in rendering a black hole in real-time is solving the geodesic equations for every single pixel on the screen. Doing a 120-step RK4 integration per pixel in a fragment shader destroys GPU performance. 

Our solution is a **Layered Hybrid Pipeline**:

1. **Rust / WASM (Offline/Initialization):**
   - We simulate a grid of photons originating from the camera.
   - We use RK4 integration with 1500 steps to trace their paths through the curved spacetime.
   - We output this data as a raw `256x256 RGBA Float32Array` buffer, which the main thread converts to half-floats (`Uint16Array` / `RGBA16F`) to enable high-performance, native WebGL 2 linear filtering.
2. **Web Worker (Concurrency):**
   - To prevent the browser from freezing during this heavy calculation (~2-5 seconds), the WASM is loaded and executed inside a background Web Worker.
3. **GLSL Fragment Shader (Off-screen Raymarcher):**
   - The shader runs inside an FBO sized dynamically by the detected GPU profile (e.g., 35% resolution for integrated graphics).
   - For the distant background disk (`b > 3.2`), it samples the WASM-generated LUT texture.
   - For the core region (`b < 2.8`), it executes a mathematically flawless, real-time RK4 integration loop.
4. **Cinematic Progression**:
   - The scroll journey dictates the camera's Z-axis position.
   - Upon reaching the **Event Horizon**, `useOrbitCamera` takes control, driving the user in a spiral. The engine bypasses the LUT entirely since the camera is now rendering the black hole up-close and at oblique angles, utilizing pure RK4.

---

## 💻 Getting Started

You can choose to run the project using **Docker** (recommended as it packages all Node, Rust, and WebAssembly dependencies automatically) or perform a **manual local installation**.

### 🐳 Option 1: Running with Docker (Recommended)

This is the easiest way to run the project without needing to install Node.js, Rust, or the WASM build toolchain on your host machine.

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd event-horizon
   ```

2. **Build and start the container:**
   ```bash
   docker compose up -d --build
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### 💻 Option 2: Manual Local Installation

#### Prerequisites

You need [Node.js](https://nodejs.org/) installed, and the [Rust toolchain](https://rustup.rs/) (including `cargo`) with `wasm-pack` installed to compile the geodesic LUT module.

```bash
# Install wasm-pack
cargo install wasm-pack
```

#### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd event-horizon
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Compile the Geodesic LUT WASM module:**
   ```bash
   npm run build:wasm
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

---

## 🎮 Navigation

The experience is driven entirely by scrolling.
1. **Phase 1 (Nebula)**: The vast emptiness of space.
2. **Phase 2 (Revelation)**: The first signs of gravitational lensing.
3. **Phase 3 (Discovery)**: The black hole reveals its accretion disk.
4. **Phase 4 (Approach)**: Time dilates as you approach the ISCO.
5. **Phase 5 (Event Horizon)**: The point of no return. The camera leaves the rail and begins an orbital spiral.
6. **Phase 6 (Singularity)**: You cross the threshold. The screen fades to black, and the universe resets.

---

## 📝 License

This project is open-source and available under the [MIT License](LICENSE). Feel free to use, modify, and distribute it!
