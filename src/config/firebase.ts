import admin from 'firebase-admin';

let firebaseApp: admin.app.App | null = null;

/**
 * `.env.example` ships placeholder values such as "your-firebase-project-id".
 * Those are truthy, so a plain presence check silently accepts them and the
 * failure only surfaces later as an opaque credential error. Reject them here.
 */
const isPlaceholder = (value?: string): boolean =>
  !value ||
  value.trim().length === 0 ||
  /^your[-_]/i.test(value.trim()) ||
  /^(placeholder|changeme|todo|xxx)$/i.test(value.trim());

/** Why initialization did not happen. Never contains any credential material. */
let lastSkipReason: string | null = null;

export const initializeFirebase = (): void => {
  // Idempotent: repeated calls (e.g. a legacy entrypoint delegating here) must
  // not attempt a second admin.initializeApp().
  if (firebaseApp) {
    return;
  }

  try {
    // Check if Firebase credentials are available
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (isPlaceholder(projectId) || isPlaceholder(clientEmail) || !privateKey) {
      const missing = [
        isPlaceholder(projectId) ? 'FIREBASE_PROJECT_ID' : null,
        isPlaceholder(clientEmail) ? 'FIREBASE_CLIENT_EMAIL' : null,
        !privateKey ? 'FIREBASE_PRIVATE_KEY' : null,
      ].filter(Boolean);

      lastSkipReason = `missing or placeholder: ${missing.join(', ')}`;
      console.warn(
        `⚠️ Firebase credentials not configured (${missing.join(', ')}). ` +
          'Push notifications will be skipped; in-app notifications still work.',
      );
      return;
    }

    // A real service-account key is a PEM block. Detecting this here avoids a
    // confusing downstream error from admin.credential.cert().
    if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
      lastSkipReason = 'FIREBASE_PRIVATE_KEY is not a well-formed PEM block';
      console.warn(
        '⚠️ FIREBASE_PRIVATE_KEY is not a PEM private key (expected a ' +
          '"-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----" block, with literal \\n ' +
          'escapes if stored on one line). Push notifications will be skipped.',
      );
      return;
    }

    const serviceAccount = {
      projectId,
      privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
      privateKey,
      clientEmail,
      clientId: process.env.FIREBASE_CLIENT_ID,
      authUri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
      tokenUri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
    };

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });

    lastSkipReason = null;
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error: any) {
    if (error.code === 'app/duplicate-app') {
      console.log('✅ Firebase Admin already initialized');
      firebaseApp = admin.app();
    } else {
      // Log the error CODE/message only — never the credential payload.
      lastSkipReason = `firebase-admin rejected the credential: ${error?.code ?? error?.message ?? 'unknown'}`;
      console.error(`❌ Failed to initialize Firebase: ${error?.code ?? error?.message ?? 'unknown error'}`);
      // Don't throw error, allow app to run without Firebase
    }
  }
};

export const getAuth = (): admin.auth.Auth => {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized. Please check your environment variables.');
  }
  return admin.auth();
};

export const getFirestore = () => {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized. Please check your environment variables.');
  }
  return admin.firestore();
};

/** True when Firebase Admin holds usable credentials. */
export const isFirebaseReady = (): boolean => firebaseApp !== null;

export interface FirebaseDiagnostics {
  configured: boolean;
  projectId: string | null;
  /** Presence only — the address itself is an identifier, never the key. */
  clientEmail: 'configured' | 'missing';
  privateKey: 'configured' | 'missing';
  reason?: string;
}

/**
 * Safe startup diagnostic.
 *
 * Reports only presence flags plus the project id (a public identifier).
 * It never returns or logs the private key, the service-account JSON, or an
 * access token.
 */
export const getFirebaseDiagnostics = (): FirebaseDiagnostics => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  return {
    configured: firebaseApp !== null,
    projectId: isPlaceholder(projectId) ? null : projectId!,
    clientEmail: isPlaceholder(clientEmail) ? 'missing' : 'configured',
    privateKey: privateKey && privateKey.trim().length > 0 ? 'configured' : 'missing',
    ...(firebaseApp === null && lastSkipReason ? { reason: lastSkipReason } : {}),
  };
};

/** Print the diagnostic block. Safe to call on every boot. */
export const logFirebaseDiagnostics = (): void => {
  const d = getFirebaseDiagnostics();
  console.log('Firebase:');
  console.log(`  configured:  ${d.configured}`);
  console.log(`  projectId:   ${d.projectId ?? 'not set'}`);
  console.log(`  clientEmail: ${d.clientEmail}`);
  console.log(`  privateKey:  ${d.privateKey}`);
  if (d.reason) console.log(`  reason:      ${d.reason}`);
};

/**
 * Firebase Cloud Messaging handle, or null when Firebase is not configured.
 * Returning null (rather than throwing) lets the push layer degrade quietly —
 * a missing credential must never break the business operation that triggered
 * the notification.
 */
export const getMessaging = (): admin.messaging.Messaging | null => {
  if (!firebaseApp) return null;
  return admin.messaging();
};

// For backward compatibility
export const auth: {
  createUser: (userData: any) => Promise<{ uid: string } | admin.auth.UserRecord>;
  getUserByPhoneNumber: (phoneNumber: string) => Promise<{ uid: string } | admin.auth.UserRecord>;
  verifyPhoneNumber: (phoneNumber: string, otp: string) => Promise<{ uid: string } | admin.auth.UserRecord>;
} = {
  createUser: async (userData: any) => {
    try {
      const auth = getAuth();
      return await auth.createUser(userData);
    } catch (error) {
      // Mock user creation for demo purposes
      console.log('Mock Firebase user creation:', userData);
      return { uid: `mock_${Date.now()}` };
    }
  },
  getUserByPhoneNumber: async (phoneNumber: string) => {
    try {
      const auth = getAuth();
      return await auth.getUserByPhoneNumber(phoneNumber);
    } catch (error) {
      // Mock user retrieval for demo purposes
      console.log('Mock Firebase user retrieval:', phoneNumber);
      return { uid: `mock_${phoneNumber.replace(/\D/g, '')}` };
    }
  },
  verifyPhoneNumber: async (phoneNumber: string, otp: string) => {
    try {
      const auth = getAuth();
      // In a real implementation, you would use Firebase's phone auth verification
      // For now, we'll implement a basic OTP validation
      // NOTE: This is a simplified implementation for demo purposes
      // In production, you should use Firebase's official phone auth SDK
      
      // For demo: accept 6-digit OTPs starting with '1' as valid
      if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        throw new Error('auth/invalid-verification-code');
      }
      
      // For demo: only accept OTPs starting with '1' as valid
      if (!otp.startsWith('1')) {
        throw new Error('auth/invalid-verification-code');
      }
      
      // Get or create user by phone number
      try {
        const userRecord = await auth.getUserByPhoneNumber(phoneNumber);
        return userRecord;
      } catch (getUserError: any) {
        // If user doesn't exist, create them
        if (getUserError.code === 'auth/user-not-found') {
          const newUser = await auth.createUser({
            phoneNumber,
            email: `${phoneNumber}@tuition.app`,
            emailVerified: false,
            disabled: false,
          });
          return newUser;
        }
        throw getUserError;
      }
    } catch (error: any) {
      // Handle Firebase auth errors
      if (error.code === 'auth/invalid-verification-code') {
        throw new Error('Invalid OTP. Please try again.');
      }
      if (error.code === 'auth/code-expired') {
        throw new Error('OTP has expired. Please request a new one.');
      }
      if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many attempts. Please try again later.');
      }
      
      // Mock verification for demo purposes
      console.log('Mock Firebase OTP verification:', { phoneNumber, otp });
      if (otp.length !== 6) {
        throw new Error('Invalid OTP. Please try again.');
      }
      if (!otp.startsWith('1')) {
        throw new Error('Invalid OTP. Please try again.');
      }
      return { uid: `mock_${phoneNumber.replace(/\D/g, '')}` };
    }
  },
};

export const firestore = {
  collection: (name: string) => {
    try {
      const db = getFirestore();
      return db.collection(name);
    } catch (error) {
      // Mock firestore for demo purposes
      console.log('Mock Firestore collection:', name);
      return null;
    }
  },
};
