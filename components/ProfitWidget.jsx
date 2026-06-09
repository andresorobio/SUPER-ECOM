"use client";

import { useState } from "react";
import { computeProfit, VERDICT_ES } from "./profitCalc";

/**
 * Inline profit / unit-economics calculator on each card.
 * Pure client-side; updates live as the operator types costs.
 */
export default function ProfitWidget() {
  const [open, setOpen] = useState(false);
  const [cost, setCost] = useState("");
  const [shipping, setShipping] = useState("");
  const [price, setPrice] = useState("");
  const [cpa, setCpa] = useState("");

  const hasCost = Number(cost) > 0;
  const result = hasCost
    ? computeProfit({
        productCost: Number(cost),
        shippingCost: Number(shipping) || 0,
        sellingPrice: price ? Number(price) : undefined,
        adSpendPerUnit: cpa ? Number(cpa) : undefined
      })
    : null;

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg bg-sky-500/10 px-4 py-3 text-left text-sm font-semibold text-sky-300 transition hover:bg-sky-500/20"
      >
        <span>💰 Calculadora de rentabilidad</span>
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
      </button>

      {open && (
        <div className="mt-3 animate-fade-in-up rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label="Costo prod. ($)" value={cost} onChange={setCost} />
            <Field label="Envío ($)" value={shipping} onChange={setShipping} />
            <Field label="Precio venta ($)" value={price} onChange={setPrice} placeholder="auto" />
            <Field label="CPA ($)" value={cpa} onChange={setCpa} placeholder="opc." />
          </div>

          {result && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <Stat label="Costo landed" value={`$${result.landedCost}`} />
              <Stat label="Precio sugerido" value={`$${result.recommendedPrice}`} />
              <Stat label="Margen contrib." value={`$${result.contributionMargin} (${result.contributionMarginPct}%)`} />
              <Stat label="ROAS equilibrio" value={result.breakevenROAS === Infinity ? "∞" : `${result.breakevenROAS}x`} />
              <Stat label="CPA máx." value={`$${result.breakevenCPA}`} />
              {result.netProfitPerUnit != null && (
                <Stat
                  label="Neto/venta"
                  value={`$${result.netProfitPerUnit}`}
                  color={result.netProfitPerUnit >= 0 ? "#22c55e" : "#ef4444"}
                />
              )}
              <div className="col-span-2 sm:col-span-3">
                <span
                  className="inline-block rounded-full px-3 py-1 text-[11px] font-bold"
                  style={{
                    color: VERDICT_ES[result.economicsVerdict].color,
                    backgroundColor: `${VERDICT_ES[result.economicsVerdict].color}22`
                  }}
                >
                  Economía: {VERDICT_ES[result.economicsVerdict].label}
                </span>
              </div>
            </div>
          )}
          {!result && (
            <p className="mt-2 text-[11px] text-gray-500">
              Ingresa el costo del producto para ver márgenes, ROAS y CPA de equilibrio.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] text-gray-400">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-sky-400/50"
      />
    </label>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="rounded-md bg-white/[0.03] px-2.5 py-2">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="text-sm font-bold" style={{ color: color || "#e5e7eb" }}>
        {value}
      </p>
    </div>
  );
}
