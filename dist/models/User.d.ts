import mongoose, { Document } from 'mongoose';
export interface IUser extends Document {
    firebaseUid?: string;
    email: string;
    phoneNumber: string;
    password?: string;
    username?: string | null;
    role: 'parent' | 'teacher' | 'admin' | 'staff';
    staffRole?: string | null;
    profile: {
        firstName: string;
        lastName: string;
        profileImage?: string | null;
        dateOfBirth?: Date | null;
        gender?: 'male' | 'female' | 'other' | null;
        department?: string | null;
    };
    employeeId?: string | null;
    designation?: string | null;
    department?: string | null;
    joiningDate?: Date | null;
    dateOfBirth?: Date | null;
    gender?: 'male' | 'female' | 'other' | null;
    permissions?: string[];
    lastLogin?: Date | null;
    createdBy?: mongoose.Types.ObjectId | null;
    updatedBy?: mongoose.Types.ObjectId | null;
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
    isBlocked: boolean;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
}
export declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, mongoose.DefaultSchemaOptions> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IUser>;
//# sourceMappingURL=User.d.ts.map