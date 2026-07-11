"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import ScanlineOverlay from "@/components/layout/ScanlineOverlay";

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, router]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#0A0E12]">
      <ScanlineOverlay />

      {/* Grid Background */}
      <div className="absolute inset-0 grid-overlay opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A0E12]/50 to-[#0A0E12]" />

      {/* Glowing orb effect */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary-fixed-dim/5 rounded-full blur-[150px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center gap-8 text-center px-4"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="w-24 h-24 flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-primary-fixed-dim text-[80px] drop-shadow-[0_0_20px_rgba(0,218,243,0.6)]">
            shield
          </span>
        </motion.div>

        {/* Title */}
        <div className="flex flex-col gap-2">
          <h1 className="font-[var(--font-inter)] text-[48px] leading-[56px] tracking-[-0.02em] font-bold text-primary-fixed-dim text-glow">
            ARGUS
          </h1>
          <p className="font-[var(--font-geist)] text-[12px] leading-[16px] tracking-[0.1em] font-semibold text-on-surface-variant uppercase">
            Tactical Command Center
          </p>
        </div>

        {/* Description */}
        <p className="font-[var(--font-inter)] text-[16px] leading-[24px] text-on-surface-variant max-w-md">
          Advanced tactical command and control system for real-time incident management,
          resource allocation, and AI-driven operations.
        </p>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="flex gap-4 mt-4"
        >
          <Link
            href="/login"
            className="px-8 py-3 bg-primary-fixed-dim text-[#001f24] font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold uppercase hover:shadow-[0_0_20px_rgba(0,218,243,0.4)] transition-all active:scale-95"
          >
            Access Terminal
          </Link>
          <Link
            href="/register"
            className="px-8 py-3 border border-primary-fixed-dim/50 text-primary-fixed-dim font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold uppercase hover:bg-primary-fixed-dim/10 hover:shadow-[0_0_15px_rgba(0,218,243,0.2)] transition-all active:scale-95"
          >
            Register
          </Link>
        </motion.div>

        {/* Status Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="flex items-center gap-6 mt-8 font-[var(--font-geist)] text-[13px] font-medium text-outline"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span>Systems Online</span>
          </div>
          <span className="w-1 h-1 bg-outline-variant rounded-full" />
          <span>Uptime: 99.9%</span>
          <span className="w-1 h-1 bg-outline-variant rounded-full" />
          <span>Sector-7 Active</span>
        </motion.div>
      </motion.div>

      {/* Bottom decorative bracket */}
      <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-primary-fixed-dim/30" />
      <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-primary-fixed-dim/30" />
    </div>
  );
}
