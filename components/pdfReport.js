// Deliverable 4C — dependency-free PDF export.
// Builds a self-contained printable HTML document; the new window's print
// dialog lets the user "Save as PDF". No external libraries required.

import { CRITERIA_LABELS, CRITERIA_ORDER } from "./uiHelpers";

function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function scoreColor(score) {
  if (score >= 8) return "#16a34a";
  if (score >= 6) return "#ca8a04";
  return "#dc2626";
}

function verdictLabel(verdict, score) {
  const v = verdict || (score >= 8 ? "Winner" : score >= 6 ? "Test" : "Discard");
  if (v === "Winner") return "GANADOR";
  if (v === "Test") return "PARA PROBAR";
  return "DESCARTADO";
}

function cardHtml(a) {
  const color = scoreColor(a.score);
  const criteria = CRITERIA_ORDER.map((key) => {
    const c = a.criteria?.[key];
    if (!c) return "";
    const pass = c.score === 1;
    return `<tr>
      <td style="color:${pass ? "#16a34a" : "#dc2626"};font-weight:bold;width:18px">${pass ? "✓" : "✗"}</td>
      <td><strong>${esc(CRITERIA_LABELS[key])}</strong><br/><span style="color:#555;font-size:11px">${esc(c.reason)}</span></td>
    </tr>`;
  }).join("");

  const pros = (a.pros || []).map((p) => `<li>${esc(p)}</li>`).join("");
  const cons = (a.cons || []).map((c) => `<li>${esc(c)}</li>`).join("");

  let sourcing = "";
  if (a.sourcing && a.sourcing.enabled) {
    const kw = (a.sourcing.alibaba_keywords || [])
      .map((k) => `<li>${esc(k)}</li>`)
      .join("");
    const complaints = (a.sourcing.three_star_hack?.common_complaints || [])
      .map((c) => `<li>${esc(c)}</li>`)
      .join("");
    sourcing = `
      <h3 style="margin-top:16px;color:#16a34a">Estrategia de Sourcing ODM</h3>
      <p><strong>Keywords Alibaba:</strong></p><ul>${kw}</ul>
      <p><strong>Filtros:</strong> ${esc((a.sourcing.required_filters || []).join(", "))}</p>
      <p><strong>Hack 3 estrellas — quejas:</strong></p><ul>${complaints}</ul>
      <p><strong>Mejora a exigir:</strong> ${esc(a.sourcing.three_star_hack?.upgrade_to_demand || "")}</p>
      <p><strong>Mensaje al proveedor (EN):</strong></p>
      <pre style="white-space:pre-wrap;background:#f5f5f5;padding:8px;border-radius:6px;font-size:11px">${esc(a.sourcing.supplier_message_en || "")}</pre>
      <p><strong>Estrategia de búsqueda:</strong></p>
      <pre style="white-space:pre-wrap;font-size:11px">${esc(a.sourcing.search_strategy || "")}</pre>
    `;
  }

  return `
  <section style="page-break-inside:avoid;border:1px solid #ddd;border-radius:10px;padding:16px;margin-bottom:18px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h2 style="margin:0">${esc(a.product_name)}</h2>
        <span style="display:inline-block;margin-top:6px;padding:3px 10px;border-radius:999px;background:${color};color:#fff;font-size:12px;font-weight:bold">${verdictLabel(a.verdict, a.score)}</span>
      </div>
      <div style="font-size:28px;font-weight:800;color:${color}">${a.score}/10</div>
    </div>
    <p style="color:#444;font-size:13px">${esc(a.quick_analysis || "")}</p>
    <table style="width:100%;border-collapse:collapse;font-size:12px">${criteria}</table>
    <div style="display:flex;gap:24px;margin-top:12px;font-size:12px">
      <div style="flex:1"><strong style="color:#16a34a">PROS</strong><ul>${pros}</ul></div>
      <div style="flex:1"><strong style="color:#dc2626">CONTRAS</strong><ul>${cons}</ul></div>
    </div>
    ${sourcing}
  </section>`;
}

export function buildReportHtml(analyses = []) {
  const date = new Date().toLocaleString();
  const body = analyses.map(cardHtml).join("");
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"/>
<title>Reporte de Análisis ODM</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px;}
  h1{font-size:20px;margin-bottom:2px}
  ul{margin:4px 0;padding-left:18px}
  td{padding:4px;vertical-align:top;border-bottom:1px solid #eee}
  @media print{ button{display:none} }
</style></head>
<body>
  <h1>Reporte de Inteligencia de Productos — ODM Scout</h1>
  <p style="color:#666;font-size:12px">Generado: ${esc(date)} · ${analyses.length} producto(s)</p>
  ${body}
</body></html>`;
}
