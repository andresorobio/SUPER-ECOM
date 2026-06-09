/**
 * LLM provider abstraction with the full function-calling orchestration loop.
 *
 * Flow (Deliverable 5):
 *   1. Send system prompt + user products + tool specs to the LLM.
 *   2. If the LLM requests a tool, execute it (api/tools) and feed the result back.
 *   3. Loop until the LLM returns its final JSON (or MAX_TOOL_ROUNDS is hit).
 *   4. Return the raw JSON string for parsing/validation upstream.
 *
 * Supports Anthropic Claude and OpenAI GPT, selected via LLM_PROVIDER.
 * OpenAI uses `response_format: { type: "json_object" }` to guarantee JSON.
 */

import fs from "fs";
import path from "path";
import { config } from "@/lib/config";
import {
  openAiToolSpecs,
  anthropicToolSpecs,
  runTool
} from "@/api/tools";

const MAX_TOOL_ROUNDS = 4;

let cachedSystemPrompt: string | null = null;

export function getSystemPrompt(): string {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  try {
    const p = path.join(process.cwd(), "system_prompt.txt");
    cachedSystemPrompt = fs.readFileSync(p, "utf8");
  } catch {
    cachedSystemPrompt = FALLBACK_SYSTEM_PROMPT;
  }
  return cachedSystemPrompt;
}

export class LlmError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "LlmError";
  }
}

function buildUserMessage(products: string[]): string {
  return [
    "Analyze the following product(s) using the 10-criteria framework.",
    "Return a single JSON object: { \"analyses\": [ ...one object per product... ] }.",
    "Products:",
    ...products.map((p, i) => `${i + 1}. ${p}`)
  ].join("\n");
}

/** Public entry point used by the endpoint. Returns the raw JSON string. */
export async function analyzeWithLlm(products: string[]): Promise<string> {
  if (config.llm.provider === "openai") return runOpenAi(products);
  return runAnthropic(products);
}

/* ----------------------------- Anthropic ---------------------------------- */

async function runAnthropic(products: string[]): Promise<string> {
  if (!config.llm.anthropicApiKey) {
    throw new LlmError("ANTHROPIC_API_KEY is not configured", "NO_API_KEY");
  }
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({
    apiKey: config.llm.anthropicApiKey,
    timeout: config.llm.timeoutMs
  });

  const system = getSystemPrompt();
  const messages: any[] = [
    { role: "user", content: buildUserMessage(products) }
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: config.llm.model,
      max_tokens: config.llm.maxTokens,
      system,
      tools: anthropicToolSpecs as any,
      messages
    });

    const toolUses = response.content.filter((c: any) => c.type === "tool_use");

    if (toolUses.length === 0) {
      const text = response.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("");
      return extractJson(text);
    }

    // Execute every requested tool and feed results back.
    messages.push({ role: "assistant", content: response.content });
    const toolResults = [];
    for (const tu of toolUses as any[]) {
      const result = await runTool(tu.name, tu.input ?? {});
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(result)
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  throw new LlmError("Exceeded max tool rounds without final answer", "TOOL_LOOP");
}

/* ------------------------------- OpenAI ----------------------------------- */

async function runOpenAi(products: string[]): Promise<string> {
  if (!config.llm.openaiApiKey) {
    throw new LlmError("OPENAI_API_KEY is not configured", "NO_API_KEY");
  }
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({
    apiKey: config.llm.openaiApiKey,
    timeout: config.llm.timeoutMs
  });

  const messages: any[] = [
    { role: "system", content: getSystemPrompt() },
    { role: "user", content: buildUserMessage(products) }
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await client.chat.completions.create({
      model: config.llm.model,
      messages,
      tools: openAiToolSpecs as any,
      // Guarantees pure JSON on the final (non-tool) message.
      response_format: { type: "json_object" }
    });

    const choice = completion.choices[0];
    const msg = choice.message;

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push(msg);
      for (const call of msg.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          /* malformed args -> empty */
        }
        const result = await runTool(call.function.name, args);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result)
        });
      }
      continue;
    }

    return extractJson(msg.content ?? "");
  }

  throw new LlmError("Exceeded max tool rounds without final answer", "TOOL_LOOP");
}

/* ------------------------------ Helpers ----------------------------------- */

/** Strip accidental markdown fences and isolate the JSON object. */
export function extractJson(text: string): string {
  let t = text.trim();
  // Remove ```json ... ``` fences if the model added them.
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  // If extra prose surrounds it, slice from first { to last }.
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    t = t.slice(first, last + 1);
  }
  return t.trim();
}

const FALLBACK_SYSTEM_PROMPT =
  "You are ODM Scout. Score each product on 10 binary criteria and return ONLY valid JSON " +
  '{ "analyses": [...] } with no markdown. Enable sourcing only when score > 7.';
