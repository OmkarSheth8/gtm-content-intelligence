import { NextResponse } from "next/server";

// BigInt fields (views, likes, comments, shares, etc.) cannot be serialized by
// JSON.stringify natively — it throws "Do not know how to serialize a BigInt".
// Database schema intentionally uses BigInt for platform metric counts because
// they can exceed PostgreSQL INTEGER limits (2.1B). See docs/scale-notes.md.
//
// This helper recursively converts BigInt values to strings before any JSON
// response. Strings are used (not numbers) to preserve full precision for
// values that would exceed Number.MAX_SAFE_INTEGER (9 quadrillion, well within
// BigInt's 9.2 quintillion range but outside IEEE 754 double precision).

function serializeValue(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        serializeValue(v),
      ])
    );
  }
  return value;
}

export function serializeForJson(data: unknown): unknown {
  return serializeValue(data);
}

// Drop-in replacement for NextResponse.json() that handles BigInt fields.
// Use this everywhere you return Prisma data in an API route.
export function jsonResponse(
  data: unknown,
  init?: ResponseInit
): NextResponse {
  return NextResponse.json(serializeForJson(data), init);
}