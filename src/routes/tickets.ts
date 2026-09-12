import express from 'express';
import multer from 'multer';
import fs from 'fs';
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

const TEMP_UPLOAD_DIR = 'uploads/temp/';

// Multer's disk storage does not create the destination, so make sure it exists.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdir(TEMP_UPLOAD_DIR, { recursive: true }, (err) => cb(err, TEMP_UPLOAD_DIR));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'ticket-attachment-' + uniqueSuffix);
  },
});

const ALLOWED_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const attachmentUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_ATTACHMENT_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP images or PDF files are allowed.'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }, // 10 MB
});

// Get tickets list
router.get('/', getTickets);

// Get ticket statistics
router.get('/stats', getTicketStats);

// Get single ticket
router.get('/:id', getTicketById);

// Create new ticket (optional single "attachment" file field)
router.post('/', attachmentUpload.single('attachment'), createTicket);

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
