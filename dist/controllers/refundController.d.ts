import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const requestRefund: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const listRefunds: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const approveRefund: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const rejectRefund: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=refundController.d.ts.map