// Client-side exporters (CSV / JSON). Dependency-free; trigger a file download.

import { CRITERIA_ORDER } from "./uiHelpers";

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportJson(analyses) {
  download(
    `odm-analyses-${Date.now()}.json`,
    JSON.stringify(analyses, null, 2),
    "application/json"
  );
}

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsv(analyses) {
  const headers = [
    "product_name",
    "score",
    "verdict",
    ...CRITERIA_ORDER,
    "pros",
    "cons",
    "sourcing_enabled",
    "alibaba_keywords"
  ];

  const rows = analyses.map((a) => {
    const criteriaScores = CRITERIA_ORDER.map((k) => a.criteria?.[k]?.score ?? "");
    return [
      a.product_name,
      a.score,
      a.verdict,
      ...criteriaScores,
      (a.pros || []).join(" | "),
      (a.cons || []).join(" | "),
      a.sourcing?.enabled ? "yes" : "no",
      (a.sourcing?.alibaba_keywords || []).join(" | ")
    ]
      .map(csvEscape)
      .join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  download(`odm-analyses-${Date.now()}.csv`, csv, "text/csv;charset=utf-8");
}
