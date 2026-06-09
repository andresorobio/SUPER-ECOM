/**
 * Profit & unit-economics engine (pure logic — works offline, no API keys).
 *
 * The single most important thing a dropshipper needs after "is this a winner?"
 * is "does the math work?". This computes landed cost, fees, contribution
 * margin, break-even ROAS/CPA, and a recommended retail price.
 */

export interface ProfitInput {
  /** Product unit cost from the supplier (e.g. Alibaba FOB). */
  productCost: number;
  /** Per-unit shipping/freight to your customer or 3PL. */
  shippingCost?: number;
  /** Intended selling (retail) price. If omitted we recommend one. */
  sellingPrice?: number;
  /** Platform/marketplace fee as a fraction (0.0–1.0). e.g. 0.0 for own store. */
  platformFeePct?: number;
  /** Payment processor fee fraction (e.g. Stripe ≈ 0.029). */
  paymentFeePct?: number;
  /** Flat per-order cost (packaging, handling). */
  fixedCostPerOrder?: number;
  /** Average ad cost to acquire one sale (CPA), if known. */
  adSpendPerUnit?: number;
  /** Target gross margin fraction used to recommend a price (default 0.6). */
  targetMarginPct?: number;
  /** Recommended price multiplier on landed cost (default 3x). */
  priceMultiplier?: number;
}

export interface ProfitResult {
  landedCost: number;
  variableFees: number;
  /** price - landedCost - fees - fixed (before ad spend). */
  contributionMargin: number;
  contributionMarginPct: number;
  /** Max you can pay per acquisition and still break even. */
  breakevenCPA: number;
  /** Break-even Return On Ad Spend = price / contributionMargin. */
  breakevenROAS: number;
  /** Net profit per unit after subtracting ad spend (if provided). */
  netProfitPerUnit: number | null;
  recommendedPrice: number;
  /** Quick verdict on whether the economics support paid acquisition. */
  economicsVerdict: "strong" | "workable" | "tight" | "unviable";
  notes: string[];
}

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

export function computeProfit(input: ProfitInput): ProfitResult {
  const {
    productCost,
    shippingCost = 0,
    platformFeePct = 0,
    paymentFeePct = 0.029,
    fixedCostPerOrder = 0,
    adSpendPerUnit,
    targetMarginPct = 0.6,
    priceMultiplier = 3
  } = input;

  const landedCost = round(productCost + shippingCost);

  // Recommend a price: max of (multiplier on landed) and (target-margin price).
  const byMultiplier = landedCost * priceMultiplier;
  const byMargin = targetMarginPct < 1 ? landedCost / (1 - targetMarginPct) : byMultiplier;
  const recommendedPrice = round(Math.max(byMultiplier, byMargin));

  const sellingPrice = round(input.sellingPrice ?? recommendedPrice);

  const variableFees = round(sellingPrice * (platformFeePct + paymentFeePct));
  const contributionMargin = round(
    sellingPrice - landedCost - variableFees - fixedCostPerOrder
  );
  const contributionMarginPct =
    sellingPrice > 0 ? round((contributionMargin / sellingPrice) * 100, 1) : 0;

  const breakevenCPA = round(Math.max(0, contributionMargin));
  const breakevenROAS =
    contributionMargin > 0 ? round(sellingPrice / contributionMargin, 2) : Infinity;

  const netProfitPerUnit =
    adSpendPerUnit != null ? round(contributionMargin - adSpendPerUnit) : null;

  const notes: string[] = [];
  let economicsVerdict: ProfitResult["economicsVerdict"];

  if (contributionMargin <= 0) {
    economicsVerdict = "unviable";
    notes.push("La contribución es cero o negativa: no hay margen para anuncios.");
  } else if (contributionMarginPct >= 60) {
    economicsVerdict = "strong";
    notes.push("Margen amplio: soporta escalado agresivo en paid ads.");
  } else if (contributionMarginPct >= 40) {
    economicsVerdict = "workable";
    notes.push("Margen sano para una marca DTC con paid ads.");
  } else {
    economicsVerdict = "tight";
    notes.push("Margen ajustado: necesitarás CPA bajo y AOV alto (upsells/bundles).");
  }

  if (breakevenROAS !== Infinity) {
    notes.push(
      `Necesitas un ROAS > ${breakevenROAS} para ser rentable (CPA máx. ${breakevenCPA}).`
    );
  }
  if (netProfitPerUnit != null && netProfitPerUnit < 0) {
    notes.push("Con el CPA actual pierdes dinero por venta; reduce CPA o sube AOV.");
  }

  return {
    landedCost,
    variableFees,
    contributionMargin,
    contributionMarginPct,
    breakevenCPA,
    breakevenROAS,
    netProfitPerUnit,
    recommendedPrice,
    economicsVerdict,
    notes
  };
}
