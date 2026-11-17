import { supabase } from "../src/app/Login_Signup_Backend/supabase-client";

export type ReviewStatus = "pending" | "approved";

export type Story = {
  id: string;
  title: string;
  group: string;
  authors: string;
  text: string[];
  feedback: string;
  status: ReviewStatus;
};

function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

// Load a completed story and its current review status.
// Returns null if the story does not exist. This function only reads.
export async function loadStory(storyId: string): Promise<Story | null> {
  const { data, error } = await requireSupabase()
    .from("stories")
    .select("story_id, title, group, authors, text, feedback, status")
    .eq("story_id", storyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.story_id,
    title: data.title ?? "",
    group: data.group ?? "",
    authors: data.authors ?? "",
    text: Array.isArray(data.text) ? data.text : [],
    feedback: data.feedback ?? "",
    status: data.status === "approved" ? "approved" : "pending",
  };
}

// Save the teacher's feedback for a story. An empty string clears it.
export async function saveFeedback(storyId: string, feedback: string) {
  const { error } = await requireSupabase()
    .from("stories")
    .update({ feedback, feedback_updated_at: new Date().toISOString() })
    .eq("story_id", storyId);
  if (error) throw error;
}

// Mark a story as approved so it can be added to the class library.
export async function approveStory(storyId: string) {
  const { error } = await requireSupabase()
    .from("stories")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("story_id", storyId);
  if (error) throw error;
}

// Development only: creates a sample story to review.
// Never called automatically; run it on purpose when you need test data.
export async function seedSampleStory(storyId = "story-1") {
  const { error } = await requireSupabase().from("stories").upsert({
    story_id: storyId,
    title: "The Secret Door",
    group: "Group 1",
    authors: "Heather, Marcus, and Sam",
    text: [
      "Maya found a tiny golden key beneath the library window. Attached to it was a note: Find the door that nobody sees.",
      "She asked her friends to help. Together, they discovered a door hidden behind a shelf of dusty books. The key fit perfectly.",
      "Inside was a garden filled with glowing flowers. They decided to protect its secret and return every afternoon for a new adventure.",
    ],
    feedback: "",
    status: "pending",
  });
  if (error) throw error;
}
