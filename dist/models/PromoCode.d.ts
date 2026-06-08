import mongoose, { Document } from 'mongoose';
export interface IPromoCode extends Document {
    code: string;
    description: string;
    discountType: 'flat' | 'percent';
    discountValue: number;
    maxDiscountAmount?: number;
    applicableTo: 'unlock_lead' | 'unlock_tutor' | 'all';
    minOrderAmount: number;
    usageLimit: number;
    usageCount: number;
    perUserLimit: number;
    validFrom: Date;
    validTo: Date;
    isActive: boolean;
    restrictedToUserIds?: mongoose.Types.ObjectId[];
    totalDiscountGiven: number;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
    isValid(userId: mongoose.Types.ObjectId, orderAmount: number, type: string): Promise<{
        valid: boolean;
        error?: string;
    }>;
    computeDiscount(baseAmount: number): number;
}
export declare const PromoCode: mongoose.Model<IPromoCode, {}, {}, {}, mongoose.Document<unknown, {}, IPromoCode, {}, mongoose.DefaultSchemaOptions> & IPromoCode & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IPromoCode>;
//# sourceMappingURL=PromoCode.d.ts.map