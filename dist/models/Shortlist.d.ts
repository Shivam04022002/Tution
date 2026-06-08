import mongoose, { Document } from 'mongoose';
export interface IShortlist extends Document {
    parentId: mongoose.Types.ObjectId;
    teacherId: mongoose.Types.ObjectId;
    teacherProfileId: mongoose.Types.ObjectId;
    requirementId: mongoose.Types.ObjectId;
    notes?: string;
    matchScore?: number;
    isContacted: boolean;
    contactedAt?: Date;
    contactMethod?: 'call' | 'whatsapp' | 'email' | 'sms';
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Shortlist: mongoose.Model<IShortlist, {}, {}, {}, mongoose.Document<unknown, {}, IShortlist, {}, mongoose.DefaultSchemaOptions> & IShortlist & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IShortlist>;
export default Shortlist;
//# sourceMappingURL=Shortlist.d.ts.map