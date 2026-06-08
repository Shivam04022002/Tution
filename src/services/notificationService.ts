import mongoose from 'mongoose';
import { Notification, NotificationType, NotificationCategory } from '../models/Notification';

// ─────────────────────────────────────────────────────────────────────────────
// Core send function — all auto-triggers go through here
// ─────────────────────────────────────────────────────────────────────────────
export interface SendNotificationInput {
  userId:      mongoose.Types.ObjectId | string;
  type:        NotificationType;
  category:    NotificationCategory;
  title:       string;
  body:        string;
  data?:       Record<string, any>;
  entityId?:   mongoose.Types.ObjectId | string;
  entityType?: string;
}

export async function sendNotification(input: SendNotificationInput) {
  try {
    const doc = await Notification.create({
      userId:     input.userId,
      type:       input.type,
      category:   input.category,
      title:      input.title,
      body:       input.body,
      data:       input.data,
      entityId:   input.entityId,
      entityType: input.entityType,
      isRead:     false,
    });
    return doc;
  } catch (err) {
    // Non-fatal — log and continue
    console.error('[NotificationService] Failed to persist notification:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk send to multiple users (e.g. all admins)
// ─────────────────────────────────────────────────────────────────────────────
export async function sendNotificationToMany(
  userIds: (mongoose.Types.ObjectId | string)[],
  input: Omit<SendNotificationInput, 'userId'>,
) {
  if (!userIds.length) return;
  try {
    const docs = userIds.map((uid) => ({
      userId:     uid,
      type:       input.type,
      category:   input.category,
      title:      input.title,
      body:       input.body,
      data:       input.data,
      entityId:   input.entityId,
      entityType: input.entityType,
      isRead:     false,
    }));
    await Notification.insertMany(docs, { ordered: false });
  } catch (err) {
    console.error('[NotificationService] Bulk notification failed:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed helpers — called from controllers
// ─────────────────────────────────────────────────────────────────────────────

// Parent: a teacher applied to their requirement
export async function notifyTeacherApplied(
  parentUserId: mongoose.Types.ObjectId | string,
  teacherName: string,
  subject: string,
  applicationId: mongoose.Types.ObjectId | string,
) {
  return sendNotification({
    userId:     parentUserId,
    type:       'TEACHER_APPLIED',
    category:   'application',
    title:      'New Tutor Application',
    body:       `${teacherName} has applied for your ${subject} requirement.`,
    data:       { screen: 'Applications', applicationId: String(applicationId) },
    entityId:   applicationId,
    entityType: 'TutorApplication',
  });
}

// Parent: demo class scheduled
export async function notifyDemoScheduled(
  parentUserId: mongoose.Types.ObjectId | string,
  teacherName: string,
  subject: string,
  demoDate: Date,
  demoId: mongoose.Types.ObjectId | string,
) {
  return sendNotification({
    userId:     parentUserId,
    type:       'DEMO_SCHEDULED',
    category:   'demo',
    title:      'Demo Class Scheduled',
    body:       `Demo for ${subject} with ${teacherName} on ${demoDate.toLocaleDateString('en-IN')}.`,
    data:       { screen: 'DemoClasses', demoId: String(demoId) },
    entityId:   demoId,
    entityType: 'DemoClass',
  });
}

// Parent: payment success
export async function notifyPaymentSuccess(
  parentUserId: mongoose.Types.ObjectId | string,
  amount: number,
  description: string,
  paymentId: mongoose.Types.ObjectId | string,
) {
  return sendNotification({
    userId:     parentUserId,
    type:       'PAYMENT_SUCCESS',
    category:   'payment',
    title:      'Payment Successful',
    body:       `₹${amount} paid successfully for ${description}.`,
    data:       { screen: 'Invoices', paymentId: String(paymentId) },
    entityId:   paymentId,
    entityType: 'Payment',
  });
}

// Parent: refund approved
export async function notifyRefundApproved(
  userId: mongoose.Types.ObjectId | string,
  amount: number,
  refundRequestId: string,
  refundId: mongoose.Types.ObjectId | string,
) {
  return sendNotification({
    userId,
    type:       'REFUND_APPROVED',
    category:   'payment',
    title:      'Refund Approved',
    body:       `Your refund of ₹${amount} has been approved and processed.`,
    data:       { screen: 'Refunds', refundRequestId },
    entityId:   refundId,
    entityType: 'RefundRequest',
  });
}

// Parent: refund rejected
export async function notifyRefundRejected(
  userId: mongoose.Types.ObjectId | string,
  amount: number,
  reason: string,
  refundId: mongoose.Types.ObjectId | string,
) {
  return sendNotification({
    userId,
    type:       'REFUND_REJECTED',
    category:   'payment',
    title:      'Refund Not Approved',
    body:       `Your refund request for ₹${amount} was not approved. Reason: ${reason}`,
    data:       { screen: 'Refunds' },
    entityId:   refundId,
    entityType: 'RefundRequest',
  });
}

// Teacher: new lead match in marketplace
export async function notifyNewLeadMatch(
  teacherUserId: mongoose.Types.ObjectId | string,
  subject: string,
  grade: string,
  city: string,
  requirementId: mongoose.Types.ObjectId | string,
) {
  return sendNotification({
    userId:     teacherUserId,
    type:       'NEW_LEAD_MATCH',
    category:   'lead',
    title:      'New Lead Available',
    body:       `A new ${subject} lead for Grade ${grade} in ${city} matches your profile.`,
    data:       { screen: 'Leads', requirementId: String(requirementId) },
    entityId:   requirementId,
    entityType: 'ParentRequirement',
  });
}

// Teacher: application shortlisted
export async function notifyApplicationShortlisted(
  teacherUserId: mongoose.Types.ObjectId | string,
  subject: string,
  applicationId: mongoose.Types.ObjectId | string,
) {
  return sendNotification({
    userId:     teacherUserId,
    type:       'APPLICATION_SHORTLISTED',
    category:   'application',
    title:      'Application Shortlisted',
    body:       `Your application for ${subject} has been shortlisted.`,
    data:       { screen: 'Applications', applicationId: String(applicationId) },
    entityId:   applicationId,
    entityType: 'TutorApplication',
  });
}

// Teacher: demo class confirmed
export async function notifyDemoConfirmed(
  teacherUserId: mongoose.Types.ObjectId | string,
  subject: string,
  demoDate: Date,
  demoId: mongoose.Types.ObjectId | string,
) {
  return sendNotification({
    userId:     teacherUserId,
    type:       'DEMO_CONFIRMED',
    category:   'demo',
    title:      'Demo Class Confirmed',
    body:       `Your demo for ${subject} is confirmed on ${demoDate.toLocaleDateString('en-IN')}.`,
    data:       { screen: 'DemoClasses', demoId: String(demoId) },
    entityId:   demoId,
    entityType: 'DemoClass',
  });
}

// Teacher: lead contact unlocked
export async function notifyLeadUnlockSuccess(
  teacherUserId: mongoose.Types.ObjectId | string,
  parentName: string,
  unlockId: mongoose.Types.ObjectId | string,
) {
  return sendNotification({
    userId:     teacherUserId,
    type:       'LEAD_UNLOCK_SUCCESS',
    category:   'lead',
    title:      'Lead Unlocked',
    body:       `You unlocked ${parentName}'s contact details. View in Lead Marketplace.`,
    data:       { screen: 'Leads', unlockId: String(unlockId) },
    entityId:   unlockId,
    entityType: 'LeadUnlock',
  });
}

// Admin: refund request submitted
export async function notifyAdminRefundRequest(
  adminUserIds: (mongoose.Types.ObjectId | string)[],
  requestedAmount: number,
  refundRequestId: string,
  entityId: mongoose.Types.ObjectId | string,
) {
  return sendNotificationToMany(adminUserIds, {
    type:       'REFUND_REQUEST',
    category:   'admin',
    title:      'New Refund Request',
    body:       `A refund of ₹${requestedAmount} has been requested. ID: ${refundRequestId}`,
    data:       { screen: 'AdminRefunds', refundRequestId },
    entityId,
    entityType: 'RefundRequest',
  });
}

// Admin: new teacher registration
export async function notifyAdminTeacherRegistration(
  adminUserIds: (mongoose.Types.ObjectId | string)[],
  teacherName: string,
  teacherId: mongoose.Types.ObjectId | string,
) {
  return sendNotificationToMany(adminUserIds, {
    type:       'TEACHER_REGISTRATION',
    category:   'admin',
    title:      'New Teacher Registered',
    body:       `${teacherName} has completed registration and is awaiting approval.`,
    data:       { screen: 'Teachers', teacherId: String(teacherId) },
    entityId:   teacherId,
    entityType: 'TeacherProfile',
  });
}

// Admin: import completed
export async function notifyAdminImportCompleted(
  adminUserIds: (mongoose.Types.ObjectId | string)[],
  importType: string,
  count: number,
  importId: mongoose.Types.ObjectId | string,
) {
  return sendNotificationToMany(adminUserIds, {
    type:       'IMPORT_COMPLETED',
    category:   'admin',
    title:      'Import Completed',
    body:       `${importType} import finished. ${count} records processed.`,
    data:       { screen: 'Import', importId: String(importId) },
    entityId:   importId,
    entityType: 'ImportHistory',
  });
}
