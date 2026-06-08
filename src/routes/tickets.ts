import express from 'express';
import {
  getTickets,
  getTicketById,
  createTicket,
  replyTicket,
  assignTicket,
  resolveTicket,
  closeTicket,
  reopenTicket,
  deleteTicket,
  getTicketStats,
} from '../controllers/ticketController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get tickets list
router.get('/', getTickets);

// Get ticket statistics
router.get('/stats', getTicketStats);

// Get single ticket
router.get('/:id', getTicketById);

// Create new ticket
router.post('/', createTicket);

// Reply to ticket
router.post('/:id/reply', replyTicket);

// Assign ticket (admin/staff only)
router.patch('/:id/assign', authorize('admin', 'staff'), assignTicket);

// Resolve ticket (admin/staff only)
router.patch('/:id/resolve', authorize('admin', 'staff'), resolveTicket);

// Close ticket
router.patch('/:id/close', closeTicket);

// Reopen ticket
router.patch('/:id/reopen', reopenTicket);

// Delete ticket (admin only)
router.delete('/:id', authorize('admin'), deleteTicket);

export default router;
