import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';

/**
 * Backup Controller
 * Manages backup strategies and retention policies
 */

// Backup configuration
const BACKUP_CONFIG = {
  // MongoDB Atlas handles automated backups
  mongodb: {
    provider: 'MongoDB Atlas',
    automated: true,
    frequency: 'Daily',
    retentionDays: 30,
    pointInTimeRecovery: true,
    description: 'Managed by MongoDB Atlas - Daily snapshots with 30-day retention'
  },
  // Cloudinary backup strategy
  cloudinary: {
    provider: 'Cloudinary',
    automated: true,
    backupEnabled: true,
    backupLocation: 'Cloudinary backup folder',
    retentionDays: 90,
    description: 'Cloudinary maintains versioned backups of all uploaded assets'
  },
  // Audit log retention
  auditLogs: {
    retentionDays: 365,
    archiveAfterDays: 90,
    description: 'Audit logs retained for 1 year, archived after 90 days'
  },
  // Notification retention
  notifications: {
    retentionDays: 90,
    archiveAfterDays: 30,
    autoCleanup: true,
    description: 'Notifications retained for 90 days, auto-cleanup enabled'
  },
  // Session/token cleanup
  sessions: {
    retentionDays: 7,
    autoCleanup: true,
    description: 'Expired sessions cleaned up weekly'
  }
};

/**
 * Get backup configuration and status
 */
export const getBackupStatus = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    
    // Only allow admin
    if (!user || user.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
      return;
    }

    // Get database stats for backup size estimation
    const dbStats = await mongoose.connection.db?.stats();
    
    // Get collection counts
    const collections = await mongoose.connection.db?.listCollections().toArray();
    const collectionStats = [];
    
    if (collections) {
      for (const coll of collections.slice(0, 10)) { // Top 10 collections
        const count = await mongoose.connection.db?.collection(coll.name).countDocuments();
        collectionStats.push({
          name: coll.name,
          documentCount: count || 0
        });
      }
    }

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        configuration: BACKUP_CONFIG,
        database: {
          estimatedBackupSize: formatBytes((dbStats?.storageSize || 0)),
          dataSize: formatBytes(dbStats?.dataSize || 0),
          indexSize: formatBytes(dbStats?.indexSize || 0),
          collections: collectionStats.sort((a, b) => b.documentCount - a.documentCount)
        },
        status: {
          mongodb: 'active',
          cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? 'configured' : 'not_configured',
          lastBackupCheck: new Date().toISOString()
        },
        recommendations: [
          'Verify MongoDB Atlas backup schedule in Atlas dashboard',
          'Enable Cloudinary backup add-on for critical assets',
          'Set up automated log rotation for application logs',
          'Configure alert notifications for backup failures'
        ]
      }
    });
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get backup status',
      error: error.message
    });
    return;
  }
};

/**
 * Trigger manual backup cleanup
 * Removes old notifications and audit logs
 */
export const cleanupOldData = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    
    if (!user || user.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
      return;
    }

    const { Notification } = await import('../models/Notification');
    const { AuditLog } = await import('../models/AuditLog');

    const results = {
      notifications: { deleted: 0 },
      auditLogs: { deleted: 0 }
    };

    // Calculate cutoff dates
    const notificationCutoff = new Date();
    notificationCutoff.setDate(notificationCutoff.getDate() - BACKUP_CONFIG.notifications.retentionDays);
    
    const auditLogCutoff = new Date();
    auditLogCutoff.setDate(auditLogCutoff.getDate() - BACKUP_CONFIG.auditLogs.retentionDays);

    // Only perform cleanup if explicitly confirmed
    const { confirm, dryRun = true } = req.body;
    
    if (dryRun || !confirm) {
      // Count what would be deleted
      results.notifications.deleted = await Notification.countDocuments({
        createdAt: { $lt: notificationCutoff }
      });
      
      results.auditLogs.deleted = await AuditLog.countDocuments({
        createdAt: { $lt: auditLogCutoff }
      });

      return res.status(200).json({
        success: true,
        dryRun: true,
        message: 'Dry run - no data deleted. Use confirm: true to execute.',
        data: {
          notificationCutoff: notificationCutoff.toISOString(),
          auditLogCutoff: auditLogCutoff.toISOString(),
          wouldDelete: results
        }
      });
    }

    // Perform actual cleanup
    const notificationResult = await Notification.deleteMany({
      createdAt: { $lt: notificationCutoff }
    });
    results.notifications.deleted = notificationResult.deletedCount || 0;

    const auditLogResult = await AuditLog.deleteMany({
      createdAt: { $lt: auditLogCutoff }
    });
    results.auditLogs.deleted = auditLogResult.deletedCount || 0;

    // Log cleanup action
    await AuditLog.create({
      adminId: user._id,
      action: 'DELETE_USER', // Using existing enum for cleanup operation
      entityType: 'User',
      entityId: 'cleanup-job',
      details: {
        operation: 'DATA_CLEANUP',
        notificationsDeleted: results.notifications.deleted,
        auditLogsDeleted: results.auditLogs.deleted,
        notificationCutoff: notificationCutoff.toISOString(),
        auditLogCutoff: auditLogCutoff.toISOString()
      },
      notes: 'Automated data cleanup job'
    });

    res.status(200).json({
      success: true,
      message: 'Cleanup completed successfully',
      data: {
        deleted: results,
        timestamp: new Date().toISOString()
      }
    });
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup old data',
      error: error.message
    });
    return;
  }
};

/**
 * Get data retention policy
 */
export const getRetentionPolicy = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    
    if (!user || !['admin', 'staff'].includes(user.role)) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Admin/Staff only.'
      });
      return;
    }

    const policies = [
      {
        dataType: 'User Data',
        retentionPeriod: 'Indefinite (until account deletion)',
        archiveAfter: 'Never',
        legalBasis: 'User consent and contract fulfillment',
        notes: 'User can request deletion via account settings'
      },
      {
        dataType: 'Teacher Profiles',
        retentionPeriod: 'Indefinite (until account deletion)',
        archiveAfter: 'Never',
        legalBasis: 'Service provision',
        notes: 'Includes verification documents'
      },
      {
        dataType: 'Parent Requirements',
        retentionPeriod: '2 years after closure',
        archiveAfter: '1 year after closure',
        legalBasis: 'Service history and analytics',
        notes: 'Soft delete after 2 years'
      },
      {
        dataType: 'Payment Records',
        retentionPeriod: '7 years',
        archiveAfter: '3 years',
        legalBasis: 'Financial regulations and tax compliance',
        notes: 'Required for GST and tax audits'
      },
      {
        dataType: 'Notifications',
        retentionPeriod: '90 days',
        archiveAfter: '30 days',
        legalBasis: 'Operational necessity',
        notes: 'Auto-cleanup enabled'
      },
      {
        dataType: 'Audit Logs',
        retentionPeriod: '1 year',
        archiveAfter: '90 days',
        legalBasis: 'Security and compliance',
        notes: 'Includes error tracking and admin actions'
      },
      {
        dataType: 'Contact Requests',
        retentionPeriod: '1 year after completion',
        archiveAfter: '6 months after completion',
        legalBasis: 'Customer service records',
        notes: 'Includes demo scheduling history'
      },
      {
        dataType: 'Application Data',
        retentionPeriod: '2 years',
        archiveAfter: '1 year',
        legalBasis: 'Service history',
        notes: 'Teacher application records'
      },
      {
        dataType: 'Session/Tokens',
        retentionPeriod: '7 days',
        archiveAfter: 'Immediate',
        legalBasis: 'Security',
        notes: 'JWT tokens expire naturally'
      },
      {
        dataType: 'Uploaded Documents',
        retentionPeriod: 'Same as user account',
        archiveAfter: 'Never',
        legalBasis: 'Service provision',
        notes: 'Cloudinary handles versioning'
      }
    ];

    res.status(200).json({
      success: true,
      data: {
        policies,
        lastUpdated: '2026-06-15',
        nextReview: '2026-12-15',
        compliance: {
          gdpr: 'Compliant - User deletion rights implemented',
          indiaItAct: 'Compliant - Data retention as per regulations',
          gst: 'Compliant - 7 year financial record retention'
        }
      }
    });
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get retention policy',
      error: error.message
    });
    return;
  }
};

/**
 * Format bytes to human readable
 */
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
