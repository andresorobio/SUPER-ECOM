// Shared presentation helpers for the analyzer UI.

export const CRITERIA_LABELS = {
  solves_problem: "Resuelve un problema real",
  market_validation: "Validación de mercado",
  ad_engagement: "Interacción en anuncios",
  evergreen: "Tendencia evergreen",
  margin_2_5x: "Margen 2.5x",
  wow_effect: "Efecto wow visual",
  odm_potential: "Potencial ODM / marca blanca",
  local_exclusivity: "Exclusividad local",
  logistics: "Logística eficiente",
  perceived_value: "Alto valor percibido"
};

export const CRITERIA_ORDER = [
  "solves_problem",
  "market_validation",
  "ad_engagement",
  "evergreen",
  "margin_2_5x",
  "wow_effect",
  "odm_potential",
  "local_exclusivity",
  "logistics",
  "perceived_value"
];

// Dynamic color by score band.
export function scoreColor(score) {
  if (score >= 8) return "#22c55e"; // verde — Ganador
  if (score >= 6) return "#eab308"; // amarillo — Probar
  return "#ef4444"; // rojo — Descartado
}

export function verdictMeta(verdict, score) {
  // Prefer the explicit verdict; fall back to score band.
  const v = verdict || (score >= 8 ? "Winner" : score >= 6 ? "Test" : "Discard");
  switch (v) {
    case "Winner":
      return { label: "GANADOR ✓", color: "#22c55e", bg: "rgba(34,197,94,0.12)" };
    case "Test":
      return { label: "PARA PROBAR ⚡", color: "#eab308", bg: "rgba(234,179,8,0.12)" };
    default:
      return { label: "DESCARTADO ✗", color: "#ef4444", bg: "rgba(239,68,68,0.12)" };
  }
}
