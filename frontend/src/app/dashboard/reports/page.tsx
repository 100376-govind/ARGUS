"use client";

import { motion } from "framer-motion";
import reportsData from "@/data/reports.json";
import type { Report } from "@/types";

const reports = reportsData as Report[];

const reportStatusStyles: Record<string, { bg: string; text: string }> = {
  submitted: { bg: "bg-primary-fixed-dim/20", text: "text-primary-fixed-dim" },
  reviewed: { bg: "bg-secondary/20", text: "text-secondary" },
  pending: { bg: "bg-primary/20", text: "text-primary" },
  classified: { bg: "bg-error/20", text: "text-error" },
};

export default function ReportsPage() {
  return (
    <div className="p-[var(--spacing-gutter)] flex flex-col gap-[var(--spacing-gutter)] h-[calc(100vh-4rem)]">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-[var(--font-inter)] text-[28px] leading-[36px] tracking-[-0.01em] font-semibold text-on-surface uppercase">
          Mission Reports
        </h1>
        <p className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-outline-variant mt-1 uppercase">
          After-Action Reports & Intelligence Summaries
        </p>
      </motion.div>
      <div className="flex-1 overflow-auto">
        <div className="glass-panel rounded-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="font-[var(--font-geist)] text-[10px] tracking-[0.1em] font-semibold text-outline-variant bg-surface-container-lowest border-b border-outline-variant/20">
                <th className="p-4">REPORT ID</th>
                <th className="p-4">TITLE</th>
                <th className="p-4">AUTHOR</th>
                <th className="p-4">SECTOR</th>
                <th className="p-4">STATUS</th>
                <th className="p-4">DATE</th>
              </tr>
            </thead>
            <tbody className="font-[var(--font-geist)] text-[13px] font-medium">
              {reports.map((report, idx) => {
                const sty = reportStatusStyles[report.status] || reportStatusStyles.pending;
                return (
                  <motion.tr
                    key={report.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="border-b border-outline-variant/10 hover:bg-surface-container-highest/30 cursor-pointer transition-colors"
                  >
                    <td className="p-4 text-primary-fixed-dim">{report.id}</td>
                    <td className="p-4">
                      <div className="text-on-surface">{report.title}</div>
                      <div className="text-outline text-[11px] mt-0.5">{report.summary}</div>
                    </td>
                    <td className="p-4 text-on-surface-variant">{report.author}</td>
                    <td className="p-4 text-on-surface-variant">{report.sector}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] uppercase font-bold ${sty.bg} ${sty.text}`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="p-4 text-on-surface-variant">{report.date}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
