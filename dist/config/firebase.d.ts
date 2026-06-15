import admin from 'firebase-admin';
export declare const initializeFirebase: () => void;
export declare const getAuth: () => admin.auth.Auth;
export declare const getFirestore: () => admin.firestore.Firestore;
export declare const auth: {
    createUser: (userData: any) => Promise<{
        uid: string;
    } | admin.auth.UserRecord>;
    getUserByPhoneNumber: (phoneNumber: string) => Promise<{
        uid: string;
    } | admin.auth.UserRecord>;
    verifyPhoneNumber: (phoneNumber: string, otp: string) => Promise<{
        uid: string;
    } | admin.auth.UserRecord>;
};
export declare const firestore: {
    collection: (name: string) => admin.firestore.CollectionReference<admin.firestore.DocumentData, admin.firestore.DocumentData> | null;
};
//# sourceMappingURL=firebase.d.ts.map