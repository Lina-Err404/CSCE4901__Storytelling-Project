"use client";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, getFirestore, setDoc } from "firebase/firestore";
import { app, auth } from "../firebase-client";

export async function signUp(email, password, firstName = "", lastName = "", preferences = {}) {
  if (!auth || !app) {
    throw new Error("Firebase is not configured. Set the NEXT_PUBLIC_FIREBASE_* values and restart the app.");
  }
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const displayName = `${firstName} ${lastName}`.trim();
  if (displayName) {
    await updateProfile(userCredential.user, { displayName });
  }
  try {
    await setDoc(doc(getFirestore(app), "users", userCredential.user.uid), {
      firstName,
      lastName,
      preferences,
    });
  } catch {
    // Allow sign-up to complete even if direct client Firestore writes are restricted by rules.
  }
  return userCredential.user;
}

export async function logIn(email, password) {
  if (!auth) {
    throw new Error("Firebase is not configured. Set the NEXT_PUBLIC_FIREBASE_* values and restart the app.");
  }
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}
