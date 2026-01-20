const admin = require("firebase-admin");

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  throw new Error("FIREBASE_* faltando no .env");
}

privateKey = privateKey.replace(/\\n/g, "\n");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

async function verifyFirebaseToken(idToken) {
  const decoded = await admin.auth().verifyIdToken(idToken);
  return decoded; // { uid, email, name?, picture?, ... }
}

module.exports = { verifyFirebaseToken };
