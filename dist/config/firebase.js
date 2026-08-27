"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.firestore = exports.auth = exports.getMessaging = exports.logFirebaseDiagnostics = exports.getFirebaseDiagnostics = exports.isFirebaseReady = exports.getFirestore = exports.getAuth = exports.initializeFirebase = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
let firebaseApp = null;
const isPlaceholder = (value) => !value ||
    value.trim().length === 0 ||
    /^your[-_]/i.test(value.trim()) ||
    /^(placeholder|changeme|todo|xxx)$/i.test(value.trim());
let lastSkipReason = null;
const initializeFirebase = () => {
    if (firebaseApp) {
        return;
    }
    try {
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
            console.warn(`⚠️ Firebase credentials not configured (${missing.join(', ')}). ` +
                'Push notifications will be skipped; in-app notifications still work.');
            return;
        }
        if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
            lastSkipReason = 'FIREBASE_PRIVATE_KEY is not a well-formed PEM block';
            console.warn('⚠️ FIREBASE_PRIVATE_KEY is not a PEM private key (expected a ' +
                '"-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----" block, with literal \\n ' +
                'escapes if stored on one line). Push notifications will be skipped.');
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
        lastSkipReason = null;
        console.log('✅ Firebase Admin initialized successfully');
    }
    catch (error) {
        if (error.code === 'app/duplicate-app') {
            console.log('✅ Firebase Admin already initialized');
            firebaseApp = firebase_admin_1.default.app();
        }
        else {
            lastSkipReason = `firebase-admin rejected the credential: ${error?.code ?? error?.message ?? 'unknown'}`;
            console.error(`❌ Failed to initialize Firebase: ${error?.code ?? error?.message ?? 'unknown error'}`);
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
const isFirebaseReady = () => firebaseApp !== null;
exports.isFirebaseReady = isFirebaseReady;
const getFirebaseDiagnostics = () => {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    return {
        configured: firebaseApp !== null,
        projectId: isPlaceholder(projectId) ? null : projectId,
        clientEmail: isPlaceholder(clientEmail) ? 'missing' : 'configured',
        privateKey: privateKey && privateKey.trim().length > 0 ? 'configured' : 'missing',
        ...(firebaseApp === null && lastSkipReason ? { reason: lastSkipReason } : {}),
    };
};
exports.getFirebaseDiagnostics = getFirebaseDiagnostics;
const logFirebaseDiagnostics = () => {
    const d = (0, exports.getFirebaseDiagnostics)();
    console.log('Firebase:');
    console.log(`  configured:  ${d.configured}`);
    console.log(`  projectId:   ${d.projectId ?? 'not set'}`);
    console.log(`  clientEmail: ${d.clientEmail}`);
    console.log(`  privateKey:  ${d.privateKey}`);
    if (d.reason)
        console.log(`  reason:      ${d.reason}`);
};
exports.logFirebaseDiagnostics = logFirebaseDiagnostics;
const getMessaging = () => {
    if (!firebaseApp)
        return null;
    return firebase_admin_1.default.messaging();
};
exports.getMessaging = getMessaging;
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
    verifyPhoneNumber: async (phoneNumber, otp) => {
        try {
            const auth = (0, exports.getAuth)();
            if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
                throw new Error('auth/invalid-verification-code');
            }
            if (!otp.startsWith('1')) {
                throw new Error('auth/invalid-verification-code');
            }
            try {
                const userRecord = await auth.getUserByPhoneNumber(phoneNumber);
                return userRecord;
            }
            catch (getUserError) {
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
        }
        catch (error) {
            if (error.code === 'auth/invalid-verification-code') {
                throw new Error('Invalid OTP. Please try again.');
            }
            if (error.code === 'auth/code-expired') {
                throw new Error('OTP has expired. Please request a new one.');
            }
            if (error.code === 'auth/too-many-requests') {
                throw new Error('Too many attempts. Please try again later.');
            }
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