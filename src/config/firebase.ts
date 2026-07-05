import admin from 'firebase-admin';
import { env } from './env';

let initialized = false;

export function getFirebaseAdmin(): admin.app.App {
  if (!initialized) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.firebasePrivateKey,
      }),
    });
    initialized = true;
  }
  return admin.app();
}

export function getMessaging(): admin.messaging.Messaging {
  return getFirebaseAdmin().messaging();
}
