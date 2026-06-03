import { NextResponse } from "next/server";
import { db, purgeExpired } from "@/lib/db";
import { generateCode, generateKey, hashKey, CODE_TTL_MS } from "@/lib/codes";

export const runtime = "nodejs";

const RATE_PER_HOUR = 10;

function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function rateLimit(ip: string): boolean {
  const handle = db();
  const cutoff = Date.now() - 60 * 60 * 1000;
  handle.prepare("DELETE FROM rate WHERE ts < ?").run(cutoff);
  const row = handle
    .prepare("SELECT COUNT(*) AS n FROM rate WHERE ip = ? AND ts >= ?")
    .get(ip, cutoff) as { n: number };
  if (row.n >= RATE_PER_HOUR) return false;
  handle.prepare("INSERT INTO rate (ip, ts) VALUES (?, ?)").run(ip, Date.now());
  return true;
}

export async function POST(req: Request): Promise<NextResponse> {
  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  purgeExpired(CODE_TTL_MS);

  // Try a few times in case of code collision (very unlikely).
  const handle = db();
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    const key = generateKey();
    try {
      handle
        .prepare("INSERT INTO pairs (code, key_hash, created_at, config) VALUES (?, ?, ?, NULL)")
        .run(code, hashKey(key), Date.now());
      return NextResponse.json({
        code,
        key,
        expiresAt: Date.now() + CODE_TTL_MS,
      });
    } catch {
      // collision, retry
    }
  }
  return NextResponse.json({ error: "could_not_allocate" }, { status: 500 });
}
