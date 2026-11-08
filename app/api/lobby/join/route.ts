// Backwards-compatible alias for callers using the original R12 endpoint.
// Express owns seat creation + the Socket.IO JWT; route through the proxy so
// all join paths share the exact same authenticated, atomic implementation.
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  return NextResponse.redirect(new URL("/api/backend/lobbies/join", request.url), 307);
}
