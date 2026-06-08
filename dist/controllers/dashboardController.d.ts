import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getParentDashboard: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getTeacherDashboard: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=dashboardController.d.ts.map