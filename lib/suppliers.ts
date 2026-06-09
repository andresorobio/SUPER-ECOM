/**
 * Supplier scoring & comparison engine (pure logic, offline).
 *
 * Given a list of candidate suppliers (from alibaba_product_search or entered
 * manually), it scores each on a weighted rubric and ranks them so the operator
 * can pick the best ODM partner objectively.
 */

export interface SupplierInput {
  name: string;
  url?: string;
  /** Supplier star rating 0-5. */
  rating?: number;
  /** Minimum order quantity. Lower is friendlier for testing. */
  moq?: number;
  /** Years on the platform / in business. */
  years?: number;
  /** Response rate fraction 0-1. */
  responseRate?: number;
  verified?: boolean;
  tradeAssurance?: boolean;
  odm?: boolean;
  /** Quoted FOB unit price (lower scores higher, relatively). */
  unitPrice?: number;
}

export interface ScoredSupplier extends SupplierInput {
  score: number; // 0-100
  breakdown: Record<string, number>;
  flags: string[];
}

const WEIGHTS = {
  rating: 25,
  verification: 15,
  tradeAssurance: 12,
  odm: 18,
  experience: 10,
  responseRate: 10,
  moq: 5,
  price: 5
};

export function scoreSuppliers(suppliers: SupplierInput[]): ScoredSupplier[] {
  if (!Array.isArray(suppliers) || suppliers.length === 0) return [];

  const prices = suppliers.map((s) => s.unitPrice ?? NaN).filter((n) => !isNaN(n));
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;

  const moqs = suppliers.map((s) => s.moq ?? NaN).filter((n) => !isNaN(n));
  const minMoq = moqs.length ? Math.min(...moqs) : 0;
  const maxMoq = moqs.length ? Math.max(...moqs) : 0;

  const scored = suppliers.map((s) => {
    const breakdown: Record<string, number> = {};
    const flags: string[] = [];

    breakdown.rating = ((s.rating ?? 0) / 5) * WEIGHTS.rating;
    breakdown.verification = s.verified ? WEIGHTS.verification : 0;
    breakdown.tradeAssurance = s.tradeAssurance ? WEIGHTS.tradeAssurance : 0;
    breakdown.odm = s.odm ? WEIGHTS.odm : 0;
    breakdown.experience = Math.min(1, (s.years ?? 0) / 8) * WEIGHTS.experience;
    breakdown.responseRate = (s.responseRate ?? 0) * WEIGHTS.responseRate;

    // Lower MOQ is better (normalized inverse).
    if (s.moq != null && maxMoq > minMoq) {
      breakdown.moq = (1 - (s.moq - minMoq) / (maxMoq - minMoq)) * WEIGHTS.moq;
    } else {
      breakdown.moq = WEIGHTS.moq * 0.5;
    }

    // Lower price is better (normalized inverse).
    if (s.unitPrice != null && maxPrice > minPrice) {
      breakdown.price = (1 - (s.unitPrice - minPrice) / (maxPrice - minPrice)) * WEIGHTS.price;
    } else {
      breakdown.price = WEIGHTS.price * 0.5;
    }

    if (!s.verified) flags.push("Sin verificación: pide documentación y muestra.");
    if (!s.tradeAssurance) flags.push("Sin Trade Assurance: riesgo de pago.");
    if (!s.odm) flags.push("ODM no confirmado: verifica capacidad de personalización.");
    if ((s.rating ?? 0) < 4) flags.push("Rating bajo: revisa reseñas y pide referencias.");

    const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
    const score = Math.round(total);
    Object.keys(breakdown).forEach((k) => (breakdown[k] = Math.round(breakdown[k] * 10) / 10));

    return { ...s, score, breakdown, flags };
  });

  return scored.sort((a, b) => b.score - a.score);
}
