/**
 * Tool — profit_calculator
 * Computes unit economics, break-even ROAS/CPA and a recommended price.
 * Pure logic: always available, never needs an API key, never fabricates data.
 */

import { computeProfit, type ProfitInput } from "@/lib/profit";
import type { ToolDefinition, ToolResult } from "./types";

export const profitCalculatorTool: ToolDefinition<ProfitInput, ReturnType<typeof computeProfit>> = {
  schema: {
    name: "profit_calculator",
    description:
      "Calcula economía unitaria: costo landed, comisiones, margen de contribución, ROAS y CPA de equilibrio, y precio recomendado.",
    parameters: {
      type: "object",
      properties: {
        productCost: { type: "number", description: "Supplier unit cost (FOB)" },
        shippingCost: { type: "number", description: "Per-unit shipping cost" },
        sellingPrice: { type: "number", description: "Intended retail price (optional)" },
        platformFeePct: { type: "number", description: "Marketplace fee fraction 0-1" },
        paymentFeePct: { type: "number", description: "Payment processor fee fraction 0-1" },
        fixedCostPerOrder: { type: "number", description: "Flat per-order cost" },
        adSpendPerUnit: { type: "number", description: "Average CPA per sale (optional)" },
        targetMarginPct: { type: "number", description: "Target gross margin fraction 0-1" },
        priceMultiplier: { type: "number", description: "Markup multiplier on landed cost" }
      },
      required: ["productCost"]
    }
  },

  async execute(args): Promise<ToolResult<ReturnType<typeof computeProfit>>> {
    if (typeof args?.productCost !== "number" || args.productCost <= 0) {
      return { ok: false, error: "productCost must be a positive number" };
    }
    try {
      return { ok: true, data: computeProfit(args) };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? "profit calculation failed" };
    }
  }
};
