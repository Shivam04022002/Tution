import mongoose, { Document } from 'mongoose';
export interface IUser extends Document {
    firebaseUid: string;
    email: string;
    phoneNumber: string;
    role: 'parent' | 'teacher' | 'admin';
    profile: {
        firstName: string;
        lastName: string;
        profileImage?: string;
        dateOfBirth?: Date;
        gender?: 'male' | 'female' | 'other';
    };
    profileCompleted: boolean;
    onboardingCompleted: boolean;
    preferences: {
        notifications: boolean;
        emailNotifications: boolean;
        smsNotifications: boolean;
        language: string;
    };
    isActive: boolean;
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, mongoose.DefaultSchemaOptions> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IUser>;
//# sourceMappingURL=User.d.ts.map