const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (
  process.env.NODE_ENV !== 'production' &&
  process.env.USE_FIRESTORE_EMULATOR !== 'false'
) {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
}
if (
  process.env.NODE_ENV !== 'production' &&
  process.env.USE_AUTH_EMULATOR !== 'false'
) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
}

const admin = require('firebase-admin');
const projectRoot = path.resolve(__dirname, '../..');

if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !path.isAbsolute(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
    projectRoot,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}

const projectId = process.env.GCLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-storytelling';
const emulating = process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIREBASE_EMULATOR_HOST

let options;
if (emulating) {
  options = { projectId };
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  options = {
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  };
} else {
  options = { credential: admin.credential.applicationDefault(), projectId }
}
const app = admin.apps.length ? admin.app() : admin.initializeApp(options);
const db = admin.firestore(app);

module.exports = { admin, db };