"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import ScanlineOverlay from "@/components/layout/ScanlineOverlay";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    const success = await login(email, password);
    setLoading(false);
    if (success) {
      router.push("/dashboard");
    } else {
      setError("Authentication failed.");
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center relative overflow-hidden bg-[#0A0E12]">
      <ScanlineOverlay />
      <div className="absolute inset-0 grid-overlay opacity-30" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-primary-fixed-dim/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md px-4"
      >
        <div className="glass-panel p-8 relative">
          <div className="tech-bracket" />

          {/* Header */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <span className="material-symbols-outlined text-primary-fixed-dim text-[40px] drop-shadow-[0_0_15px_rgba(0,218,243,0.6)]">
              shield
            </span>
            <div className="text-center">
              <h1 className="font-[var(--font-inter)] text-[24px] leading-[32px] tracking-[0.01em] font-semibold text-primary-fixed-dim">
                Access Terminal
              </h1>
              <p className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-outline uppercase mt-1">
                Authentication Required
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <label className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-on-surface-variant uppercase">
                Operator ID
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@argus.command"
                className="w-full bg-transparent border-b border-outline-variant text-on-surface font-[var(--font-geist)] text-[13px] font-medium py-2 px-1 focus:outline-none focus:border-primary-fixed-dim transition-colors placeholder:text-outline/50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-on-surface-variant uppercase">
                Access Code
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent border-b border-outline-variant text-on-surface font-[var(--font-geist)] text-[13px] font-medium py-2 px-1 focus:outline-none focus:border-primary-fixed-dim transition-colors placeholder:text-outline/50"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-error font-[var(--font-geist)] text-[12px]">
                <span className="material-symbols-outlined text-[14px]">error</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 bg-primary-fixed-dim text-[#001f24] font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold uppercase hover:shadow-[0_0_20px_rgba(0,218,243,0.4)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  Authenticating...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">lock_open</span>
                  Authenticate
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <span className="font-[var(--font-geist)] text-[12px] text-outline">
              No credentials?{" "}
              <Link href="/register" className="text-primary-fixed-dim hover:text-primary transition-colors">
                Register
              </Link>
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
