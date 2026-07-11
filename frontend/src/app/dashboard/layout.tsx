"use client";

import { useProtectedRoute } from "@/hooks/useAuth";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import ScanlineOverlay from "@/components/layout/ScanlineOverlay";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useProtectedRoute();
  const pathname = usePathname();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0A0E12]">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-primary-fixed-dim text-[48px] animate-pulse">shield</span>
          <div className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] text-outline uppercase">
            Initializing Argus Systems...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <ScanlineOverlay />
      <Sidebar />
      <Navbar />
      <main className="flex-1 ml-16 mt-16 overflow-auto bg-[#0A0E12]">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
