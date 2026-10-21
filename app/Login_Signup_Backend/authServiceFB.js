"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, getFirestore, setDoc } from "firebase/firestore";
import firebaseConfig from "./firebase-config.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

export async function signUp(email, password, firstName = "", lastName = "", preferences = {}) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const displayName = `${firstName} ${lastName}`.trim();
  if (displayName) {
    await updateProfile(userCredential.user, { displayName });
  }
  await setDoc(doc(getFirestore(app), "users", userCredential.user.uid), {
    firstName,
    lastName,
    preferences,
  });
  return userCredential.user;
}

export async function logIn(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}
