import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, getUserRole } from "@/lib/supabaseAdmin";
export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    return NextResponse.json({ role: await getUserRole(user) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Profile lookup failed", error);
    return NextResponse.json({ error: "Could not load account permissions" }, { status: 500 });
  }
}
