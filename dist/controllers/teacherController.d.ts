import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const registerTeacher: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getTeacherProfile: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const updateTeacherProfile: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getAllTeachers: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getTeacherById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const toggleVacationMode: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const uploadDocuments: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=teacherController.d.ts.map