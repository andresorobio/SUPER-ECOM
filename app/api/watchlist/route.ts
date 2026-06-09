/**
 * Watchlist API (requires DATABASE_URL).
 *   GET    /api/watchlist                 -> { success, items }
 *   POST   /api/watchlist  { product_name, notes? }  -> { success, item }
 *   DELETE /api/watchlist?id=<uuid>       -> { success }
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticate, AuthError } from "@/lib/auth";
import {
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
  isDbConfigured
} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function auth(req: NextRequest) {
  return authenticate(req.headers.get("authorization"));
}

function guardDb() {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { success: false, error: "Persistence not configured (set DATABASE_URL)" },
      { status: 501 }
    );
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const user = auth(req);
    const dbErr = guardDb();
    if (dbErr) return dbErr;
    const items = await getWatchlist(user.userId);
    return NextResponse.json({ success: true, items });
  } catch (err) {
    return errResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = auth(req);
    const dbErr = guardDb();
    if (dbErr) return dbErr;
    const body = await req.json().catch(() => null);
    if (!body?.product_name) {
      return NextResponse.json(
        { success: false, error: "product_name is required" },
        { status: 400 }
      );
    }
    const item = await addToWatchlist(
      user.userId,
      String(body.product_name),
      typeof body.notes === "string" ? body.notes : ""
    );
    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (err) {
    return errResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = auth(req);
    const dbErr = guardDb();
    if (dbErr) return dbErr;
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }
    const removed = await removeFromWatchlist(user.userId, id);
    return NextResponse.json({ success: removed });
  } catch (err) {
    return errResponse(err);
  }
}

function errResponse(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json({ success: false, error: err.message }, { status: 401 });
  }
  return NextResponse.json(
    { success: false, error: (err as any)?.message ?? "Request failed" },
    { status: 500 }
  );
}
