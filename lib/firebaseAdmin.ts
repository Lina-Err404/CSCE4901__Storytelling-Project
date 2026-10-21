import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

const credential =
  serviceAccountPath && fs.existsSync(serviceAccountPath)
    ? cert(JSON.parse(fs.readFileSync(serviceAccountPath, "utf8")))
    : applicationDefault();

const app =
  getApps().length === 0
    ? initializeApp({
        credential,
        projectId:
          process.env.FIREBASE_PROJECT_ID ?? "collab-storytelling-379cb",
      })
    : getApps()[0];

export const db = getFirestore(app);
export const adminAuth = getAuth(app);