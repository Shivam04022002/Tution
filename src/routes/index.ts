import express from 'express';
import authRoutes from './auth';
import teacherRoutes from './teacher';
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
import notificationRoutes from './notifications';
import locationRoutes from './location';
import ticketRoutes from './tickets';
import staffRoutes from './staff';
import staffManagementRoutes from './staffManagement';

const router = express.Router();

// Health check route
router.get('/health', (req, res) => {
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
router.use('/notifications', notificationRoutes);
router.use('/tickets', ticketRoutes);
router.use('/staff', staffRoutes);
router.use('/location', locationRoutes);

// Placeholder for future routes
// router.use('/classes', scheduledClassRoutes);

export default router;
