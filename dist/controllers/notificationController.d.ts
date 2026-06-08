import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const listNotifications: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getUnreadCount: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const markAsRead: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const markAllAsRead: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const deleteNotification: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const bulkDeleteOld: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=notificationController.d.ts.map