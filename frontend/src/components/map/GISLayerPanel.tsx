"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GISLayerKey, GISLayerMeta } from "./useGISLayers";
import { GIS_LAYERS } from "./useGISLayers";

interface GISLayerPanelProps {
  gisEnabled: boolean;
  toggleGIS: () => void;
  layers: Record<GISLayerKey, boolean>;
  toggleLayer: (key: GISLayerKey) => void;
  mapType: "roadmap" | "satellite" | "terrain";
  setMapType: (type: "roadmap" | "satellite" | "terrain") => void;
}

export default function GISLayerPanel({
  gisEnabled,
  toggleGIS,
  layers,
  toggleLayer,
  mapType,
  setMapType,
}: GISLayerPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute bottom-6 left-20 z-20 flex items-end gap-3 font-[var(--font-geist)]">
      {/* Main GIS Toggle Button */}
      <button
        onClick={() => {
          toggleGIS();
          if (!gisEnabled) {
            setIsOpen(true);
          } else {
            setIsOpen(false);
          }
        }}
        className={`w-10 h-10 rounded-sm glass-card flex items-center justify-center text-xs font-bold transition-all duration-200 border active:scale-95 cursor-pointer uppercase select-none ${
          gisEnabled
            ? "bg-primary-fixed-dim/20 border-primary-fixed-dim text-primary-fixed-dim shadow-[0_0_12px_rgba(0,218,243,0.4)]"
            : "bg-surface-container-highest/30 border-outline-variant/30 text-on-surface hover:text-primary-fixed-dim hover:bg-surface-container-highest/50"
        }`}
        title="Toggle GIS Layers Mode"
      >
        GIS
      </button>

      {/* Layer Control Panel */}
      <AnimatePresence>
        {gisEnabled && isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="w-64 glass-panel border border-outline-variant/30 p-4 rounded-sm flex flex-col gap-3.5 shadow-2xl select-none"
          >
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary-fixed-dim">
                  layers
                </span>
                <span className="text-[11px] font-bold text-primary-fixed-dim uppercase tracking-wider">
                  GIS Layer Manager
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-outline hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {/* Overlays / Map Type Switcher */}
            <div className="flex flex-col gap-2">
              <span className="text-[9px] text-outline font-bold uppercase tracking-wider">
                Map View Style
              </span>
              <div className="grid grid-cols-3 gap-1 bg-surface-container-lowest/50 p-1 border border-outline-variant/10 rounded-sm">
                {(["roadmap", "satellite", "terrain"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setMapType(type)}
                    className={`py-1 text-[9px] font-bold uppercase tracking-wider rounded-sm transition-all cursor-pointer ${
                      mapType === type
                        ? "bg-primary-fixed-dim/15 text-primary-fixed-dim border border-primary-fixed-dim/30"
                        : "text-outline hover:text-on-surface border border-transparent"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* GIS Layers Checklist */}
            <div className="flex flex-col gap-2">
              <span className="text-[9px] text-outline font-bold uppercase tracking-wider">
                GIS Visual Layers
              </span>
              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                {GIS_LAYERS.map((layer) => {
                  const isActive = layers[layer.key];
                  return (
                    <div
                      key={layer.key}
                      onClick={() => toggleLayer(layer.key)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-sm border cursor-pointer transition-all duration-150 ${
                        isActive
                          ? "bg-primary-fixed-dim/5 border-primary-fixed-dim/35 text-primary-fixed-dim"
                          : "bg-surface-container-lowest/20 border-outline-variant/15 text-on-surface-variant hover:border-outline-variant/30 hover:text-on-surface"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-[16px] ${isActive ? "text-primary-fixed-dim" : "text-outline"}`}>
                          {layer.icon}
                        </span>
                        <span className="text-[11px] font-medium leading-none">
                          {layer.label}
                        </span>
                      </div>
                      <div
                        className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-all ${
                          isActive
                            ? "border-primary-fixed-dim bg-primary-fixed-dim/20"
                            : "border-outline-variant"
                        }`}
                      >
                        {isActive && (
                          <span className="material-symbols-outlined text-[10px] text-primary-fixed-dim font-bold">
                            check
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mini Toggle Panel Indicator when closed */}
      {gisEnabled && !isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-8 h-8 rounded-sm glass-card flex items-center justify-center text-outline hover:text-primary-fixed-dim hover:bg-surface-container-highest/50 transition-colors border border-outline-variant/30 active:scale-95 cursor-pointer"
          title="Open GIS Control Panel"
        >
          <span className="material-symbols-outlined text-[16px]">tune</span>
        </button>
      )}
    </div>
  );
}
