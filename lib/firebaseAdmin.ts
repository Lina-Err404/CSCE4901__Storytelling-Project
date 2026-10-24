import dotenv from "dotenv";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

if (
  process.env.NODE_ENV !== "production" &&
  process.env.USE_FIRESTORE_EMULATOR !== "false"
) {
  process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
}

if (
  process.env.NODE_ENV !== "production" &&
  process.env.USE_AUTH_EMULATOR !== "false"
) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
}

function getFirebaseApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const rawServiceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const resolvedServiceAccountPath =
    rawServiceAccountPath && !path.isAbsolute(rawServiceAccountPath)
      ? path.resolve(/*turbopackIgnore: true*/ process.cwd(), rawServiceAccountPath)
      : rawServiceAccountPath;

  if (resolvedServiceAccountPath) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = resolvedServiceAccountPath;
  }

  const usingEmulator = Boolean(
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||
      process.env.FIRESTORE_EMULATOR_HOST
  );

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    (usingEmulator ? "demo-storytelling" : "collab-storytelling-379cb");

  if (
    resolvedServiceAccountPath &&
    fs.existsSync(/*turbopackIgnore: true*/ resolvedServiceAccountPath)
  ) {
    return initializeApp({
      credential: cert(
        JSON.parse(
          fs.readFileSync(
            /*turbopackIgnore: true*/ resolvedServiceAccountPath,
            "utf8"
          )
        )
      ),
      projectId,
    });
  }

  if (usingEmulator) {
    return initializeApp({ projectId });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

export function getDb(): Firestore {
  return getFirestore(getFirebaseApp());
}

export function getAdminAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export const db = getDb();
export const adminAuth = getAdminAuth();