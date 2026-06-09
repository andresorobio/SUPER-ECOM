// Client-side mirror of lib/profit.ts for instant, offline UX in the card.
// Keep in sync with the server engine.

function round(n, dp = 2) {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

export function computeProfit(input) {
  const {
    productCost = 0,
    shippingCost = 0,
    platformFeePct = 0,
    paymentFeePct = 0.029,
    fixedCostPerOrder = 0,
    adSpendPerUnit,
    targetMarginPct = 0.6,
    priceMultiplier = 3
  } = input || {};

  const landedCost = round(productCost + shippingCost);
  const byMultiplier = landedCost * priceMultiplier;
  const byMargin = targetMarginPct < 1 ? landedCost / (1 - targetMarginPct) : byMultiplier;
  const recommendedPrice = round(Math.max(byMultiplier, byMargin));
  const sellingPrice = round(input?.sellingPrice ?? recommendedPrice);

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

  let economicsVerdict;
  if (contributionMargin <= 0) economicsVerdict = "unviable";
  else if (contributionMarginPct >= 60) economicsVerdict = "strong";
  else if (contributionMarginPct >= 40) economicsVerdict = "workable";
  else economicsVerdict = "tight";

  return {
    landedCost,
    variableFees,
    contributionMargin,
    contributionMarginPct,
    breakevenCPA,
    breakevenROAS,
    netProfitPerUnit,
    recommendedPrice,
    sellingPrice,
    economicsVerdict
  };
}

export const VERDICT_ES = {
  strong: { label: "Fuerte", color: "#22c55e" },
  workable: { label: "Viable", color: "#84cc16" },
  tight: { label: "Ajustado", color: "#eab308" },
  unviable: { label: "Inviable", color: "#ef4444" }
};
