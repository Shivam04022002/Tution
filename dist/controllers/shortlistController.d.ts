import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const addToShortlist: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const removeFromShortlist: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getParentShortlists: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getTeacherShortlists: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const markShortlistContacted: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=shortlistController.d.ts.map