"use client";

import { useState } from "react";

/**
 * Marketing kit generator — calls POST /api/generate-marketing.
 * Triggered from a Winner card; renders angles, hooks, ad copy, LP outline.
 */
export default function MarketingModal({ product, onClose }) {
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [kit, setKit] = useState(null);
  const [error, setError] = useState("");
  const [audience, setAudience] = useState("");

  const generate = async () => {
    setStatus("loading");
    setError("");
    try {
      const token =
        (typeof window !== "undefined" && localStorage.getItem("auth_token")) || "";
      const res = await fetch("/api/generate-marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ product, audience: audience || undefined, language: "es" })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Error ${res.status}`);
      setKit(data.kit);
      setStatus("done");
    } catch (err) {
      setError(err.message || "No se pudo generar el kit.");
      setStatus("error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f1420] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h3 className="text-base font-bold text-white">Kit de marketing — {product}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        {status !== "done" && (
          <div className="mt-4">
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Audiencia objetivo (opcional)"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-100 outline-none focus:border-emerald-400/50"
            />
            <button
              onClick={generate}
              disabled={status === "loading"}
              className="mt-3 w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-60"
            >
              {status === "loading" ? "Generando..." : "Generar kit de marketing"}
            </button>
            {status === "error" && <p className="mt-3 text-xs text-red-400">{error}</p>}
          </div>
        )}

        {status === "done" && kit && (
          <div className="mt-4 space-y-4 text-sm">
            <Section title="Ángulos">
              {kit.angles?.map((a, i) => (
                <p key={i} className="text-xs text-gray-300">
                  <b className="text-emerald-300">{a.name}:</b> {a.description}
                </p>
              ))}
            </Section>
            <Section title="Hooks (primeros 3s)">
              <ul className="list-disc pl-5 text-xs text-gray-300">
                {kit.hooks?.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </Section>
            <Section title="Copy de anuncios">
              {kit.ad_copy?.map((c, i) => (
                <div key={i} className="mb-2 rounded-md bg-white/[0.03] p-2">
                  <p className="text-xs font-bold text-white">{c.headline}</p>
                  <p className="text-xs text-gray-300">{c.primary_text}</p>
                  <p className="text-[11px] text-emerald-300">CTA: {c.cta}</p>
                </div>
              ))}
            </Section>
            <Section title="Outline de landing">
              <ol className="list-decimal pl-5 text-xs text-gray-300">
                {kit.landing_page_outline?.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </Section>
            <Section title="Ideas de video UGC">
              <ul className="list-disc pl-5 text-xs text-gray-300">
                {kit.ugc_video_ideas?.map((v, i) => <li key={i}>{v}</li>)}
              </ul>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-400">{title}</p>
      {children}
    </div>
  );
}
