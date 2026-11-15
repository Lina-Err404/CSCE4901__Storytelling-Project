import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabaseAdmin";
import { errorResponse, requireStoryAccess, serializeStory, UUID } from "@/lib/storyAccess";

type Context = { params: Promise<{ storyId: string }> };
export async function GET(request: NextRequest, context: Context) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const { storyId } = await context.params;
  if (!UUID.test(storyId)) return NextResponse.json({ error: "Invalid story ID." }, { status: 400 });
  try {
    const story = await requireStoryAccess(storyId, user);
    return NextResponse.json({ story: await serializeStory(story) });
  } catch (e) {
    const { status, error } = errorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
