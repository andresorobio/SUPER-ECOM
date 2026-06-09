/**
 * Deliverable 5 — Shared tool typing & registry contract.
 *
 * Each tool exposes:
 *   - a JSON-schema description (provider-agnostic) used to advertise it to the LLM
 *   - an async `execute(args)` implementation that calls the real external API
 *
 * Tools degrade gracefully: when their API key is absent, they return a
 * clearly-flagged `unavailable` result (NEVER fabricated data) so the agent
 * can reason qualitatively instead of inventing numbers.
 */

export interface JsonSchemaTool {
  name: string;
  description: string;
  /** JSON Schema for the input arguments (OpenAI/Anthropic compatible). */
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface ToolResult<T = unknown> {
  ok: boolean;
  /** true when the external data source is not configured/reachable. */
  unavailable?: boolean;
  data?: T;
  error?: string;
  /** Human-readable note injected back to the LLM for transparency. */
  note?: string;
}

export interface ToolDefinition<TArgs = any, TData = any> {
  schema: JsonSchemaTool;
  execute: (args: TArgs) => Promise<ToolResult<TData>>;
}
