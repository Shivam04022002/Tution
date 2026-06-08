import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const importParentsExcel: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const importTeachersExcel: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getImportHistory: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=importController.d.ts.map