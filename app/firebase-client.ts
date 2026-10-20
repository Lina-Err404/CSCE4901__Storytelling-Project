"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";

const useAuthEmulator = process.env.NEXT_PUBLIC_USE_AUTH_EMULATOR === "true";
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || (useAuthEmulator ? "demo-api-key" : ""),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || (useAuthEmulator ? "demo-storytelling.firebaseapp.com" : ""),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || (useAuthEmulator ? "demo-storytelling" : ""),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || (useAuthEmulator ? "1:1234567890:web:demo-storytelling" : ""),
};

const isConfigured = Object.values(firebaseConfig).every(Boolean);
let auth: Auth | null = null;

if (isConfigured) {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  if (useAuthEmulator && typeof window !== "undefined") {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
}

export { auth };

export const authConfigurationMissing = !isConfigured;