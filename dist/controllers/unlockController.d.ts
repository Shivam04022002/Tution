import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const unlockTeacherLead: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const unlockTutorContact: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getUnlockHistory: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const createRazorpayOrder: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const verifyRazorpayPayment: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const handleRazorpayWebhook: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const createPaymentIntent: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=unlockController.d.ts.map