"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.firestore = exports.auth = exports.getFirestore = exports.getAuth = exports.initializeFirebase = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
let firebaseApp = null;
const initializeFirebase = () => {
    try {
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
        firebaseApp = firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert(serviceAccount),
        });
        console.log('✅ Firebase Admin initialized successfully');
    }
    catch (error) {
        if (error.code === 'app/duplicate-app') {
            console.log('✅ Firebase Admin already initialized');
            firebaseApp = firebase_admin_1.default.app();
        }
        else {
            console.error('❌ Failed to initialize Firebase:', error);
        }
    }
};
exports.initializeFirebase = initializeFirebase;
const getAuth = () => {
    if (!firebaseApp) {
        throw new Error('Firebase not initialized. Please check your environment variables.');
    }
    return firebase_admin_1.default.auth();
};
exports.getAuth = getAuth;
const getFirestore = () => {
    if (!firebaseApp) {
        throw new Error('Firebase not initialized. Please check your environment variables.');
    }
    return firebase_admin_1.default.firestore();
};
exports.getFirestore = getFirestore;
exports.auth = {
    createUser: async (userData) => {
        try {
            const auth = (0, exports.getAuth)();
            return await auth.createUser(userData);
        }
        catch (error) {
            console.log('Mock Firebase user creation:', userData);
            return { uid: `mock_${Date.now()}` };
        }
    },
    getUserByPhoneNumber: async (phoneNumber) => {
        try {
            const auth = (0, exports.getAuth)();
            return await auth.getUserByPhoneNumber(phoneNumber);
        }
        catch (error) {
            console.log('Mock Firebase user retrieval:', phoneNumber);
            return { uid: `mock_${phoneNumber.replace(/\D/g, '')}` };
        }
    },
};
exports.firestore = {
    collection: (name) => {
        try {
            const db = (0, exports.getFirestore)();
            return db.collection(name);
        }
        catch (error) {
            console.log('Mock Firestore collection:', name);
            return null;
        }
    },
};
//# sourceMappingURL=firebase.js.map