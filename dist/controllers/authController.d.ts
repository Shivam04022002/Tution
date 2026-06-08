import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const sendOTP: (req: Request, res: Response) => Promise<Response>;
export declare const verifyOTP: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getCurrentUser: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const updateProfile: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const logout: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const login: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const registerComplete: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const signup: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=authController.d.ts.map