import admin from 'firebase-admin';

let firebaseApp: admin.app.App | null = null;

export const initializeFirebase = (): void => {
  try {
    // Check if Firebase credentials are available
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (!projectId || !privateKey || !clientEmail) {
      console.warn('⚠️ Firebase credentials not found. Firebase features will be disabled.');
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

    console.log('✅ Firebase Admin initialized successfully');
  } catch (error: any) {
    if (error.code === 'app/duplicate-app') {
      console.log('✅ Firebase Admin already initialized');
      firebaseApp = admin.app();
    } else {
      console.error('❌ Failed to initialize Firebase:', error);
      // Don't throw error, allow app to run without Firebase
    }
  }
};

export const getAuth = () => {
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

// For backward compatibility
export const auth = {
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
