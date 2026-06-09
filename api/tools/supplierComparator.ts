/**
 * Tool — supplier_comparator
 * Scores and ranks candidate ODM suppliers on a weighted rubric (offline).
 */

import { scoreSuppliers, type SupplierInput, type ScoredSupplier } from "@/lib/suppliers";
import type { ToolDefinition, ToolResult } from "./types";

export interface SupplierComparatorArgs {
  suppliers: SupplierInput[];
}

export const supplierComparatorTool: ToolDefinition<
  SupplierComparatorArgs,
  { ranked: ScoredSupplier[]; best: ScoredSupplier | null }
> = {
  schema: {
    name: "supplier_comparator",
    description:
      "Puntúa y ordena proveedores ODM candidatos por rating, verificación, Trade Assurance, ODM, experiencia, MOQ y precio.",
    parameters: {
      type: "object",
      properties: {
        suppliers: {
          type: "array",
          description: "Array of supplier objects to compare",
          items: { type: "object" }
        }
      },
      required: ["suppliers"]
    }
  },

  async execute(args): Promise<ToolResult<{ ranked: ScoredSupplier[]; best: ScoredSupplier | null }>> {
    if (!Array.isArray(args?.suppliers) || args.suppliers.length === 0) {
      return { ok: false, error: "Provide a non-empty 'suppliers' array" };
    }
    const ranked = scoreSuppliers(args.suppliers);
    return { ok: true, data: { ranked, best: ranked[0] ?? null } };
  }
};
