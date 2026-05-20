/**
 * Navigation — Minimal Scientific Nav
 * ====================================
 * Fixed navigation bar that fades with scroll progress.
 * Clean, minimal design inspired by scientific interfaces.
 */

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useExperienceStore } from "@/store/useExperienceStore";

export function Navigation() {
  const scrollProgress = useExperienceStore((s) => s.scrollProgress);

  // Nav fades out as we scroll deeper into the experience
  const opacity = Math.max(0, 1 - scrollProgress * 3);

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 px-8 py-6 flex items-center justify-between"
      style={{ opacity }}
      initial={{ opacity: 0 }}
      animate={{ opacity }}
      transition={{ duration: 0.3 }}
    >
      {/* Logo */}
      <Link
        href="/"
        className="text-sm tracking-[0.4em] uppercase text-slate-400 hover:text-slate-200 transition-colors duration-500"
        id="nav-logo"
      >
        EH
      </Link>

      {/* Links */}
      <div className="flex gap-8">
        <Link
          href="/about"
          className="text-xs tracking-[0.3em] uppercase text-slate-500 hover:text-slate-300 transition-colors duration-500"
          id="nav-about"
        >
          About
        </Link>
        <Link
          href="/tech"
          className="text-xs tracking-[0.3em] uppercase text-slate-500 hover:text-slate-300 transition-colors duration-500"
          id="nav-tech"
        >
          Tech
        </Link>
      </div>
    </motion.nav>
  );
}
