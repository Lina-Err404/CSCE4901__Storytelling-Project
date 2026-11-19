// R14 – Teacher Review backend (Supabase).
// A story is made of story_segments, one per student section.
// Teachers leave feedback and approve each segment; that is stored in
// segment_feedback (one row per segment).
//
// Tables (designed by DA):
//   story_segments(segment_id, story_id, student_id, section, section_order,
//                  segment_title, writing_content)
//   segment_feedback(feedback_id, segment_id, teacher_id, body,
//                    status, approved_at, created_at, updated_at)
//
// status is "pending" | "approved". The class library (R11) can treat a story
// as approved when every one of its segments is approved.
import { supabase } from "./supabase";

export type ReviewStatus = "pending" | "approved";

export type Segment = {
  id: string;
  studentId: string | null;
  section: string;
  order: number;
  title: string;
  content: string;
  feedback: string;
  status: ReviewStatus;
};

type FeedbackRow = { body: string | null; status: string | null };

// Load all segments of a story (in order) with their feedback and status.
// Returns an empty list if the story has no segments. This function only reads.
export async function loadSegments(storyId: string): Promise<Segment[]> {
  const { data, error } = await supabase
    .from("story_segments")
    .select(
      "segment_id, student_id, section, section_order, segment_title, writing_content, segment_feedback(body, status)"
    )
    .eq("story_id", storyId)
    .order("section_order", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => {
    // segment_feedback comes back as a list (or a single object); use the first.
    const raw = row.segment_feedback as FeedbackRow[] | FeedbackRow | null;
    const fb = Array.isArray(raw) ? raw[0] : raw;
    return {
      id: row.segment_id,
      studentId: row.student_id ?? null,
      section: row.section ?? "",
      order: row.section_order ?? 0,
      title: row.segment_title ?? "",
      content: row.writing_content ?? "",
      feedback: fb?.body ?? "",
      status: fb?.status === "approved" ? "approved" : "pending",
    };
  });
}

// Save the teacher's feedback for one segment (must not be empty).
// Creates the feedback row the first time, then updates it after that.
export async function saveFeedback(
  segmentId: string,
  teacherId: string,
  body: string
) {
  const { error } = await supabase.from("segment_feedback").upsert(
    {
      segment_id: segmentId,
      teacher_id: teacherId,
      body,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "segment_id" }
  );

  if (error) throw error;
}

// Mark one segment as approved.
// The segment must already have saved feedback (DA's table requires a
// non-empty feedback body), so this only updates the existing row.
export async function approveSegment(segmentId: string, teacherId: string) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("segment_feedback")
    .update({
      teacher_id: teacherId,
      status: "approved",
      approved_at: now,
      updated_at: now,
    })
    .eq("segment_id", segmentId)
    .select("feedback_id");

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Save feedback for this part before approving it.");
  }
}
