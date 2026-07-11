"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import type { NavItem } from "@/types";

const mainNavItems: NavItem[] = [
  { label: "Overview", icon: "grid_view", href: "/dashboard" },
  { label: "Incidents", icon: "emergency", href: "/dashboard/incidents" },
  { label: "Agents", icon: "groups", href: "/dashboard/agents" },
  { label: "Communications", icon: "cell_tower", href: "/dashboard/communications" },
  { label: "Compliance", icon: "gavel", href: "/dashboard/compliance" },
];

const footerNavItems: NavItem[] = [
  { label: "Settings", icon: "settings", href: "/dashboard/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed left-0 top-0 h-full flex flex-col z-[60] bg-surface-container-lowest/90 backdrop-filter backdrop-blur-[40px] font-[var(--font-geist)] text-[12px] leading-[16px] tracking-[0.1em] font-semibold w-16 hover:w-60 transition-all duration-300 border-r border-outline-variant/30 shadow-2xl group overflow-hidden">
      {/* Logo Header */}
      <div className="h-16 flex items-center justify-center border-b border-outline-variant/20 px-4 shrink-0 overflow-hidden">
        <span className="material-symbols-outlined text-primary-fixed-dim text-[28px] shrink-0 drop-shadow-[0_0_8px_rgba(0,218,243,0.8)]">
          shield
        </span>
        <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap flex flex-col">
          <span className="font-[var(--font-inter)] text-[18px] leading-[24px] tracking-[0.02em] font-semibold text-primary">
            Argus Prime
          </span>
          <span className="text-on-surface-variant text-[10px]">
            Sector-7 Control
          </span>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
        {mainNavItems.map((item) => {
          const active = isActive(item.href);
          return (
            <div key={item.href} className="flex flex-col w-full">
              <Link
                href={item.href}
                className={`w-full flex items-center px-4 py-3 transition-all duration-200 group-hover:translate-x-1 ${
                  active
                    ? "bg-secondary-container/20 text-secondary border-l-4 border-secondary relative overflow-hidden"
                    : "text-outline hover:text-on-surface hover:bg-surface-container-highest/40 border-l-4 border-transparent"
                }`}
              >
                {active && (
                  <div className="absolute inset-0 bg-gradient-to-r from-secondary-container/10 to-transparent pointer-events-none" />
                )}
                <span
                  className={`material-symbols-outlined text-[20px] shrink-0 ${
                    active ? "drop-shadow-[0_0_5px_rgba(68,221,193,0.5)]" : ""
                  }`}
                  style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                <span className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap tracking-widest uppercase">
                  {item.label}
                </span>
              </Link>
              {item.label === "Incidents" && (
                <div className="pl-12 py-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Link
                    href="/dashboard/incidents/validator"
                    className={`flex items-center gap-2 py-1.5 px-2 rounded-sm text-[11px] transition-all ${
                      pathname === "/dashboard/incidents/validator"
                        ? "text-primary font-bold bg-primary/10 border-l-2 border-primary"
                        : "text-outline hover:text-on-surface"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">fact_check</span>
                    <span className="uppercase tracking-widest">Validator</span>
                  </Link>
                  <Link
                    href="/dashboard/resources"
                    className={`flex items-center gap-2 py-1.5 px-2 rounded-sm text-[11px] transition-all ${
                      pathname === "/dashboard/resources"
                        ? "text-primary font-bold bg-primary/10 border-l-2 border-primary"
                        : "text-outline hover:text-on-surface"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">inventory_2</span>
                    <span className="uppercase tracking-widest">Resources</span>
                  </Link>
                  <Link
                    href="/dashboard/reports"
                    className={`flex items-center gap-2 py-1.5 px-2 rounded-sm text-[11px] transition-all ${
                      pathname === "/dashboard/reports"
                        ? "text-primary font-bold bg-primary/10 border-l-2 border-primary"
                        : "text-outline hover:text-on-surface"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">description</span>
                    <span className="uppercase tracking-widest">Reports</span>
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Navigation */}
      <div className="py-4 border-t border-outline-variant/20 flex flex-col gap-1 shrink-0">
        {footerNavItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`w-full flex items-center px-4 py-3 transition-all duration-200 group-hover:translate-x-1 ${
                active
                  ? "bg-secondary-container/20 text-secondary border-l-4 border-secondary"
                  : "text-outline hover:text-on-surface hover:bg-surface-container-highest/40 border-l-4 border-transparent"
              }`}
            >
              <span className="material-symbols-outlined text-[20px] shrink-0">
                {item.icon}
              </span>
              <span className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap tracking-widest uppercase">
                {item.label}
              </span>
            </Link>
          );
        })}
        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center px-4 py-3 text-outline hover:text-error hover:bg-error-container/20 transition-all group-hover:translate-x-1 border-l-4 border-transparent"
        >
          <span className="material-symbols-outlined text-[20px] shrink-0">logout</span>
          <span className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap tracking-widest uppercase">
            Logout
          </span>
        </button>
      </div>
    </aside>
  );
}
