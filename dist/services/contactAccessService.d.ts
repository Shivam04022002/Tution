import mongoose from 'mongoose';
export declare function canTeacherViewParentContact(tutorId: mongoose.Types.ObjectId | string, requirementId: mongoose.Types.ObjectId | string): Promise<boolean>;
export declare function canParentViewTeacherContact(parentId: mongoose.Types.ObjectId | string, tutorId: mongoose.Types.ObjectId | string): Promise<boolean>;
export declare function getVisibleContactData(viewerRole: 'teacher' | 'parent', viewerId: mongoose.Types.ObjectId | string, targetId: mongoose.Types.ObjectId | string, contextId?: mongoose.Types.ObjectId | string): Promise<{
    phone: string;
    email: string;
    address: string;
    isUnlocked: boolean;
}>;
//# sourceMappingURL=contactAccessService.d.ts.map