import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getPlatformStats: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getAllUsers: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getAllTeachers: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getTeacherDetails: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const approveTeacher: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const rejectTeacher: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const blockTeacher: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getAllParents: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getParentDetails: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const updateParent: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const deleteParent: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const unblockTeacher: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=adminController.d.ts.map