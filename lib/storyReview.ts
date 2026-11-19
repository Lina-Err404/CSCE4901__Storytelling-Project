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
// Keep the ReviewStatus values stable so R11 can rely on them.
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

function storyRef(storyId: string) {
  return doc(db, "stories", storyId);
}

// Load a completed story and its current review status.
// Returns null if the story does not exist. This function only reads.
export async function loadStory(storyId: string): Promise<Story | null> {
  const snapshot = await getDoc(storyRef(storyId));

  if (!snapshot.exists()) {
    return null;
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

// Save the teacher's feedback for a story. An empty string clears it.
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

// Development only: creates a sample story to review.
// Never called automatically; run it on purpose when you need test data.
export async function seedSampleStory(storyId = "story-1") {
  await setDoc(storyRef(storyId), {
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
    createdAt: serverTimestamp(),
  });
}
