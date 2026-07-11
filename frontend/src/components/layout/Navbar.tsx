"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <nav className="bg-surface/80 backdrop-filter backdrop-blur-[24px] border-b border-outline-variant/20 shadow-[0_0_15px_rgba(0,218,243,0.1)] flex justify-between items-center w-full px-8 h-16 fixed top-0 z-50 ml-16" style={{ width: "calc(100% - 64px)" }}>
      {/* Brand */}
      <div className="flex items-center gap-4">
        <span className="font-[var(--font-inter)] text-[24px] leading-[32px] tracking-[0.01em] font-semibold tracking-tighter text-primary-fixed-dim">
          Argus Tactical Command
        </span>
      </div>

      {/* Coordinates & Uptime */}
      <div className="hidden md:flex items-center gap-8 font-[var(--font-geist)] text-[13px] leading-[18px] font-medium text-on-surface-variant">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-primary-fixed-dim">my_location</span>
          <span>Coordinates: 34.0522° N, 118.2437° W</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-secondary">memory</span>
          <span>Uptime: 99.9%</span>
        </div>
      </div>

      {/* Trailing Actions */}
      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-sm hover:bg-primary-container/20 hover:text-primary transition-all cursor-pointer active:scale-95 text-on-surface-variant group">
          <span className="material-symbols-outlined group-hover:drop-shadow-[0_0_8px_rgba(0,218,243,0.8)] transition-all">
            notifications_active
          </span>
          <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full status-pip text-error" />
        </button>
        <button className="p-2 rounded-sm hover:bg-primary-container/20 hover:text-primary transition-all cursor-pointer active:scale-95 text-on-surface-variant group">
          <span className="material-symbols-outlined group-hover:drop-shadow-[0_0_8px_rgba(0,218,243,0.8)] transition-all">
            warning
          </span>
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="p-2 rounded-sm hover:bg-primary-container/20 hover:text-primary transition-all cursor-pointer active:scale-95 text-on-surface-variant group"
          >
            <span className="material-symbols-outlined group-hover:drop-shadow-[0_0_8px_rgba(0,218,243,0.8)] transition-all">
              account_circle
            </span>
          </button>
          {showUserMenu && (
            <div className="absolute right-0 top-12 w-56 glass-panel rounded-sm border border-outline-variant/30 p-2 flex flex-col gap-1 shadow-2xl">
              <div className="px-3 py-2 border-b border-outline-variant/20">
                <div className="font-[var(--font-inter)] text-[14px] font-semibold text-on-surface">{user?.name || "Commander"}</div>
                <div className="font-[var(--font-geist)] text-[10px] text-outline">{user?.sector || "Sector-7"} • {user?.role || "admin"}</div>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-3 py-2 text-error hover:bg-error-container/20 rounded-sm transition-colors text-[13px] font-[var(--font-geist)]"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
