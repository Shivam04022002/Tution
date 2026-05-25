import express from 'express';
import authRoutes from './auth';

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

// Placeholder for future routes
// router.use('/tutors', tutorRoutes);
// router.use('/requirements', requirementRoutes);
// router.use('/payments', paymentRoutes);
// router.use('/notifications', notificationRoutes);
// router.use('/admin', adminRoutes);

export default router;
