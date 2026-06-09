"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AnalysisCard from "./AnalysisCard";
import { buildReportHtml } from "./pdfReport";
import { exportCsv, exportJson } from "./exporters";

const MAX_PRODUCTS = 5;
const HISTORY_KEY = "odm_recent_searches";

function token() {
  return (typeof window !== "undefined" && localStorage.getItem("auth_token")) || "";
}

/**
 * Main module component.
 * Modes: text (streaming multi-product) | image (vision single product).
 * States: empty | loading | error | success.
 */
export default function ProductAnalyzer() {
  const [mode, setMode] = useState("text"); // text | image
  const [input, setInput] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageHint, setImageHint] = useState("");
  const [status, setStatus] = useState("empty");
  const [analyses, setAnalyses] = useState([]);
  const [progress, setProgress] = useState(null); // { done, total }
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const products = useMemo(
    () => input.split(/[\n,]/).map((p) => p.trim()).filter(Boolean),
    [input]
  );
  const count = products.length;
  const overLimit = count > MAX_PRODUCTS;

  const saveHistory = (terms) => {
    try {
      const next = [...terms, ...history.filter((h) => !terms.includes(h))].slice(0, 5);
      setHistory(next);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  /* ----------------------------- Text (SSE) ------------------------------- */
  const analyzeStream = async () => {
    if (count === 0) return fail("Ingresa al menos un producto.");
    if (overLimit) return fail(`Máximo ${MAX_PRODUCTS} productos por análisis.`);

    setStatus("loading");
    setError("");
    setAnalyses([]);
    setProgress({ done: 0, total: count });

    try {
      const res = await fetch("/api/analyze-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ products })
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let received = 0;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";
        for (const chunk of chunks) {
          const evt = parseSse(chunk);
          if (!evt) continue;
          if (evt.event === "result" && evt.data?.analysis) {
            setAnalyses((prev) => [...prev, evt.data.analysis]);
            received++;
            setProgress({ done: received, total: count });
            setStatus("success");
          } else if (evt.event === "error") {
            received++;
            setProgress({ done: received, total: count });
          }
        }
      }
      saveHistory(products);
      setStatus((s) => (s === "success" ? "success" : "error"));
      if (received === 0) fail("No se pudo analizar ningún producto.");
    } catch (err) {
      fail(err.message || "No se pudo completar el análisis.");
    } finally {
      setProgress(null);
    }
  };

  /* ----------------------------- Image (vision) --------------------------- */
  const analyzeImage = async () => {
    if (!imageUrl) return fail("Pega una URL de imagen o sube una foto.");
    setStatus("loading");
    setError("");
    setAnalyses([]);
    try {
      const res = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ imageUrl, hint: imageHint || undefined })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Error ${res.status}`);
      setAnalyses([data.analysis]);
      setStatus("success");
    } catch (err) {
      fail(err.message || "No se pudo analizar la imagen.");
    }
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const fail = (msg) => {
    setError(msg);
    setStatus("error");
  };

  const reset = () => {
    setInput("");
    setImageUrl("");
    setImageHint("");
    setAnalyses([]);
    setError("");
    setStatus("empty");
  };

  const run = () => (mode === "text" ? analyzeStream() : analyzeImage());

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
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
          Agente de Inteligencia ODM
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Validación de productos ganadores + sourcing directo de fábrica.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="mb-3 flex justify-center gap-2">
        <Tab active={mode === "text"} onClick={() => setMode("text")}>📝 Texto</Tab>
        <Tab active={mode === "image"} onClick={() => setMode("image")}>📷 Imagen</Tab>
      </div>

      {/* Input area */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        {mode === "text" ? (
          <>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={4}
              placeholder={"Un producto por línea o separados por coma...\nEj: Corrector de postura magnético, Licuadora portátil"}
              className="w-full resize-none rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-gray-100 outline-none focus:border-emerald-400/50"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className={`text-xs ${overLimit ? "text-red-400" : "text-gray-400"}`}>
                {count}/{MAX_PRODUCTS} productos ingresados
              </span>
              <button onClick={run} disabled={status === "loading"} className={btnPrimary}>
                {status === "loading" ? <><Spinner /> Analizando...</> : "Analizar Productos"}
              </button>
            </div>
            {history.length > 0 && status !== "loading" && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-gray-500">Recientes:</span>
                {history.map((h, i) => (
                  <button key={i} onClick={() => setInput(h)}
                    className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-gray-300 hover:bg-white/10">
                    {h}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <input
              value={imageUrl.startsWith("data:") ? "" : imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Pega la URL de una imagen del producto (https://...)"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-100 outline-none focus:border-emerald-400/50"
            />
            <div className="mt-2 flex items-center gap-2">
              <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] text-gray-200 hover:bg-white/5">
                📎 Subir foto / captura
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
              {imageUrl.startsWith("data:") && <span className="text-[11px] text-emerald-300">Imagen cargada ✓</span>}
            </div>
            <input
              value={imageHint}
              onChange={(e) => setImageHint(e.target.value)}
              placeholder="Contexto opcional (ej: visto en TikTok, nicho fitness)"
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-100 outline-none focus:border-emerald-400/50"
            />
            <div className="mt-3 flex justify-end">
              <button onClick={run} disabled={status === "loading"} className={btnPrimary}>
                {status === "loading" ? <><Spinner /> Analizando imagen...</> : "Analizar Imagen"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* States */}
      <div className="mt-6">
        {status === "empty" && <EmptyState />}
        {status === "loading" && analyses.length === 0 && (
          <LoadingState count={mode === "text" ? Math.max(1, count) : 1} progress={progress} />
        )}
        {status === "error" && analyses.length === 0 && <ErrorState message={error} onRetry={run} />}
        {(status === "success" || analyses.length > 0) && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-gray-400">
                {progress ? `Analizando ${progress.done}/${progress.total}...` : `${analyses.length} resultado(s)`}
              </span>
              <div className="flex flex-wrap gap-2">
                <button onClick={exportPdf} className={btnGhost}>PDF</button>
                <button onClick={() => exportCsv(analyses)} className={btnGhost}>CSV</button>
                <button onClick={() => exportJson(analyses)} className={btnGhost}>JSON</button>
                <button onClick={reset} className={btnGhost}>Nueva búsqueda</button>
              </div>
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

const btnPrimary =
  "flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60";
const btnGhost =
  "rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold text-gray-200 hover:bg-white/5";

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-emerald-500/15 text-emerald-300" : "text-gray-400 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
      <p className="text-3xl">🎯</p>
      <h2 className="mt-3 text-lg font-bold text-white">Empieza tu análisis de productos</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
        Escribe hasta {MAX_PRODUCTS} productos o sube una imagen. El agente los puntúa con 10
        criterios reales y, si superan 7/10, genera la estrategia completa de sourcing ODM.
      </p>
    </div>
  );
}

function LoadingState({ count, progress }) {
  return (
    <div className="space-y-5">
      {progress && (
        <p className="text-center text-xs text-gray-400">
          Analizando {progress.done}/{progress.total}...
        </p>
      )}
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-16 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-12 w-full" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, j) => <Skeleton key={j} className="h-10 w-full" />)}
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
      <button onClick={onRetry} className="mt-4 rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-400">
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
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />;
}

/** Parse a single SSE "event: x\ndata: {...}" chunk. */
function parseSse(chunk) {
  const lines = chunk.split("\n");
  let event = "message";
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return null;
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return null;
  }
}
