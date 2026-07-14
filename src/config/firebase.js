import dotenv from 'dotenv'
dotenv.config()

import admin from 'firebase-admin'

if (!admin.apps.length) {
  const {
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
  } = process.env

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new Error(
      'Missing Firebase configuration. FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are required.'
    )
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:
        FIREBASE_PROJECT_ID,

      clientEmail:
        FIREBASE_CLIENT_EMAIL,

      privateKey:
        FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  })

}

export default admin
