import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, getSupabaseAdmin, isTeacher } from "@/lib/supabaseAdmin";
import { errorResponse, UUID } from "@/lib/storyAccess";

type Context = { params: Promise<{ storyId: string }> };
export async function PUT(request: NextRequest, context: Context) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if ((await isTeacher(user))) return NextResponse.json({ error: "Teachers cannot modify student sections." }, { status: 403 });
  const { storyId } = await context.params;
  if (!UUID.test(storyId)) return NextResponse.json({ error: "Invalid story ID." }, { status: 400 });
  const body = await request.json().catch(() => null);
  if (typeof body?.content !== "string" || body.content.length > 10000) {
    return NextResponse.json({ error: "Content must be 10,000 characters or less." }, { status: 400 });
  }
  try {
    // RPC locks the story and checks participation, current group and approval status.
    const { error } = await getSupabaseAdmin().rpc("r12_save_story_section", {
      p_story_id: storyId, p_student_id: user.id, p_content: body.content,
    });
    if (error) {
      if (error.code === "P0001" || error.code === "23514") {
        return NextResponse.json({ error: "You cannot edit this story now." }, { status: 403 });
      }
      throw error;
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    const { status, error } = errorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
