/**
 * About Page — Scientific Concepts
 * ==================================
 * Explains the physics behind the experience:
 * - General Relativity
 * - Gravitational Lensing
 * - Schwarzschild Radius
 * - Time Dilation
 *
 * Uses DOM components overlaid on a minimal Canvas background.
 */

import Link from "next/link";

export const metadata = {
  title: "About — Event Horizon",
  description:
    "Learn about the physics of black holes, gravitational lensing, and time dilation that power the Event Horizon experience.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#030308] text-[#e8e6e3] px-8 py-16 max-w-3xl mx-auto">
      {/* Navigation back */}
      <Link
        href="/"
        className="text-xs tracking-[0.3em] uppercase text-slate-500 hover:text-slate-300 transition-colors mb-12 block"
        id="about-back-link"
      >
        ← Back to Experience
      </Link>

      <h1 className="text-4xl font-light tracking-[0.1em] mb-2">
        THE PHYSICS
      </h1>
      <p className="text-sm text-slate-500 tracking-wide mb-12">
        The science behind Event Horizon
      </p>

      {/* Gravitational Lensing */}
      <section className="mb-16" id="about-lensing">
        <h2 className="text-lg tracking-[0.15em] text-slate-300 mb-4 uppercase">
          Gravitational Lensing
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-4">
          Massive objects warp the fabric of spacetime, causing light to follow
          curved paths. When light from a distant source passes near a massive
          object like a black hole, it bends around it, creating distorted,
          magnified, or multiple images of the source.
        </p>
        <p className="text-sm text-slate-400 leading-relaxed">
          In this experience, we simulate this effect using a screen-space
          post-processing shader that displaces UV coordinates based on a
          simplified Einstein ring equation.
        </p>
        <div className="mt-4 p-4 border border-slate-800 rounded font-mono text-xs text-slate-500">
          θ = √(4GM/c² × D_LS / D_S × D_L)
        </div>
      </section>

      {/* Schwarzschild Radius */}
      <section className="mb-16" id="about-schwarzschild">
        <h2 className="text-lg tracking-[0.15em] text-slate-300 mb-4 uppercase">
          Schwarzschild Radius
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-4">
          The Schwarzschild radius defines the size of the event horizon — the
          boundary beyond which nothing, not even light, can escape. For a black
          hole with the mass of our Sun, this radius is approximately 3 km.
        </p>
        <div className="mt-4 p-4 border border-slate-800 rounded font-mono text-xs text-slate-500">
          r_s = 2GM/c²
        </div>
      </section>

      {/* Time Dilation */}
      <section className="mb-16" id="about-time-dilation">
        <h2 className="text-lg tracking-[0.15em] text-slate-300 mb-4 uppercase">
          Time Dilation
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Near a black hole, time slows down relative to a distant observer.
          This effect, predicted by Einstein&apos;s General Theory of
          Relativity, means that what feels like minutes near the event horizon
          could be years or centuries for someone far away. In our experience,
          we visualize this by progressively distorting text — stretching,
          warping, and eventually collapsing it into the singularity.
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 pt-8 mt-16">
        <p className="text-xs text-slate-600 tracking-wide">
          Event Horizon — A creative coding experiment
        </p>
      </footer>
    </main>
  );
}
