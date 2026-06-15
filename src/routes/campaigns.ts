import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  sendCampaign,
  cancelCampaign,
  getCampaignStats,
  duplicateCampaign,
  getCampaignsSummary,
} from '../controllers/notificationCampaignController';

const router = express.Router();

// All campaign routes are admin-only
router.use(authenticate, authorize('admin'));

// Summary overview (before /:id to avoid conflict)
router.get('/summary', getCampaignsSummary);

// CRUD
router.get('/',    listCampaigns);
router.post('/',   createCampaign);
router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);

// Actions
router.post('/:id/send',      sendCampaign);
router.post('/:id/cancel',    cancelCampaign);
router.post('/:id/duplicate', duplicateCampaign);

// Analytics
router.get('/:id/stats', getCampaignStats);

export default router;
