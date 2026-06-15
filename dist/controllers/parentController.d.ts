import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const registerParent: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getParentProfile: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const updateParentProfile: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getAllRequirements: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getRequirementById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const closeRequirement: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const updateRequirementStatus: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const extendRequirement: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getMyRequirements: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const deleteRequirement: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const createRequirement: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const updateRequirement: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=parentController.d.ts.map