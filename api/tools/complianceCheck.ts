/**
 * Tool — compliance_risk_check
 * Heuristic risk & compliance screen for a product (pure logic, offline).
 *
 * Flags categories that commonly cause ad rejections, customs/shipping issues,
 * IP/trademark exposure, or regulatory problems. It NEVER gives legal advice —
 * it surfaces risk signals and recommends professional/manual verification.
 */

import type { ToolDefinition, ToolResult } from "./types";

export interface ComplianceArgs {
  product_name: string;
  description?: string;
}

export interface ComplianceFlag {
  category: string;
  severity: "low" | "medium" | "high";
  signal: string;
  recommendation: string;
}

export interface ComplianceData {
  risk_level: "low" | "medium" | "high";
  flags: ComplianceFlag[];
  shippable_friendly: boolean;
  summary: string;
}

interface Rule {
  category: string;
  severity: ComplianceFlag["severity"];
  patterns: RegExp;
  signal: string;
  recommendation: string;
  affectsShipping?: boolean;
}

const RULES: Rule[] = [
  {
    category: "Baterías de litio",
    severity: "high",
    patterns: /\b(battery|batter[ií]a|lithium|litio|power\s?bank|18650|rechargeable|recargable)\b/i,
    signal: "Contiene/usa baterías de litio.",
    recommendation: "Requiere envío certificado (UN38.3), restricciones aéreas y declaración aduanera.",
    affectsShipping: true
  },
  {
    category: "Afirmaciones médicas",
    severity: "high",
    patterns: /\b(cure|cura|treat|trata|heal|medical|m[eé]dico|diabet|cancer|c[aá]ncer|covid|therapeutic|terap[eé]utic)\b/i,
    signal: "Posibles afirmaciones de salud/medicina.",
    recommendation: "Evita claims médicos en ads (rechazo en Meta/TikTok); puede requerir registro sanitario."
  },
  {
    category: "Suplementos / ingesta",
    severity: "medium",
    patterns: /\b(supplement|suplement|vitamin|vitamina|capsule|c[aá]psula|powder.*drink|ingest)\b/i,
    signal: "Producto ingerible o suplemento.",
    recommendation: "Sujeto a normativa alimentaria/sanitaria y políticas de anuncios restringidas."
  },
  {
    category: "Cosmética / piel",
    severity: "medium",
    patterns: /\b(cream|crema|serum|cosmetic|cosm[eé]tic|skin\s?whiten|blanqueador|lash\s?serum)\b/i,
    signal: "Cosmético de contacto con la piel.",
    recommendation: "Verifica ingredientes restringidos y etiquetado obligatorio por país."
  },
  {
    category: "Vape / CBD / tabaco",
    severity: "high",
    patterns: /\b(vape|vaper|e-?cig|cbd|thc|cannabis|tobacco|tabaco|nicotine|nicotina)\b/i,
    signal: "Categoría de vape/CBD/tabaco.",
    recommendation: "Prohibido o muy restringido en la mayoría de plataformas de ads y pagos."
  },
  {
    category: "Armas / utensilios peligrosos",
    severity: "high",
    patterns: /\b(knife|cuchillo|gun|pistol|arma|taser|pepper\s?spray|gas\s?pimienta|weapon)\b/i,
    signal: "Posible arma u objeto peligroso.",
    recommendation: "Restringido en ads/marketplaces; revisa legalidad de importación.",
    affectsShipping: true
  },
  {
    category: "Líquidos / aerosoles",
    severity: "medium",
    patterns: /\b(liquid|l[ií]quido|aerosol|spray|perfume|fragance|fragancia|alcohol)\b/i,
    signal: "Líquido o aerosol.",
    recommendation: "Restricciones de envío aéreo y aduanas; confirma con el courier.",
    affectsShipping: true
  },
  {
    category: "Riesgo de marca/IP",
    severity: "high",
    patterns: /\b(nike|adidas|apple|disney|marvel|pok[eé]mon|gucci|louis\s?vuitton|stanley|dyson|airpods?)\b/i,
    signal: "Menciona una marca registrada.",
    recommendation: "Alto riesgo de falsificación/infracción de marca. No vendas réplicas ni uses la marca sin licencia."
  },
  {
    category: "Eléctrico con enchufe",
    severity: "low",
    patterns: /\b(charger|cargador|adapter|adaptador|plug|enchufe|heater|calentador|220v|110v)\b/i,
    signal: "Dispositivo eléctrico con conexión a red.",
    recommendation: "Requiere certificación (CE/FCC/UL) y enchufe correcto por región."
  }
];

export const complianceCheckTool: ToolDefinition<ComplianceArgs, ComplianceData> = {
  schema: {
    name: "compliance_risk_check",
    description:
      "Detecta señales de riesgo de cumplimiento (baterías, IP/marca, claims médicos, vape, líquidos, etc.) que afectan ads, pagos, envío y aduanas.",
    parameters: {
      type: "object",
      properties: {
        product_name: { type: "string", description: "Product name" },
        description: { type: "string", description: "Optional extra description" }
      },
      required: ["product_name"]
    }
  },

  async execute(args): Promise<ToolResult<ComplianceData>> {
    const text = `${args?.product_name ?? ""} ${args?.description ?? ""}`.trim();
    if (!text) return { ok: false, error: "product_name is required" };

    const flags: ComplianceFlag[] = [];
    let shippable = true;

    for (const rule of RULES) {
      if (rule.patterns.test(text)) {
        flags.push({
          category: rule.category,
          severity: rule.severity,
          signal: rule.signal,
          recommendation: rule.recommendation
        });
        if (rule.affectsShipping) shippable = false;
      }
    }

    const hasHigh = flags.some((f) => f.severity === "high");
    const hasMed = flags.some((f) => f.severity === "medium");
    const risk_level: ComplianceData["risk_level"] = hasHigh
      ? "high"
      : hasMed
        ? "medium"
        : "low";

    const summary =
      flags.length === 0
        ? "Sin señales de riesgo evidentes. Verificación manual recomendada de todas formas."
        : `${flags.length} señal(es) de riesgo (${risk_level}). Revisa políticas de ads/pagos y envío.`;

    return {
      ok: true,
      data: { risk_level, flags, shippable_friendly: shippable, summary },
      note: "Heurístico, no es asesoría legal. Verifica con un experto antes de escalar inversión."
    };
  }
};
