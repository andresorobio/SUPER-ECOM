/**
 * Deliverable 2 — Strict response schema for the ODM Sourcing Intelligence Agent.
 *
 * This file exposes BOTH:
 *   1. Pure TypeScript types (for the frontend & API typing).
 *   2. A Zod runtime validator (for parsing/validating the raw LLM JSON before
 *      it ever reaches the client).
 *
 * The shape mirrors exactly what the system prompt instructs the LLM to return,
 * so the frontend can consume it without any transformation.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Primitive enums                                                           */
/* -------------------------------------------------------------------------- */

export type Verdict = "Winner" | "Test" | "Discard";

/** The 10 binary criteria keys, in canonical order. */
export const CRITERIA_KEYS = [
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
] as const;

export type CriterionKey = (typeof CRITERIA_KEYS)[number];

/** Human-readable labels (Spanish) for the UI. */
export const CRITERIA_LABELS: Record<CriterionKey, string> = {
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

/* -------------------------------------------------------------------------- */
/*  TypeScript interfaces                                                      */
/* -------------------------------------------------------------------------- */

export interface CriterionResult {
  /** 0 (fail) or 1 (pass). */
  score: 0 | 1;
  /** Product-specific justification (max ~25 words). */
  reason: string;
}

export type CriteriaMap = Record<CriterionKey, CriterionResult>;

export interface ThreeStarHack {
  common_complaints: string[];
  /** The improved version/spec to request from the factory. */
  upgrade_to_demand: string;
}

export interface Sourcing {
  enabled: boolean;
  alibaba_keywords: string[];
  required_filters: string[];
  three_star_hack: ThreeStarHack;
  supplier_message_en: string;
  supplier_message_es: string;
  search_strategy: string;
}

export interface ProductAnalysis {
  product_name: string;
  /** Integer 0-10, equal to the sum of the 10 criteria scores. */
  score: number;
  verdict: Verdict;
  criteria: CriteriaMap;
  pros: string[];
  cons: string[];
  /** Max 3 lines bottom-line take. */
  quick_analysis: string;
  sourcing: Sourcing;
}

export interface AnalyzeResponse {
  success: boolean;
  analyses?: ProductAnalysis[];
  error?: string;
}

/* -------------------------------------------------------------------------- */
/*  Zod runtime validators                                                     */
/* -------------------------------------------------------------------------- */

const criterionSchema = z.object({
  score: z.union([z.literal(0), z.literal(1)]),
  reason: z.string().min(1)
});

const criteriaSchema = z.object({
  solves_problem: criterionSchema,
  market_validation: criterionSchema,
  ad_engagement: criterionSchema,
  evergreen: criterionSchema,
  margin_2_5x: criterionSchema,
  wow_effect: criterionSchema,
  odm_potential: criterionSchema,
  local_exclusivity: criterionSchema,
  logistics: criterionSchema,
  perceived_value: criterionSchema
});

const threeStarHackSchema = z.object({
  common_complaints: z.array(z.string()).default([]),
  upgrade_to_demand: z.string().default("")
});

const sourcingSchema = z.object({
  enabled: z.boolean(),
  alibaba_keywords: z.array(z.string()).default([]),
  required_filters: z.array(z.string()).default([
    "ODM",
    "R&D",
    "Verified Supplier",
    "Trade Assurance"
  ]),
  three_star_hack: threeStarHackSchema,
  supplier_message_en: z.string().default(""),
  supplier_message_es: z.string().default(""),
  search_strategy: z.string().default("")
});

export const productAnalysisSchema = z.object({
  product_name: z.string().min(1),
  score: z.number().int().min(0).max(10),
  verdict: z.enum(["Winner", "Test", "Discard"]),
  criteria: criteriaSchema,
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  quick_analysis: z.string(),
  sourcing: sourcingSchema
});

/** Either { analyses: [...] } or a bare array, or a single object. */
export const analysesEnvelopeSchema = z.union([
  z.object({ analyses: z.array(productAnalysisSchema) }),
  z.array(productAnalysisSchema),
  productAnalysisSchema
]);

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export function verdictFromScore(score: number): Verdict {
  if (score >= 8) return "Winner";
  if (score >= 6) return "Test";
  return "Discard";
}

/**
 * Normalize raw LLM JSON into a guaranteed-consistent ProductAnalysis[].
 * - Recomputes score from criteria (defends against LLM arithmetic drift).
 * - Re-derives verdict from score.
 * - Enforces sourcing.enabled === (score > 7) and clears sourcing if disabled.
 * Throws ZodError if the structural shape is invalid.
 */
export function normalizeAnalyses(raw: unknown): ProductAnalysis[] {
  const parsed = analysesEnvelopeSchema.parse(raw);

  let list: ProductAnalysis[];
  if (Array.isArray(parsed)) list = parsed as ProductAnalysis[];
  else if ("analyses" in parsed) list = parsed.analyses as ProductAnalysis[];
  else list = [parsed as ProductAnalysis];

  return list.map((a) => {
    const computedScore = CRITERIA_KEYS.reduce(
      (sum, key) => sum + a.criteria[key].score,
      0
    );
    const verdict = verdictFromScore(computedScore);
    const enabled = computedScore > 7;

    const sourcing: Sourcing = enabled
      ? {
          ...a.sourcing,
          enabled: true,
          required_filters:
            a.sourcing.required_filters?.length > 0
              ? a.sourcing.required_filters
              : ["ODM", "R&D", "Verified Supplier", "Trade Assurance"]
        }
      : {
          enabled: false,
          alibaba_keywords: [],
          required_filters: ["ODM", "R&D", "Verified Supplier", "Trade Assurance"],
          three_star_hack: { common_complaints: [], upgrade_to_demand: "" },
          supplier_message_en: "",
          supplier_message_es: "",
          search_strategy: ""
        };

    return { ...a, score: computedScore, verdict, sourcing };
  });
}
