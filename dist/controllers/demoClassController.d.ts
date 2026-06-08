import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const scheduleDemo: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getParentDemos: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getTeacherDemos: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const rescheduleDemo: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const cancelDemo: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const completeDemo: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=demoClassController.d.ts.map