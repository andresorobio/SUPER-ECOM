"use client";

import { useState } from "react";
import SourcingSection from "./SourcingSection";
import ProfitWidget from "./ProfitWidget";
import MarketingModal from "./MarketingModal";
import { CRITERIA_LABELS, CRITERIA_ORDER, scoreColor, verdictMeta } from "./uiHelpers";

/**
 * Deliverable 4B — single product result card.
 *
 * Props:
 *   analysis: ProductAnalysis
 *   index: number (for stagger animation)
 */
export default function AnalysisCard({ analysis, index = 0 }) {
  const color = scoreColor(analysis.score);
  const verdict = verdictMeta(analysis.verdict, analysis.score);
  const [showMarketing, setShowMarketing] = useState(false);
  const [watchState, setWatchState] = useState("idle"); // idle | saving | saved

  const addToWatchlist = async () => {
    setWatchState("saving");
    try {
      const token =
        (typeof window !== "undefined" && localStorage.getItem("auth_token")) || "";
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ product_name: analysis.product_name })
      });
      setWatchState(res.ok ? "saved" : "idle");
    } catch {
      setWatchState("idle");
    }
  };

  return (
    <article
      className="animate-fade-in-up rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-lg shadow-black/20"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white">
            {analysis.product_name}
          </h3>
          <span
            className="mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold"
            style={{ color: verdict.color, backgroundColor: verdict.bg }}
          >
            {verdict.label}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 text-xl font-extrabold"
            style={{ borderColor: color, color }}
          >
            {analysis.score}
          </div>
          <span className="mt-1 text-[11px] text-gray-400">/10</span>
        </div>
      </header>

      {/* Action row */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={addToWatchlist}
          disabled={watchState !== "idle"}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-gray-200 hover:bg-white/5 disabled:opacity-70"
        >
          {watchState === "saved" ? "★ En seguimiento" : watchState === "saving" ? "Guardando..." : "☆ Seguir producto"}
        </button>
        {analysis.score >= 8 && (
          <button
            onClick={() => setShowMarketing(true)}
            className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
          >
            ✨ Generar marketing
          </button>
        )}
      </div>

      {/* Quick analysis */}
      {analysis.quick_analysis && (
        <p className="mt-4 rounded-lg bg-black/20 p-3 text-sm leading-relaxed text-gray-300">
          {analysis.quick_analysis}
        </p>
      )}

      {/* Criteria grid */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CRITERIA_ORDER.map((key) => {
          const c = analysis.criteria?.[key];
          if (!c) return null;
          const pass = c.score === 1;
          return (
            <div
              key={key}
              className="flex items-start gap-2 rounded-md bg-white/[0.02] px-3 py-2"
            >
              <span
                className="mt-0.5 text-sm font-bold"
                style={{ color: pass ? "#22c55e" : "#ef4444" }}
              >
                {pass ? "✓" : "✗"}
              </span>
              <div>
                <p className="text-xs font-semibold text-gray-200">
                  {CRITERIA_LABELS[key]}
                </p>
                <p className="text-[11px] leading-snug text-gray-400">
                  {c.reason}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pros & Cons */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-bold text-emerald-400">PROS</p>
          <ul className="space-y-1">
            {analysis.pros?.map((p, i) => (
              <li key={i} className="text-xs text-gray-300">
                <span className="text-emerald-400">+</span> {p}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-xs font-bold text-red-400">CONTRAS</p>
          <ul className="space-y-1">
            {analysis.cons?.map((c, i) => (
              <li key={i} className="text-xs text-gray-300">
                <span className="text-red-400">−</span> {c}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Sourcing (only when enabled / score > 7) */}
      <SourcingSection sourcing={analysis.sourcing} />

      {/* Profit / unit-economics calculator */}
      <ProfitWidget />

      {showMarketing && (
        <MarketingModal
          product={analysis.product_name}
          onClose={() => setShowMarketing(false)}
        />
      )}
    </article>
  );
}
