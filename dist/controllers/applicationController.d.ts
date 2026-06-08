import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const applyToRequirement: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getParentApplications: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getTeacherApplications: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const shortlistApplication: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const rejectApplication: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const acceptApplication: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const withdrawApplication: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getParentDashboardStats: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getTeacherDashboardStats: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=applicationController.d.ts.map