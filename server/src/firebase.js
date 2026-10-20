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

const app = admin.apps.length
  ? admin.app()
  : admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore(app);

module.exports = { admin, db };