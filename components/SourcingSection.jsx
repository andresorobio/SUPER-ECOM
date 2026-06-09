"use client";

import { useState } from "react";

/**
 * Deliverable 4B (Sourcing) — expandable sourcing strategy block.
 * Only rendered when sourcing.enabled (score > 7).
 *
 * Props:
 *   sourcing: Sourcing object from the schema
 */
export default function SourcingSection({ sourcing }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState({
    keywords: true,
    filters: false,
    hack: false,
    message: false,
    strategy: false
  });
  const [copied, setCopied] = useState("");

  if (!sourcing || !sourcing.enabled) return null;

  const toggleSub = (key) => setSub((s) => ({ ...s, [key]: !s[key] }));

  const copy = async (text, tag) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("");
    }
  };

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg bg-emerald-500/10 px-4 py-3 text-left text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
      >
        <span>🏭 Estrategia de Sourcing ODM</span>
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-3 animate-fade-in-up">
          {/* Keywords */}
          <Collapsible
            title="Keywords de Alibaba (inglés)"
            isOpen={sub.keywords}
            onToggle={() => toggleSub("keywords")}
          >
            <ul className="flex flex-wrap gap-2">
              {sourcing.alibaba_keywords?.map((k, i) => (
                <li
                  key={i}
                  className="cursor-pointer rounded-md bg-white/5 px-2.5 py-1 text-xs text-gray-200 hover:bg-white/10"
                  onClick={() => copy(k, `kw-${i}`)}
                  title="Click para copiar"
                >
                  {k}
                  {copied === `kw-${i}` && (
                    <span className="ml-1 text-emerald-400">¡Copiado!</span>
                  )}
                </li>
              ))}
            </ul>
          </Collapsible>

          {/* Filters */}
          <Collapsible
            title="Filtros obligatorios"
            isOpen={sub.filters}
            onToggle={() => toggleSub("filters")}
          >
            <div className="flex flex-wrap gap-2">
              {sourcing.required_filters?.map((f, i) => (
                <span
                  key={i}
                  className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs text-emerald-300"
                >
                  {f}
                </span>
              ))}
            </div>
          </Collapsible>

          {/* 3-star hack */}
          <Collapsible
            title="Hack de las 3 Estrellas"
            isOpen={sub.hack}
            onToggle={() => toggleSub("hack")}
          >
            <p className="mb-1 text-xs font-semibold text-gray-300">
              Quejas comunes:
            </p>
            <ul className="mb-3 list-disc pl-5 text-xs text-gray-400">
              {sourcing.three_star_hack?.common_complaints?.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
            <p className="text-xs font-semibold text-gray-300">
              Mejora a exigir:
            </p>
            <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              {sourcing.three_star_hack?.upgrade_to_demand}
            </p>
          </Collapsible>

          {/* Supplier message */}
          <Collapsible
            title="Mensaje al proveedor"
            isOpen={sub.message}
            onToggle={() => toggleSub("message")}
          >
            <MessageBlock
              label="Inglés"
              text={sourcing.supplier_message_en}
              copied={copied === "msg-en"}
              onCopy={() => copy(sourcing.supplier_message_en, "msg-en")}
            />
            <MessageBlock
              label="Español"
              text={sourcing.supplier_message_es}
              copied={copied === "msg-es"}
              onCopy={() => copy(sourcing.supplier_message_es, "msg-es")}
            />
          </Collapsible>

          {/* Search strategy */}
          <Collapsible
            title="Estrategia de búsqueda paso a paso"
            isOpen={sub.strategy}
            onToggle={() => toggleSub("strategy")}
          >
            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-300">
              {sourcing.search_strategy}
            </pre>
          </Collapsible>
        </div>
      )}
    </div>
  );
}

function Collapsible({ title, isOpen, onToggle, children }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-gray-200"
      >
        <span>{title}</span>
        <span className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function MessageBlock({ label, text, copied, onCopy }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-300">{label}</span>
        <button
          onClick={onCopy}
          className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-gray-200 hover:bg-white/20"
        >
          {copied ? "¡Copiado!" : "Copiar mensaje"}
        </button>
      </div>
      <pre className="whitespace-pre-wrap break-words rounded-md bg-black/30 p-3 text-[11px] leading-relaxed text-gray-300">
        {text}
      </pre>
    </div>
  );
}
