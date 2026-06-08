import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getOverviewAnalytics: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getDemandAnalytics: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getTeacherSupplyAnalytics: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getRevenueAnalytics: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getFinancialAnalytics: (_req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=analyticsController.d.ts.map