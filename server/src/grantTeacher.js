const { admin } = require('./firebase');

async function grantTeacher(uid) {
  if (typeof uid !== 'string' || uid.length < 1 || uid.length > 128) {
    throw new Error('Pass a Firebase Auth UID as the first argument');
  }

  const projectId = process.env.GCLOUD_PROJECT || 'demo-storytelling';
  const app = admin.apps.find((candidate) => candidate.name === '[DEFAULT]')
    || admin.initializeApp({ projectId });
  const user = await admin.auth(app).getUser(uid);
  await admin.auth(app).setCustomUserClaims(uid, {
    ...user.customClaims,
    role: 'teacher',
  });
  console.log(`Granted teacher role to ${uid}`);
}

grantTeacher(process.argv[2]).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});