"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import firebaseConfig from "./Login_Signup_Backend/firebase-config.js";

const useAuthEmulator = process.env.NEXT_PUBLIC_USE_AUTH_EMULATOR === "true";
const requiredConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.appId,
];

const isConfigured = requiredConfig.every(Boolean);
let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (isConfigured) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  if (useAuthEmulator && typeof window !== "undefined") {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
}

export { app, auth };

export const authConfigurationMissing = !isConfigured;
