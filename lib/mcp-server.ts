/**
 * Deliverable 3B / 9 — Model Context Protocol (MCP) server.
 *
 * Registers the ODM Sourcing agent as an MCP server so a parent orchestrator
 * can call it as a subagent. Exposes three tools:
 *
 *   - evaluate_product(name: string)                         -> ProductAnalysis JSON
 *   - generate_supplier_message(product, improvements[])     -> { en, es }
 *   - search_alibaba_keywords(product: string)               -> string[]
 *
 * Transport: stdio (the standard way to register an MCP server in clients).
 *
 * --------------------------------------------------------------------------
 * How a parent orchestrator registers this server (e.g. Claude Desktop, or any
 * MCP-compatible platform). Add to the host's `mcp_servers` config:
 *
 *   {
 *     "mcpServers": {
 *       "odm-sourcing-agent": {
 *         "command": "npx",
 *         "args": ["tsx", "lib/mcp-server.ts"],
 *         "cwd": "/absolute/path/to/dropship-intel-agent",
 *         "env": {
 *           "LLM_PROVIDER": "anthropic",
 *           "ANTHROPIC_API_KEY": "sk-ant-...",
 *           "LLM_MODEL": "claude-opus-4-6"
 *         }
 *       }
 *     }
 *   }
 *
 * The orchestrator then sees the three tools and can invoke this agent as a
 * subagent inside a larger multi-agent workflow.
 * --------------------------------------------------------------------------
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import {
  evaluateProduct,
  generateSupplierMessage,
  searchAlibabaKeywords
} from "@/lib/agent-tools";

const server = new Server(
  { name: "odm-sourcing-agent", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const TOOLS = [
  {
    name: "evaluate_product",
    description:
      "Evaluate a product against the 10-point winning-product framework and return the full ProductAnalysis JSON (score, verdict, criteria, pros/cons, sourcing).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Product name to evaluate" }
      },
      required: ["name"]
    }
  },
  {
    name: "generate_supplier_message",
    description:
      "Generate a copy-paste-ready Alibaba supplier inquiry (English + Spanish) for a product, optionally incorporating requested improvements/upgrades.",
    inputSchema: {
      type: "object",
      properties: {
        product: { type: "string", description: "Product name" },
        improvements: {
          type: "array",
          items: { type: "string" },
          description: "Upgrade specs to demand from the factory"
        }
      },
      required: ["product"]
    }
  },
  {
    name: "search_alibaba_keywords",
    description:
      "Return 5 optimized Alibaba search keyword strings (with ODM/OEM modifier keywords) for a product.",
    inputSchema: {
      type: "object",
      properties: {
        product: { type: "string", description: "Product name" }
      },
      required: ["product"]
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, any>;

  try {
    switch (name) {
      case "evaluate_product": {
        if (!a.name) throw new Error("Missing required argument: name");
        const analysis = await evaluateProduct(String(a.name));
        return {
          content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }]
        };
      }
      case "generate_supplier_message": {
        if (!a.product) throw new Error("Missing required argument: product");
        const msg = generateSupplierMessage(
          String(a.product),
          Array.isArray(a.improvements) ? a.improvements.map(String) : []
        );
        return {
          content: [{ type: "text", text: JSON.stringify(msg, null, 2) }]
        };
      }
      case "search_alibaba_keywords": {
        if (!a.product) throw new Error("Missing required argument: product");
        const keywords = searchAlibabaKeywords(String(a.product));
        return {
          content: [{ type: "text", text: JSON.stringify(keywords, null, 2) }]
        };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err: any) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${err?.message ?? "tool failed"}` }]
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console
  console.error("odm-sourcing-agent MCP server running on stdio");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal MCP server error:", err);
  process.exit(1);
});
