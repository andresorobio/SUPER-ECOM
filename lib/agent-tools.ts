/**
 * Higher-level agent capabilities reused by the MCP server (Deliverable 3B/9).
 *
 *   evaluate_product(name)                        -> ProductAnalysis
 *   generate_supplier_message(product, upgrades)  -> { en, es }
 *   search_alibaba_keywords(product)              -> string[]
 *
 * evaluate_product reuses the same LLM pipeline & schema normalization as the
 * HTTP endpoint, so the MCP subagent and the web module are always consistent.
 */

import { analyzeWithLlm } from "@/lib/llm";
import { normalizeAnalyses, type ProductAnalysis } from "@/schemas/product.schema";

export async function evaluateProduct(name: string): Promise<ProductAnalysis> {
  const raw = await analyzeWithLlm([name]);
  const list = normalizeAnalyses(JSON.parse(raw));
  if (list.length === 0) {
    throw new Error("No analysis produced for the product");
  }
  return list[0];
}

/**
 * Build a copy-paste ready supplier inquiry. If the product already scored as a
 * Winner it will have sourcing messages; otherwise we synthesize a generic but
 * concrete inquiry from the requested improvements.
 */
export function generateSupplierMessage(
  product: string,
  improvements: string[] = []
): { en: string; es: string } {
  const upgradeLineEn =
    improvements.length > 0
      ? `Specifically, we need these improvements over standard versions: ${improvements.join(
          "; "
        )}.`
      : "We are open to your standard ODM specs and would like your recommendations.";
  const upgradeLineEs =
    improvements.length > 0
      ? `En concreto, necesitamos estas mejoras sobre las versiones estándar: ${improvements.join(
          "; "
        )}.`
      : "Estamos abiertos a sus especificaciones ODM estándar y agradeceríamos sus recomendaciones.";

  const en = [
    `Hello,`,
    ``,
    `We are a brand sourcing "${product}" for retail distribution.`,
    upgradeLineEn,
    `Could you please share the following:`,
    `1. Minimum Order Quantity (MOQ) and price tiers.`,
    `2. Whether you support OEM/ODM and custom-logo / custom-packaging.`,
    `3. Sample availability, sample cost, and lead time.`,
    `4. Your target FOB unit price at MOQ.`,
    `5. Production lead time for a first order.`,
    ``,
    `A short raw video of the product on your production line would help us move fast.`,
    `Thank you, we look forward to a long-term partnership.`
  ].join("\n");

  const es = [
    `Hola,`,
    ``,
    `Somos una marca que busca fabricar "${product}" para distribución retail.`,
    upgradeLineEs,
    `¿Podrían compartirnos lo siguiente?`,
    `1. Cantidad mínima de pedido (MOQ) y rangos de precio.`,
    `2. Si ofrecen OEM/ODM y logo / empaque personalizado.`,
    `3. Disponibilidad de muestras, costo y tiempo de entrega.`,
    `4. Su precio FOB unitario objetivo en el MOQ.`,
    `5. Tiempo de producción para un primer pedido.`,
    ``,
    `Un video crudo del producto en su línea de producción nos ayudaría a avanzar rápido.`,
    `Gracias, esperamos una relación comercial a largo plazo.`
  ].join("\n");

  return { en, es };
}

/**
 * Produce 5 Alibaba search keyword strings using modifier keywords.
 * Deterministic + dependency-free so it can run even without an LLM call.
 */
export function searchAlibabaKeywords(product: string): string[] {
  const base = product.trim().toLowerCase();
  const modifiers = [
    "wholesale",
    "custom logo",
    "ODM manufacturer",
    "private label",
    "OEM factory"
  ];
  return modifiers.map((m) => `${base} ${m}`.replace(/\s+/g, " ").trim());
}
