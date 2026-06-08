import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Ticket, { TicketStatus, TicketPriority, TicketCategory } from '../models/Ticket';
import { User } from '../models/User';

// ─────────────────────────────────────────────────────────────────────────────
// Helper Types
// ─────────────────────────────────────────────────────────────────────────────
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tickets
// Get all tickets for current user (parent/teacher) or all tickets (admin/staff)
// ─────────────────────────────────────────────────────────────────────────────
export const getTickets = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const {
      status,
      category,
      priority,
      page = '1',
      limit = '20',
      mine,
    } = req.query as {
      status?: TicketStatus;
      category?: TicketCategory;
      priority?: TicketPriority;
      page?: string;
      limit?: string;
      mine?: string;
    };

    const query: any = {};

    // Filter by role: parents/teachers see their own; admin/staff see all (or filter by mine)
    if (userRole === 'parent' || userRole === 'teacher') {
      query.userId = new mongoose.Types.ObjectId(userId);
    } else if (userRole === 'staff' && mine === 'true') {
      query.assignedTo = new mongoose.Types.ObjectId(userId);
    }

    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [tickets, total] = await Promise.all([
      Ticket.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Ticket.countDocuments(query),
    ]);

    // Get status counts for summary
    const statusCounts = await Ticket.aggregate([
      { $match: userRole === 'parent' || userRole === 'teacher' ? { userId: new mongoose.Types.ObjectId(userId) } : {} },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const counts = {
      open: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
    };
    statusCounts.forEach((s) => {
      counts[s._id as keyof typeof counts] = s.count;
    });

    res.status(200).json({
      success: true,
      data: {
        tickets,
        counts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch tickets' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tickets/stats
// Get ticket statistics for dashboard
// ─────────────────────────────────────────────────────────────────────────────
export const getTicketStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const baseMatch: any = userRole === 'parent' || userRole === 'teacher'
      ? { userId: new mongoose.Types.ObjectId(userId) }
      : {};

    const [
      statusCounts,
      priorityCounts,
      categoryCounts,
      pending24h,
      recentResolved,
    ] = await Promise.all([
      Ticket.aggregate([{ $match: baseMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Ticket.aggregate([{ $match: baseMatch }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
      Ticket.aggregate([{ $match: baseMatch }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
      Ticket.countDocuments({
        ...baseMatch,
        status: { $in: ['open', 'in_progress'] },
        createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
      Ticket.countDocuments({
        ...baseMatch,
        status: 'resolved',
        resolvedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
    ]);

    const stats = {
      open: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
      urgent: 0,
      pending24h,
      recentResolved,
      total: 0,
    };

    statusCounts.forEach((s) => {
      stats[s._id as keyof typeof stats] = s.count;
      stats.total += s.count;
    });

    priorityCounts.forEach((p) => {
      if (p._id === 'urgent') stats.urgent = p.count;
    });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch ticket stats' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tickets/:id
// Get single ticket details
// ─────────────────────────────────────────────────────────────────────────────
export const getTicketById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const ticket = await Ticket.findById(id).lean();
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    // Check access permissions
    const isOwner = ticket.userId.toString() === userId;
    const isAssigned = ticket.assignedTo?.toString() === userId;
    const isAdmin = userRole === 'admin';
    const isStaff = userRole === 'staff';

    if (!isOwner && !isAssigned && !isAdmin && !isStaff) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    res.status(200).json({ success: true, data: ticket });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch ticket' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tickets
// Create a new ticket
// ─────────────────────────────────────────────────────────────────────────────
export const createTicket = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { category, priority, subject, description } = req.body;

    // Validate required fields
    if (!category || !subject || !description) {
      res.status(400).json({ success: false, message: 'Category, subject, and description are required' });
      return;
    }

    // Get user details
    const user = await User.findById(userId).lean();
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Create ticket
    const fullName = `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || user.email;
    const ticket = new Ticket({
      userId: new mongoose.Types.ObjectId(userId),
      userName: fullName,
      userEmail: user.email,
      userPhone: user.phoneNumber,
      userRole,
      category,
      priority: priority || 'medium',
      subject,
      description,
      status: 'open',
      messages: [],
    });

    await ticket.save();

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      data: ticket,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to create ticket' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tickets/:id/reply
// Add a reply to a ticket
// ─────────────────────────────────────────────────────────────────────────────
export const replyTicket = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Message is required' });
      return;
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    // Check permissions
    const isOwner = ticket.userId.toString() === userId;
    const isAssigned = ticket.assignedTo?.toString() === userId;
    const isAdmin = userRole === 'admin';
    const isStaff = userRole === 'staff';

    if (!isOwner && !isAssigned && !isAdmin && !isStaff) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Determine sender type and name
    let sender: 'user' | 'admin' | 'staff' = 'user';
    let senderName = ticket.userName;

    if (userRole === 'admin') {
      sender = 'admin';
      senderName = 'Support Admin';
    } else if (userRole === 'staff') {
      sender = 'staff';
      senderName = ticket.assignedToName || 'Support Staff';
    }

    // Add message
    ticket.messages.push({
      sender,
      senderId: new mongoose.Types.ObjectId(userId),
      senderName,
      message: message.trim(),
      createdAt: new Date(),
    });

    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Reply added successfully',
      data: ticket,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to add reply' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/tickets/:id/assign
// Assign ticket to staff/admin
// ─────────────────────────────────────────────────────────────────────────────
export const assignTicket = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Only admin/staff can assign
    if (userRole !== 'admin' && userRole !== 'staff') {
      res.status(403).json({ success: false, message: 'Only admin or staff can assign tickets' });
      return;
    }

    const { id } = req.params;
    const { assigneeId, assigneeName } = req.body;

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    // If no assignee provided, assign to current user (self-assign)
    const targetId = assigneeId || userId;
    const targetName = assigneeName || 'Support Staff';

    ticket.assignedTo = new mongoose.Types.ObjectId(targetId);
    ticket.assignedToName = targetName;
    if (ticket.status === 'open') {
      ticket.status = 'in_progress';
    }

    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Ticket assigned successfully',
      data: ticket,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to assign ticket' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/tickets/:id/resolve
// Resolve a ticket
// ─────────────────────────────────────────────────────────────────────────────
export const resolveTicket = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Only admin/staff can resolve
    if (userRole !== 'admin' && userRole !== 'staff') {
      res.status(403).json({ success: false, message: 'Only admin or staff can resolve tickets' });
      return;
    }

    const { id } = req.params;
    const { resolutionMessage } = req.body;

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    ticket.status = 'resolved';
    ticket.resolvedAt = new Date();

    // Add resolution message if provided
    if (resolutionMessage) {
      ticket.messages.push({
        sender: userRole === 'admin' ? 'admin' : 'staff',
        senderId: new mongoose.Types.ObjectId(userId),
        senderName: ticket.assignedToName || 'Support Team',
        message: resolutionMessage,
        createdAt: new Date(),
      });
    }

    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Ticket resolved successfully',
      data: ticket,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to resolve ticket' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/tickets/:id/close
// Close a ticket
// ─────────────────────────────────────────────────────────────────────────────
export const closeTicket = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { closeMessage } = req.body;

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    // Check permissions: owner, assigned, admin, or staff
    const isOwner = ticket.userId.toString() === userId;
    const isAssigned = ticket.assignedTo?.toString() === userId;
    const isAdmin = userRole === 'admin';
    const isStaff = userRole === 'staff';

    if (!isOwner && !isAssigned && !isAdmin && !isStaff) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    ticket.status = 'closed';
    ticket.closedAt = new Date();

    // Add close message if provided
    if (closeMessage) {
      let sender: 'user' | 'admin' | 'staff' = 'user';
      let senderName = ticket.userName;
      if (userRole === 'admin') {
        sender = 'admin';
        senderName = 'Support Admin';
      } else if (userRole === 'staff') {
        sender = 'staff';
        senderName = ticket.assignedToName || 'Support Staff';
      }

      ticket.messages.push({
        sender,
        senderId: new mongoose.Types.ObjectId(userId),
        senderName,
        message: closeMessage,
        createdAt: new Date(),
      });
    }

    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Ticket closed successfully',
      data: ticket,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to close ticket' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/tickets/:id/reopen
// Reopen a closed/resolved ticket
// ─────────────────────────────────────────────────────────────────────────────
export const reopenTicket = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { reopenMessage } = req.body;

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    // Check permissions: owner, assigned, admin, or staff
    const isOwner = ticket.userId.toString() === userId;
    const isAssigned = ticket.assignedTo?.toString() === userId;
    const isAdmin = userRole === 'admin';
    const isStaff = userRole === 'staff';

    if (!isOwner && !isAssigned && !isAdmin && !isStaff) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Only allow reopening resolved/closed tickets
    if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
      res.status(400).json({ success: false, message: 'Only resolved or closed tickets can be reopened' });
      return;
    }

    ticket.status = 'open';

    // Add reopen message if provided
    if (reopenMessage) {
      let sender: 'user' | 'admin' | 'staff' = 'user';
      let senderName = ticket.userName;
      if (userRole === 'admin') {
        sender = 'admin';
        senderName = 'Support Admin';
      } else if (userRole === 'staff') {
        sender = 'staff';
        senderName = ticket.assignedToName || 'Support Staff';
      }

      ticket.messages.push({
        sender,
        senderId: new mongoose.Types.ObjectId(userId),
        senderName,
        message: reopenMessage,
        createdAt: new Date(),
      });
    }

    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Ticket reopened successfully',
      data: ticket,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to reopen ticket' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/tickets/:id
// Delete a ticket (admin only)
// ─────────────────────────────────────────────────────────────────────────────
export const deleteTicket = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin') {
      res.status(403).json({ success: false, message: 'Only admin can delete tickets' });
      return;
    }

    const { id } = req.params;

    const ticket = await Ticket.findByIdAndDelete(id);
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Ticket deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to delete ticket' });
  }
};
