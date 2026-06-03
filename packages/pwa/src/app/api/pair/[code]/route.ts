import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashKey, isValidCode } from "@/lib/codes";
import type { FokusConfig } from "@/lib/types";

export const runtime = "nodejs";

interface PairRow {
  code: string;
  key_hash: string;
  created_at: number;
  config: string | null;
}

function authorize(req: Request, row: PairRow): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  return hashKey(m[1]!.trim()) === row.key_hash;
}

function loadRow(code: string): PairRow | null {
  return (db()
    .prepare("SELECT code, key_hash, created_at, config FROM pairs WHERE code = ?")
    .get(code) as PairRow | undefined) ?? null;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const { code: raw } = await ctx.params;
  const code = raw.toUpperCase();
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "bad_code" }, { status: 400 });
  }
  const row = loadRow(code);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!authorize(req, row)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const config = row.config ? (JSON.parse(row.config) as FokusConfig) : null;
  return NextResponse.json({ config });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const { code: raw } = await ctx.params;
  const code = raw.toUpperCase();
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "bad_code" }, { status: 400 });
  }
  const row = loadRow(code);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!authorize(req, row)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { action?: string; config?: FokusConfig };
  if (body.action === "claim") {
    const config = row.config ? (JSON.parse(row.config) as FokusConfig) : null;
    return NextResponse.json({ config });
  }
  if (body.action === "push") {
    if (!body.config) {
      return NextResponse.json({ error: "missing_config" }, { status: 400 });
    }
    db()
      .prepare("UPDATE pairs SET config = ? WHERE code = ?")
      .run(JSON.stringify(body.config), code);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
