// R14 – Teacher Review backend.
// Loads a completed story with its review status, and saves the teacher's
// feedback and approval to Firestore so they stay after a page refresh.
//
// Firestore layout:
//   stories/{storyId}
//     title, group, authors, text[]   – the story itself
//     feedback                        – teacher feedback ("" if none yet)
//     status                          – "pending" | "approved"
//     feedbackUpdatedAt, approvedAt   – timestamps
//
// The class library (R11) should only show stories where status == "approved".
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

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

// Sample story used to create the first document if it doesn't exist yet.
// Remove this once real completed stories are being saved by the writing flow.
const SAMPLE_STORY = {
  title: "The Secret Door",
  group: "Group 1",
  authors: "Heather, Marcus, and Sam",
  text: [
    "Maya found a tiny golden key beneath the library window. Attached to it was a note: Find the door that nobody sees.",
    "She asked her friends to help. Together, they discovered a door hidden behind a shelf of dusty books. The key fit perfectly.",
    "Inside was a garden filled with glowing flowers. They decided to protect its secret and return every afternoon for a new adventure.",
  ],
};

function storyRef(storyId: string) {
  return doc(db, "stories", storyId);
}

// Load a completed story and its current review status.
export async function loadStory(storyId: string): Promise<Story> {
  const ref = storyRef(storyId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    // First run: create the sample story so there is something to review.
    await setDoc(ref, {
      ...SAMPLE_STORY,
      feedback: "",
      status: "pending",
      createdAt: serverTimestamp(),
    });
    return { id: storyId, ...SAMPLE_STORY, feedback: "", status: "pending" };
  }

  const data = snapshot.data();
  return {
    id: storyId,
    title: data.title ?? "",
    group: data.group ?? "",
    authors: data.authors ?? "",
    text: Array.isArray(data.text) ? data.text : [],
    feedback: data.feedback ?? "",
    status: data.status === "approved" ? "approved" : "pending",
  };
}

// Save the teacher's feedback for a story.
export async function saveFeedback(storyId: string, feedback: string) {
  await updateDoc(storyRef(storyId), {
    feedback,
    feedbackUpdatedAt: serverTimestamp(),
  });
}

// Mark a story as approved so it can be added to the class library.
export async function approveStory(storyId: string) {
  await updateDoc(storyRef(storyId), {
    status: "approved",
    approvedAt: serverTimestamp(),
  });
}
