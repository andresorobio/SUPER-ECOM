/**
 * Minimal JWT verification helper for the protected endpoint.
 * Expects an `Authorization: Bearer <token>` header.
 */

import jwt from "jsonwebtoken";
import { config } from "@/lib/config";

export interface AuthUser {
  userId: string;
  [claim: string]: unknown;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/** Extract and verify the bearer token. Throws AuthError on failure. */
export function authenticate(authorizationHeader?: string | null): AuthUser {
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    throw new AuthError("Missing or malformed Authorization header");
  }
  const token = authorizationHeader.slice("Bearer ".length).trim();

  // Path 1 — static API keys (for server-to-server / integrations).
  // Configure as: API_KEYS="key1:userId1,key2:userId2"
  const apiUser = resolveApiKey(token);
  if (apiUser) return { userId: apiUser, auth: "api_key" };

  // Path 2 — JWT bearer.
  try {
    const payload = jwt.verify(token, config.infra.jwtSecret) as Record<
      string,
      unknown
    >;
    const userId =
      (payload.userId as string) ??
      (payload.sub as string) ??
      (payload.id as string);
    if (!userId) throw new AuthError("Token has no user identifier");
    return { userId, ...payload };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError("Invalid or expired token");
  }
}

/** Map an API key to a userId using the API_KEYS env var. Returns null if none. */
function resolveApiKey(token: string): string | null {
  const raw = process.env.API_KEYS;
  if (!raw) return null;
  for (const pair of raw.split(",")) {
    const [key, userId] = pair.split(":").map((s) => s.trim());
    if (key && userId && key === token) return userId;
  }
  return null;
}
