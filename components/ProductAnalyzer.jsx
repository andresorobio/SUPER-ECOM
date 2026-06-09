"use client";

import { useEffect, useMemo, useState } from "react";
import AnalysisCard from "./AnalysisCard";
import { buildReportHtml } from "./pdfReport";

const MAX_PRODUCTS = 5;
const HISTORY_KEY = "odm_recent_searches";

/**
 * Deliverable 4 — main module component.
 * States: empty (welcome) | loading (skeletons) | error (retry) | success.
 */
export default function ProductAnalyzer() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("empty"); // empty | loading | error | success
  const [analyses, setAnalyses] = useState([]);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);

  // Load recent searches from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const products = useMemo(
    () =>
      input
        .split(/[\n,]/)
        .map((p) => p.trim())
        .filter(Boolean),
    [input]
  );

  const count = products.length;
  const overLimit = count > MAX_PRODUCTS;

  const saveHistory = (terms) => {
    try {
      const next = [...terms, ...history.filter((h) => !terms.includes(h))].slice(
        0,
        5
      );
      setHistory(next);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const analyze = async () => {
    if (count === 0) {
      setError("Ingresa al menos un producto.");
      setStatus("error");
      return;
    }
    if (overLimit) {
      setError(`Máximo ${MAX_PRODUCTS} productos por análisis.`);
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError("");
    try {
      const token =
        (typeof window !== "undefined" && localStorage.getItem("auth_token")) || "";
      const res = await fetch("/api/analyze-product", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ products })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Error ${res.status}`);
      }
      setAnalyses(data.analyses || []);
      setStatus("success");
      saveHistory(products);
    } catch (err) {
      setError(err.message || "No se pudo completar el análisis.");
      setStatus("error");
    }
  };

  const reset = () => {
    setInput("");
    setAnalyses([]);
    setError("");
    setStatus("empty");
  };

  const exportPdf = () => {
    const html = buildReportHtml(analyses);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Title */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
          Agente de Inteligencia ODM
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Validación de productos ganadores + sourcing directo de fábrica.
        </p>
      </div>

      {/* Input area */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          placeholder={"Un producto por línea o separados por coma...\nEj: Corrector de postura magnético, Licuadora portátil"}
          className="w-full resize-none rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-gray-100 outline-none focus:border-emerald-400/50"
        />
        <div className="mt-3 flex items-center justify-between">
          <span
            className={`text-xs ${overLimit ? "text-red-400" : "text-gray-400"}`}
          >
            {count}/{MAX_PRODUCTS} productos ingresados
          </span>
          <button
            onClick={analyze}
            disabled={status === "loading"}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "loading" ? (
              <>
                <Spinner /> Analizando...
              </>
            ) : (
              "Analizar Productos"
            )}
          </button>
        </div>

        {/* Recent searches */}
        {history.length > 0 && status !== "loading" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-gray-500">Recientes:</span>
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => setInput(h)}
                className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-gray-300 hover:bg-white/10"
              >
                {h}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* States */}
      <div className="mt-6">
        {status === "empty" && <EmptyState />}
        {status === "loading" && <LoadingState count={Math.max(1, count)} />}
        {status === "error" && <ErrorState message={error} onRetry={analyze} />}
        {status === "success" && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={exportPdf}
                className="rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold text-gray-200 hover:bg-white/5"
              >
                Exportar como PDF
              </button>
              <button
                onClick={reset}
                className="rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold text-gray-200 hover:bg-white/5"
              >
                Nueva búsqueda
              </button>
            </div>
            <div className="space-y-5">
              {analyses.map((a, i) => (
                <AnalysisCard key={`${a.product_name}-${i}`} analysis={a} index={i} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- States ----------------------------------- */

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
      <p className="text-3xl">🎯</p>
      <h2 className="mt-3 text-lg font-bold text-white">
        Empieza tu análisis de productos
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
        Escribe hasta {MAX_PRODUCTS} productos. El agente los puntúa con 10
        criterios reales y, si superan 7/10, genera la estrategia completa de
        sourcing ODM en Alibaba.
      </p>
    </div>
  );
}

function LoadingState({ count }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5"
        >
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-16 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-12 w-full" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, j) => (
              <Skeleton key={j} className="h-10 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
      <p className="text-2xl">⚠️</p>
      <p className="mt-2 text-sm text-red-200">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-400"
      >
        Reintentar
      </button>
    </div>
  );
}

function Skeleton({ className = "" }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-white/5 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
  );
}
