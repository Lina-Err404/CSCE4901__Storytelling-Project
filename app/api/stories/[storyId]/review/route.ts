import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, getSupabaseAdmin, isTeacher } from "@/lib/supabaseAdmin";
import { AccessError, errorResponse, requireStoryAccess, serializeStory, UUID } from "@/lib/storyAccess";
type Context = { params: Promise<{ storyId: string }> };
export async function PATCH(request: NextRequest, context: Context) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Sign in is required" }, { status: 401 });
  if (!(await isTeacher(user))) return NextResponse.json({ error: "Teacher access required" }, { status: 403 });
  const { storyId } = await context.params;
  if (!UUID.test(storyId)) return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      !((typeof body.feedback === "string" && body.feedback.length <= 10000) || body.approve === true) ||
      (body.feedback !== undefined && (typeof body.feedback !== "string" || body.feedback.length > 10000)) ||
      (body.approve !== undefined && body.approve !== true)) {
    return NextResponse.json({ error: "Invalid review update" }, { status: 400 });
  }
  try {
    await requireStoryAccess(storyId, user);
    const { error } = await getSupabaseAdmin().rpc("r12_review_story", {
      p_story_id: storyId, p_teacher_id: user.id,
      p_feedback: typeof body.feedback === "string" ? body.feedback : null,
      p_approve: body.approve === true,
    });
    if (error) {
      if (error.code === "P0001") throw new AccessError(error.message, 409);
      throw error;
    }
    const story = await requireStoryAccess(storyId, user);
    return NextResponse.json({ story: await serializeStory(story) });
  } catch (e) {
    const { status, error } = errorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
