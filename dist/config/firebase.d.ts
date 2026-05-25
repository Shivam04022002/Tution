import admin from 'firebase-admin';
export declare const initializeFirebase: () => void;
export declare const getAuth: () => import("firebase-admin/lib/auth/auth").Auth;
export declare const getFirestore: () => admin.firestore.Firestore;
export declare const auth: {
    createUser: (userData: any) => Promise<import("firebase-admin/lib/auth/user-record").UserRecord | {
        uid: string;
    }>;
    getUserByPhoneNumber: (phoneNumber: string) => Promise<import("firebase-admin/lib/auth/user-record").UserRecord | {
        uid: string;
    }>;
};
export declare const firestore: {
    collection: (name: string) => admin.firestore.CollectionReference<admin.firestore.DocumentData, admin.firestore.DocumentData> | null;
};
//# sourceMappingURL=firebase.d.ts.map