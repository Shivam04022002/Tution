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

// ─────────────────────────────────────────────────────────────────────────────
// Contact & Demo Request Notifications
// ─────────────────────────────────────────────────────────────────────────────

// Teacher: received a contact request (call, whatsapp, message)
export async function notifyContactRequestReceived(
  teacherUserId: mongoose.Types.ObjectId | string,
  parentName: string,
  contactType: string,
  contactRequestId: mongoose.Types.ObjectId | string,
) {
  const typeLabels: Record<string, string> = {
    call: 'phone call',
    whatsapp: 'WhatsApp message',
    message: 'message',
  };

  return sendNotification({
    userId:     teacherUserId,
    type:       'CONTACT_REQUEST_RECEIVED',
    category:   'application',
    title:      'New Contact Request',
    body:       `${parentName} wants to connect via ${typeLabels[contactType] || 'message'}.`,
    data:       { screen: 'ContactRequests', contactRequestId: String(contactRequestId) },
    entityId:   contactRequestId,
    entityType: 'ContactRequest',
  });
}

// Teacher: received a demo request
export async function notifyDemoRequestReceived(
  teacherUserId: mongoose.Types.ObjectId | string,
  parentName: string,
  demoDate: Date,
  contactRequestId: mongoose.Types.ObjectId | string,
) {
  return sendNotification({
    userId:     teacherUserId,
    type:       'DEMO_REQUEST_RECEIVED',
    category:   'demo',
    title:      'New Demo Request',
    body:       `${parentName} requested a demo class on ${demoDate.toLocaleDateString('en-IN')}.`,
    data:       { screen: 'DemoRequests', contactRequestId: String(contactRequestId) },
    entityId:   contactRequestId,
    entityType: 'ContactRequest',
  });
}

// Parent: contact request accepted
export async function notifyContactRequestAccepted(
  parentUserId: mongoose.Types.ObjectId | string,
  contactType: string,
  contactRequestId: mongoose.Types.ObjectId | string,
) {
  return sendNotification({
    userId:     parentUserId,
    type:       'CONTACT_REQUEST_ACCEPTED',
    category:   'application',
    title:      'Contact Request Accepted',
    body:       `Teacher accepted your ${contactType} request. You can now connect.`,
    data:       { screen: 'ContactHistory', contactRequestId: String(contactRequestId) },
    entityId:   contactRequestId,
    entityType: 'ContactRequest',
  });
}

// Parent: contact request rejected
export async function notifyContactRequestRejected(
  parentUserId: mongoose.Types.ObjectId | string,
  contactType: string,
  reason: string,
  contactRequestId: mongoose.Types.ObjectId | string,
) {
  return sendNotification({
    userId:     parentUserId,
    type:       'CONTACT_REQUEST_REJECTED',
    category:   'application',
    title:      'Contact Request Declined',
    body:       reason || `Teacher declined your ${contactType} request.`,
    data:       { screen: 'ContactHistory', contactRequestId: String(contactRequestId) },
    entityId:   contactRequestId,
    entityType: 'ContactRequest',
  });
}

// Parent: demo request accepted
export async function notifyDemoAccepted(
  parentUserId: mongoose.Types.ObjectId | string,
  demoDate: Date,
  contactRequestId: mongoose.Types.ObjectId | string,
) {
  return sendNotification({
    userId:     parentUserId,
    type:       'DEMO_REQUEST_ACCEPTED',
    category:   'demo',
    title:      'Demo Request Accepted',
    body:       `Teacher accepted your demo request for ${demoDate.toLocaleDateString('en-IN')}.`,
    data:       { screen: 'DemoClasses', contactRequestId: String(contactRequestId) },
    entityId:   contactRequestId,
    entityType: 'ContactRequest',
  });
}

// Parent: demo request rejected
export async function notifyDemoRejected(
  parentUserId: mongoose.Types.ObjectId | string,
  reason: string,
  contactRequestId: mongoose.Types.ObjectId | string,
) {
  return sendNotification({
    userId:     parentUserId,
    type:       'DEMO_REQUEST_REJECTED',
    category:   'demo',
    title:      'Demo Request Declined',
    body:       reason || 'Teacher declined your demo request.',
    data:       { screen: 'DemoClasses', contactRequestId: String(contactRequestId) },
    entityId:   contactRequestId,
    entityType: 'ContactRequest',
  });
}

// Parent: demo completed by teacher
export async function notifyDemoCompleted(
  parentUserId: mongoose.Types.ObjectId | string,
  outcome: string,
  contactRequestId: mongoose.Types.ObjectId | string,
) {
  const outcomeLabels: Record<string, string> = {
    interested:     'Teacher marked the demo complete — they are interested!',
    not_interested: 'Teacher has marked the demo as complete.',
    need_follow_up: 'Teacher marked the demo complete and wants a follow-up.',
  };
  return sendNotification({
    userId:     parentUserId,
    type:       'DEMO_COMPLETED',
    category:   'demo',
    title:      'Demo Class Completed',
    body:       outcomeLabels[outcome] || 'Your demo class has been marked complete.',
    data:       { screen: 'DemoClasses', contactRequestId: String(contactRequestId) },
    entityId:   contactRequestId,
    entityType: 'ContactRequest',
  });
}

// Parent: demo rescheduled by teacher
export async function notifyDemoRescheduled(
  parentUserId: mongoose.Types.ObjectId | string,
  newDate: Date,
  contactRequestId: mongoose.Types.ObjectId | string,
) {
  return sendNotification({
    userId:     parentUserId,
    type:       'DEMO_RESCHEDULED_BY_TEACHER',
    category:   'demo',
    title:      'Demo Rescheduled',
    body:       `Teacher rescheduled the demo to ${newDate.toLocaleDateString('en-IN')}.`,
    data:       { screen: 'DemoClasses', contactRequestId: String(contactRequestId) },
    entityId:   contactRequestId,
    entityType: 'ContactRequest',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Hiring Workflow Notifications
// ─────────────────────────────────────────────────────────────────────────────

// Teacher: application viewed by parent
export async function notifyApplicationViewed(
  teacherUserId: mongoose.Types.ObjectId | string,
  applicationId: mongoose.Types.ObjectId | string,
) {
  return sendNotification({
    userId:     teacherUserId,
    type:       'APPLICATION_VIEWED',
    category:   'application',
    title:      'Application Viewed',
    body:       'A parent has viewed your application.',
    data:       { screen: 'Applications', applicationId: String(applicationId) },
    entityId:   applicationId,
    entityType: 'TutorApplication',
  });
}

// Teacher: application rejected by parent
export async function notifyApplicationRejected(
  teacherUserId: mongoose.Types.ObjectId | string,
  applicationId: mongoose.Types.ObjectId | string,
  reason?: string,
) {
  return sendNotification({
    userId:     teacherUserId,
    type:       'APPLICATION_REJECTED',
    category:   'application',
    title:      'Application Not Selected',
    body:       reason || 'Your application was not selected for this requirement.',
    data:       { screen: 'Applications', applicationId: String(applicationId) },
    entityId:   applicationId,
    entityType: 'TutorApplication',
  });
}

// Teacher: selected for requirement (pre-hire)
export async function notifyTeacherSelected(
  teacherUserId: mongoose.Types.ObjectId | string,
  subject: string,
  applicationId: mongoose.Types.ObjectId | string,
) {
  return sendNotification({
    userId:     teacherUserId,
    type:       'TEACHER_SELECTED',
    category:   'application',
    title:      'You Have Been Selected!',
    body:       `Congratulations! You have been selected for the ${subject} requirement. Awaiting final confirmation.`,
    data:       { screen: 'Applications', applicationId: String(applicationId) },
    entityId:   applicationId,
    entityType: 'TutorApplication',
  });
}

// Teacher: hired for requirement
export async function notifyTeacherHired(
  teacherUserId: mongoose.Types.ObjectId | string,
  subject: string,
  studentName: string,
  applicationId: mongoose.Types.ObjectId | string,
) {
  return sendNotification({
    userId:     teacherUserId,
    type:       'TEACHER_HIRED',
    category:   'application',
    title:      'You Are Hired!',
    body:       `Congratulations! You have been hired to teach ${subject} to ${studentName}.`,
    data:       { screen: 'Classes', applicationId: String(applicationId) },
    entityId:   applicationId,
    entityType: 'TutorApplication',
  });
}

// Teacher: requirement closed (they were not selected)
export async function notifyRequirementClosed(
  teacherUserId: mongoose.Types.ObjectId | string,
  requirementId: string,
  reason: string,
) {
  return sendNotification({
    userId:     teacherUserId,
    type:       'REQUIREMENT_CLOSED',
    category:   'application',
    title:      'Requirement Closed',
    body:       `Requirement ${requirementId} has been closed. ${reason}`,
    data:       { screen: 'Applications' },
    entityType: 'ParentRequirement',
  });
}
