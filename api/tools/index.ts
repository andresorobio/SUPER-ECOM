/**
 * Tool registry + dispatcher.
 *
 * Exposes:
 *   - `toolDefinitions`: all tools keyed by name.
 *   - `openAiToolSpecs` / `anthropicToolSpecs`: provider-shaped tool advertisements.
 *   - `runTool(name, args)`: executes a tool by name, with a safe fallback.
 */

import type { ToolDefinition, ToolResult } from "./types";
import { googleTrendsTool } from "./googleTrends";
import { alibabaSearchTool } from "./alibabaSearch";
import { amazonReviewsTool } from "./amazonReviews";
import { profitCalculatorTool } from "./profitCalculator";
import { complianceCheckTool } from "./complianceCheck";
import { competitorAdsTool } from "./competitorAds";

export const toolDefinitions: Record<string, ToolDefinition> = {
  google_trends_check: googleTrendsTool,
  alibaba_product_search: alibabaSearchTool,
  amazon_reviews_analyzer: amazonReviewsTool,
  profit_calculator: profitCalculatorTool,
  compliance_risk_check: complianceCheckTool,
  competitor_ad_spy: competitorAdsTool
};

/** OpenAI Chat Completions `tools` format. */
export const openAiToolSpecs = Object.values(toolDefinitions).map((t) => ({
  type: "function" as const,
  function: {
    name: t.schema.name,
    description: t.schema.description,
    parameters: t.schema.parameters
  }
}));

/** Anthropic Messages `tools` format. */
export const anthropicToolSpecs = Object.values(toolDefinitions).map((t) => ({
  name: t.schema.name,
  description: t.schema.description,
  input_schema: t.schema.parameters
}));

/** Execute a tool by name. Unknown tools return a structured error. */
export async function runTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const tool = toolDefinitions[name];
  if (!tool) {
    return { ok: false, error: `Unknown tool: ${name}` };
  }
  try {
    return await tool.execute(args as any);
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Tool execution failed" };
  }
}

export { googleTrendsTool, alibabaSearchTool, amazonReviewsTool };
export { profitCalculatorTool, complianceCheckTool, competitorAdsTool };
export type { ToolDefinition, ToolResult, JsonSchemaTool } from "./types";
