"use client";

import { motion } from "framer-motion";
import resourcesData from "@/data/resources.json";
import incidentsData from "@/data/incidents.json";
import type { ResourceLevel, DeployedAsset, Incident } from "@/types";
import MapView from "@/components/map/MapView";

const inventory = resourcesData.inventory as ResourceLevel[];
const deployedAssets = resourcesData.deployedAssets as DeployedAsset[];
const incidents = incidentsData as Incident[];

const statusColors: Record<string, string> = {
  "en-route": "text-secondary",
  active: "text-secondary",
  depleted: "text-error",
  standby: "text-outline",
  maintenance: "text-outline",
};

const statusDotColors: Record<string, string> = {
  "en-route": "bg-secondary",
  active: "bg-secondary",
  depleted: "bg-error",
  standby: "bg-outline",
  maintenance: "bg-outline",
};

const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

export default function ResourcesPage() {
  return (
    <div className="p-[var(--spacing-gutter)] flex flex-col gap-[var(--spacing-gutter)]">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex justify-between items-end"
      >
        <div>
          <h1 className="font-[var(--font-inter)] text-[28px] leading-[36px] tracking-[-0.01em] font-semibold text-on-surface uppercase">
            Resource Command
          </h1>
          <p className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-outline-variant mt-1 uppercase">
            Global Asset Tracking & Deployment
          </p>
        </div>
        <div className="flex gap-3">
          <button className="h-10 px-6 glass-card hover:bg-surface-container-highest transition-colors border border-outline-variant/30 flex items-center gap-2 font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-on-surface uppercase rounded-sm">
            <span className="material-symbols-outlined text-[18px]">tune</span>
            Filter
          </button>
          <button className="h-10 px-6 bg-primary-fixed-dim/10 border border-primary-fixed-dim text-primary-fixed-dim hover:bg-primary-fixed-dim/20 hover:shadow-[0_0_15px_rgba(0,218,243,0.2)] transition-all flex items-center gap-2 font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold uppercase rounded-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Deploy Asset
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-12 gap-[var(--spacing-gutter)]">
        {/* Inventory Levels */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="col-span-4 glass-panel rounded-sm overflow-hidden relative flex flex-col"
        >
          <div className="glass-card-header px-5 py-3 flex items-center justify-between">
            <h3 className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-on-surface uppercase">
              Inventory Levels
            </h3>
            <span className="material-symbols-outlined text-[18px] text-primary-fixed-dim">bar_chart</span>
          </div>
          <div className="flex-1 p-5 flex flex-col gap-6 justify-center">
            {inventory.map((item) => (
              <motion.div key={item.name} variants={fadeUp}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">{item.icon}</span>
                  <span className="font-[var(--font-inter)] text-[14px] font-semibold text-on-surface flex-1">
                    {item.name}
                  </span>
                  <span
                    className={`font-[var(--font-geist)] text-[13px] font-semibold ${
                      item.isCritical ? "text-error" : "text-primary-fixed-dim"
                    }`}
                  >
                    {item.percentage}%
                  </span>
                </div>
                <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      item.isCritical
                        ? "bg-error shadow-[0_0_6px_rgba(255,180,171,0.6)]"
                        : "bg-primary-fixed-dim shadow-[0_0_6px_rgba(0,218,243,0.6)]"
                    }`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <p
                  className={`font-[var(--font-geist)] text-[10px] mt-1 ${
                    item.isCritical ? "text-error uppercase font-bold" : "text-outline"
                  }`}
                >
                  {item.isCritical ? "CRITICAL: Resupply Required" : `${item.available}/${item.total} Units Available`}
                </p>
              </motion.div>
            ))}
          </div>
          <div className="tech-bracket" />
        </motion.div>

        {/* Global Deployment Map */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="col-span-8 glass-panel rounded-sm overflow-hidden relative min-h-[320px] z-10"
        >
          <MapView incidents={incidents} />
          <div className="absolute top-4 left-4 bg-surface-container-lowest/80 backdrop-filter backdrop-blur-sm px-2.5 py-1.5 border border-outline-variant/50 font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-primary z-20">
            DEPLOYMENT MAP
          </div>
        </motion.div>

        {/* Active Deployment Logs Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="col-span-12 glass-panel rounded-sm overflow-hidden relative"
        >
          <div className="glass-card-header px-5 py-3 flex items-center justify-between">
            <h3 className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-on-surface uppercase">
              Active Deployment Logs
            </h3>
            <span className="material-symbols-outlined text-[16px] text-outline">content_paste</span>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-outline-variant bg-surface-container-lowest border-b border-outline-variant/20">
                <th className="p-4">ASSET ID</th>
                <th className="p-4">TYPE</th>
                <th className="p-4">LOCATION</th>
                <th className="p-4">STATUS</th>
              </tr>
            </thead>
            <tbody className="font-[var(--font-geist)] text-[13px] font-medium text-on-surface">
              {deployedAssets.map((asset) => (
                <tr
                  key={asset.id}
                  className="border-b border-outline-variant/10 hover:bg-surface-container-highest/30 cursor-pointer transition-colors"
                >
                  <td className="p-4 text-primary-fixed-dim">{asset.id}</td>
                  <td className="p-4">{asset.type}</td>
                  <td className="p-4">{asset.location}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 ${statusColors[asset.status] || "text-outline"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDotColors[asset.status] || "bg-outline"}`} />
                      {asset.status.charAt(0).toUpperCase() + asset.status.slice(1).replace("-", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="tech-bracket" />
        </motion.div>
      </div>
    </div>
  );
}
