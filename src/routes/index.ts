import express from 'express';
import authRoutes from './auth';
import teacherRoutes from './teacher';
import teacherDocumentRoutes from './teacherDocuments';
import parentRoutes from './parent';
import applicationRoutes from './applications';
import matchRoutes from './matches';
import demoClassRoutes from './demoClasses';
import shortlistRoutes from './shortlists';
import dashboardRoutes from './dashboard';
import adminRoutes from './admin';
import unlockRoutes from './unlock';
import invoiceRoutes from './invoices';
import refundRoutes from './refunds';
import promoRoutes from './promos';
import referralRoutes from './referrals';
import notificationRoutes from './notifications';
import locationRoutes from './location';
import ticketRoutes from './tickets';
import staffRoutes from './staff';
import staffManagementRoutes from './staffManagement';
import recommendationRoutes from './recommendations';
import reviewRoutes from './reviews';
import tutorReviewRoutes from './tutors';
import contactRoutes from './contact';
import subscriptionRoutes from './subscriptions';
import creditRoutes from './credits';
import paymentRoutes from './payments';
import kycRoutes from './kyc';
import campaignRoutes from './campaigns';
import healthRoutes from './health';
import auditRoutes from './audit';
import backupRoutes from './backup';

const router = express.Router();

// Health check routes (comprehensive monitoring)
router.use('/health', healthRoutes);

// Audit routes (system analysis)
router.use('/audit', auditRoutes);

// Legacy simple health check (backward compatibility)
router.get('/health-check', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Tuition Marketplace API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API Routes
router.use('/auth', authRoutes);
router.use('/teachers', teacherRoutes);
router.use('/teachers/documents', teacherDocumentRoutes);
router.use('/parents', parentRoutes);
router.use('/applications', applicationRoutes);
router.use('/matches', matchRoutes);
router.use('/demos', demoClassRoutes);
router.use('/shortlists', shortlistRoutes);
router.use('/dashboard', dashboardRoutes);

router.use('/admin', adminRoutes);
router.use('/admin/staff', staffManagementRoutes);
router.use('/unlock', unlockRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/refunds', refundRoutes);
router.use('/promos', promoRoutes);
router.use('/referrals', referralRoutes);
router.use('/notifications', notificationRoutes);
router.use('/tickets', ticketRoutes);
router.use('/staff', staffRoutes);
router.use('/location', locationRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/reviews', reviewRoutes);
router.use('/tutors', tutorReviewRoutes);
router.use('/contact', contactRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/credits', creditRoutes);
router.use('/payments', paymentRoutes);
router.use('/kyc', kycRoutes);
router.use('/admin/campaigns', campaignRoutes);
router.use('/admin/backup', backupRoutes);

// Placeholder for future routes
// router.use('/classes', scheduledClassRoutes);

export default router;
