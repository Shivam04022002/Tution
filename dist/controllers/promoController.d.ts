import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const validatePromoCode: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const applyPromoCode: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const listPromoCodes: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const createPromoCode: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const updatePromoCode: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const deactivatePromoCode: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=promoController.d.ts.map