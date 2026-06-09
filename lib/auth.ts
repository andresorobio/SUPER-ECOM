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
