/**
 * Tool — shipping_estimator
 * Heuristic landed-shipping estimate (offline, no API key). Uses volumetric
 * weight, destination zone and risk flags to approximate per-unit shipping cost
 * and a recommended method. It is an ESTIMATE — wire a courier API for exact
 * rates in production.
 */

import type { ToolDefinition, ToolResult } from "./types";

export interface ShippingArgs {
  weight_kg: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  /** Destination zone. */
  destination?: "domestic" | "US" | "LATAM" | "EU" | "global";
  has_battery?: boolean;
  is_liquid?: boolean;
}

export interface ShippingData {
  billable_weight_kg: number;
  estimated_cost_usd: number;
  recommended_method: string;
  estimated_days: string;
  restrictions: string[];
}

// Rough per-kg rates (USD) by zone for small-parcel e-commerce freight.
const ZONE_RATE: Record<string, { perKg: number; base: number; days: string }> = {
  domestic: { perKg: 2.5, base: 2, days: "2-5" },
  US: { perKg: 6, base: 3, days: "7-15" },
  LATAM: { perKg: 7, base: 3.5, days: "10-20" },
  EU: { perKg: 7.5, base: 3.5, days: "8-18" },
  global: { perKg: 9, base: 4, days: "12-25" }
};

export const shippingEstimatorTool: ToolDefinition<ShippingArgs, ShippingData> = {
  schema: {
    name: "shipping_estimator",
    description:
      "Estima costo de envío por unidad (peso volumétrico, zona y restricciones) y método recomendado. Heurístico, no tarifa exacta.",
    parameters: {
      type: "object",
      properties: {
        weight_kg: { type: "number", description: "Actual weight in kg" },
        length_cm: { type: "number" },
        width_cm: { type: "number" },
        height_cm: { type: "number" },
        destination: {
          type: "string",
          description: "domestic | US | LATAM | EU | global"
        },
        has_battery: { type: "boolean" },
        is_liquid: { type: "boolean" }
      },
      required: ["weight_kg"]
    }
  },

  async execute(args): Promise<ToolResult<ShippingData>> {
    const {
      weight_kg,
      length_cm = 0,
      width_cm = 0,
      height_cm = 0,
      destination = "US",
      has_battery = false,
      is_liquid = false
    } = args ?? {};

    if (typeof weight_kg !== "number" || weight_kg <= 0) {
      return { ok: false, error: "weight_kg must be a positive number" };
    }

    // Volumetric weight (cm^3 / 5000 = kg) is the courier industry standard.
    const volumetric = (length_cm * width_cm * height_cm) / 5000;
    const billable = Math.max(weight_kg, volumetric);
    const billableRounded = Math.round(billable * 100) / 100;

    const zone = ZONE_RATE[destination] ?? ZONE_RATE.US;
    let cost = zone.base + billable * zone.perKg;

    const restrictions: string[] = [];
    if (has_battery) {
      cost *= 1.4; // surcharge + special handling
      restrictions.push("Batería: requiere courier con manejo de litio (UN38.3).");
    }
    if (is_liquid) {
      cost *= 1.25;
      restrictions.push("Líquido/aerosol: restricción aérea, confirmar con courier.");
    }

    const recommended_method =
      billable < 2
        ? "ePacket / correo prioritario"
        : billable < 10
          ? "Courier exprés (DHL/UPS) o carga consolidada"
          : "Carga aérea/marítima consolidada (3PL)";

    return {
      ok: true,
      data: {
        billable_weight_kg: billableRounded,
        estimated_cost_usd: Math.round(cost * 100) / 100,
        recommended_method,
        estimated_days: zone.days,
        restrictions
      },
      note: "Estimación heurística. Integra una API de courier para tarifas exactas."
    };
  }
};
