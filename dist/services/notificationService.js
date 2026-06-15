"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotification = sendNotification;
exports.sendNotificationToMany = sendNotificationToMany;
exports.notifyTeacherApplied = notifyTeacherApplied;
exports.notifyDemoScheduled = notifyDemoScheduled;
exports.notifyPaymentSuccess = notifyPaymentSuccess;
exports.notifyRefundApproved = notifyRefundApproved;
exports.notifyRefundRejected = notifyRefundRejected;
exports.notifyNewLeadMatch = notifyNewLeadMatch;
exports.notifyApplicationShortlisted = notifyApplicationShortlisted;
exports.notifyDemoConfirmed = notifyDemoConfirmed;
exports.notifyLeadUnlockSuccess = notifyLeadUnlockSuccess;
exports.notifyAdminRefundRequest = notifyAdminRefundRequest;
exports.notifyAdminTeacherRegistration = notifyAdminTeacherRegistration;
exports.notifyAdminImportCompleted = notifyAdminImportCompleted;
exports.notifyContactRequestReceived = notifyContactRequestReceived;
exports.notifyDemoRequestReceived = notifyDemoRequestReceived;
exports.notifyContactRequestAccepted = notifyContactRequestAccepted;
exports.notifyContactRequestRejected = notifyContactRequestRejected;
exports.notifyDemoAccepted = notifyDemoAccepted;
exports.notifyDemoRejected = notifyDemoRejected;
exports.notifyDemoCompleted = notifyDemoCompleted;
exports.notifyDemoRescheduled = notifyDemoRescheduled;
exports.notifyApplicationViewed = notifyApplicationViewed;
exports.notifyApplicationRejected = notifyApplicationRejected;
exports.notifyTeacherSelected = notifyTeacherSelected;
exports.notifyTeacherHired = notifyTeacherHired;
exports.notifyRequirementClosed = notifyRequirementClosed;
const Notification_1 = require("../models/Notification");
async function sendNotification(input) {
    try {
        const doc = await Notification_1.Notification.create({
            userId: input.userId,
            type: input.type,
            category: input.category,
            title: input.title,
            body: input.body,
            data: input.data,
            entityId: input.entityId,
            entityType: input.entityType,
            isRead: false,
        });
        return doc;
    }
    catch (err) {
        console.error('[NotificationService] Failed to persist notification:', err);
        return null;
    }
}
async function sendNotificationToMany(userIds, input) {
    if (!userIds.length)
        return;
    try {
        const docs = userIds.map((uid) => ({
            userId: uid,
            type: input.type,
            category: input.category,
            title: input.title,
            body: input.body,
            data: input.data,
            entityId: input.entityId,
            entityType: input.entityType,
            isRead: false,
        }));
        await Notification_1.Notification.insertMany(docs, { ordered: false });
    }
    catch (err) {
        console.error('[NotificationService] Bulk notification failed:', err);
    }
}
async function notifyTeacherApplied(parentUserId, teacherName, subject, applicationId) {
    return sendNotification({
        userId: parentUserId,
        type: 'TEACHER_APPLIED',
        category: 'application',
        title: 'New Tutor Application',
        body: `${teacherName} has applied for your ${subject} requirement.`,
        data: { screen: 'Applications', applicationId: String(applicationId) },
        entityId: applicationId,
        entityType: 'TutorApplication',
    });
}
async function notifyDemoScheduled(parentUserId, teacherName, subject, demoDate, demoId) {
    return sendNotification({
        userId: parentUserId,
        type: 'DEMO_SCHEDULED',
        category: 'demo',
        title: 'Demo Class Scheduled',
        body: `Demo for ${subject} with ${teacherName} on ${demoDate.toLocaleDateString('en-IN')}.`,
        data: { screen: 'DemoClasses', demoId: String(demoId) },
        entityId: demoId,
        entityType: 'DemoClass',
    });
}
async function notifyPaymentSuccess(parentUserId, amount, description, paymentId) {
    return sendNotification({
        userId: parentUserId,
        type: 'PAYMENT_SUCCESS',
        category: 'payment',
        title: 'Payment Successful',
        body: `₹${amount} paid successfully for ${description}.`,
        data: { screen: 'Invoices', paymentId: String(paymentId) },
        entityId: paymentId,
        entityType: 'Payment',
    });
}
async function notifyRefundApproved(userId, amount, refundRequestId, refundId) {
    return sendNotification({
        userId,
        type: 'REFUND_APPROVED',
        category: 'payment',
        title: 'Refund Approved',
        body: `Your refund of ₹${amount} has been approved and processed.`,
        data: { screen: 'Refunds', refundRequestId },
        entityId: refundId,
        entityType: 'RefundRequest',
    });
}
async function notifyRefundRejected(userId, amount, reason, refundId) {
    return sendNotification({
        userId,
        type: 'REFUND_REJECTED',
        category: 'payment',
        title: 'Refund Not Approved',
        body: `Your refund request for ₹${amount} was not approved. Reason: ${reason}`,
        data: { screen: 'Refunds' },
        entityId: refundId,
        entityType: 'RefundRequest',
    });
}
async function notifyNewLeadMatch(teacherUserId, subject, grade, city, requirementId) {
    return sendNotification({
        userId: teacherUserId,
        type: 'NEW_LEAD_MATCH',
        category: 'lead',
        title: 'New Lead Available',
        body: `A new ${subject} lead for Grade ${grade} in ${city} matches your profile.`,
        data: { screen: 'Leads', requirementId: String(requirementId) },
        entityId: requirementId,
        entityType: 'ParentRequirement',
    });
}
async function notifyApplicationShortlisted(teacherUserId, subject, applicationId) {
    return sendNotification({
        userId: teacherUserId,
        type: 'APPLICATION_SHORTLISTED',
        category: 'application',
        title: 'Application Shortlisted',
        body: `Your application for ${subject} has been shortlisted.`,
        data: { screen: 'Applications', applicationId: String(applicationId) },
        entityId: applicationId,
        entityType: 'TutorApplication',
    });
}
async function notifyDemoConfirmed(teacherUserId, subject, demoDate, demoId) {
    return sendNotification({
        userId: teacherUserId,
        type: 'DEMO_CONFIRMED',
        category: 'demo',
        title: 'Demo Class Confirmed',
        body: `Your demo for ${subject} is confirmed on ${demoDate.toLocaleDateString('en-IN')}.`,
        data: { screen: 'DemoClasses', demoId: String(demoId) },
        entityId: demoId,
        entityType: 'DemoClass',
    });
}
async function notifyLeadUnlockSuccess(teacherUserId, parentName, unlockId) {
    return sendNotification({
        userId: teacherUserId,
        type: 'LEAD_UNLOCK_SUCCESS',
        category: 'lead',
        title: 'Lead Unlocked',
        body: `You unlocked ${parentName}'s contact details. View in Lead Marketplace.`,
        data: { screen: 'Leads', unlockId: String(unlockId) },
        entityId: unlockId,
        entityType: 'LeadUnlock',
    });
}
async function notifyAdminRefundRequest(adminUserIds, requestedAmount, refundRequestId, entityId) {
    return sendNotificationToMany(adminUserIds, {
        type: 'REFUND_REQUEST',
        category: 'admin',
        title: 'New Refund Request',
        body: `A refund of ₹${requestedAmount} has been requested. ID: ${refundRequestId}`,
        data: { screen: 'AdminRefunds', refundRequestId },
        entityId,
        entityType: 'RefundRequest',
    });
}
async function notifyAdminTeacherRegistration(adminUserIds, teacherName, teacherId) {
    return sendNotificationToMany(adminUserIds, {
        type: 'TEACHER_REGISTRATION',
        category: 'admin',
        title: 'New Teacher Registered',
        body: `${teacherName} has completed registration and is awaiting approval.`,
        data: { screen: 'Teachers', teacherId: String(teacherId) },
        entityId: teacherId,
        entityType: 'TeacherProfile',
    });
}
async function notifyAdminImportCompleted(adminUserIds, importType, count, importId) {
    return sendNotificationToMany(adminUserIds, {
        type: 'IMPORT_COMPLETED',
        category: 'admin',
        title: 'Import Completed',
        body: `${importType} import finished. ${count} records processed.`,
        data: { screen: 'Import', importId: String(importId) },
        entityId: importId,
        entityType: 'ImportHistory',
    });
}
async function notifyContactRequestReceived(teacherUserId, parentName, contactType, contactRequestId) {
    const typeLabels = {
        call: 'phone call',
        whatsapp: 'WhatsApp message',
        message: 'message',
    };
    return sendNotification({
        userId: teacherUserId,
        type: 'CONTACT_REQUEST_RECEIVED',
        category: 'application',
        title: 'New Contact Request',
        body: `${parentName} wants to connect via ${typeLabels[contactType] || 'message'}.`,
        data: { screen: 'ContactRequests', contactRequestId: String(contactRequestId) },
        entityId: contactRequestId,
        entityType: 'ContactRequest',
    });
}
async function notifyDemoRequestReceived(teacherUserId, parentName, demoDate, contactRequestId) {
    return sendNotification({
        userId: teacherUserId,
        type: 'DEMO_REQUEST_RECEIVED',
        category: 'demo',
        title: 'New Demo Request',
        body: `${parentName} requested a demo class on ${demoDate.toLocaleDateString('en-IN')}.`,
        data: { screen: 'DemoRequests', contactRequestId: String(contactRequestId) },
        entityId: contactRequestId,
        entityType: 'ContactRequest',
    });
}
async function notifyContactRequestAccepted(parentUserId, contactType, contactRequestId) {
    return sendNotification({
        userId: parentUserId,
        type: 'CONTACT_REQUEST_ACCEPTED',
        category: 'application',
        title: 'Contact Request Accepted',
        body: `Teacher accepted your ${contactType} request. You can now connect.`,
        data: { screen: 'ContactHistory', contactRequestId: String(contactRequestId) },
        entityId: contactRequestId,
        entityType: 'ContactRequest',
    });
}
async function notifyContactRequestRejected(parentUserId, contactType, reason, contactRequestId) {
    return sendNotification({
        userId: parentUserId,
        type: 'CONTACT_REQUEST_REJECTED',
        category: 'application',
        title: 'Contact Request Declined',
        body: reason || `Teacher declined your ${contactType} request.`,
        data: { screen: 'ContactHistory', contactRequestId: String(contactRequestId) },
        entityId: contactRequestId,
        entityType: 'ContactRequest',
    });
}
async function notifyDemoAccepted(parentUserId, demoDate, contactRequestId) {
    return sendNotification({
        userId: parentUserId,
        type: 'DEMO_REQUEST_ACCEPTED',
        category: 'demo',
        title: 'Demo Request Accepted',
        body: `Teacher accepted your demo request for ${demoDate.toLocaleDateString('en-IN')}.`,
        data: { screen: 'DemoClasses', contactRequestId: String(contactRequestId) },
        entityId: contactRequestId,
        entityType: 'ContactRequest',
    });
}
async function notifyDemoRejected(parentUserId, reason, contactRequestId) {
    return sendNotification({
        userId: parentUserId,
        type: 'DEMO_REQUEST_REJECTED',
        category: 'demo',
        title: 'Demo Request Declined',
        body: reason || 'Teacher declined your demo request.',
        data: { screen: 'DemoClasses', contactRequestId: String(contactRequestId) },
        entityId: contactRequestId,
        entityType: 'ContactRequest',
    });
}
async function notifyDemoCompleted(parentUserId, outcome, contactRequestId) {
    const outcomeLabels = {
        interested: 'Teacher marked the demo complete — they are interested!',
        not_interested: 'Teacher has marked the demo as complete.',
        need_follow_up: 'Teacher marked the demo complete and wants a follow-up.',
    };
    return sendNotification({
        userId: parentUserId,
        type: 'DEMO_COMPLETED',
        category: 'demo',
        title: 'Demo Class Completed',
        body: outcomeLabels[outcome] || 'Your demo class has been marked complete.',
        data: { screen: 'DemoClasses', contactRequestId: String(contactRequestId) },
        entityId: contactRequestId,
        entityType: 'ContactRequest',
    });
}
async function notifyDemoRescheduled(parentUserId, newDate, contactRequestId) {
    return sendNotification({
        userId: parentUserId,
        type: 'DEMO_RESCHEDULED_BY_TEACHER',
        category: 'demo',
        title: 'Demo Rescheduled',
        body: `Teacher rescheduled the demo to ${newDate.toLocaleDateString('en-IN')}.`,
        data: { screen: 'DemoClasses', contactRequestId: String(contactRequestId) },
        entityId: contactRequestId,
        entityType: 'ContactRequest',
    });
}
async function notifyApplicationViewed(teacherUserId, applicationId) {
    return sendNotification({
        userId: teacherUserId,
        type: 'APPLICATION_VIEWED',
        category: 'application',
        title: 'Application Viewed',
        body: 'A parent has viewed your application.',
        data: { screen: 'Applications', applicationId: String(applicationId) },
        entityId: applicationId,
        entityType: 'TutorApplication',
    });
}
async function notifyApplicationRejected(teacherUserId, applicationId, reason) {
    return sendNotification({
        userId: teacherUserId,
        type: 'APPLICATION_REJECTED',
        category: 'application',
        title: 'Application Not Selected',
        body: reason || 'Your application was not selected for this requirement.',
        data: { screen: 'Applications', applicationId: String(applicationId) },
        entityId: applicationId,
        entityType: 'TutorApplication',
    });
}
async function notifyTeacherSelected(teacherUserId, subject, applicationId) {
    return sendNotification({
        userId: teacherUserId,
        type: 'TEACHER_SELECTED',
        category: 'application',
        title: 'You Have Been Selected!',
        body: `Congratulations! You have been selected for the ${subject} requirement. Awaiting final confirmation.`,
        data: { screen: 'Applications', applicationId: String(applicationId) },
        entityId: applicationId,
        entityType: 'TutorApplication',
    });
}
async function notifyTeacherHired(teacherUserId, subject, studentName, applicationId) {
    return sendNotification({
        userId: teacherUserId,
        type: 'TEACHER_HIRED',
        category: 'application',
        title: 'You Are Hired!',
        body: `Congratulations! You have been hired to teach ${subject} to ${studentName}.`,
        data: { screen: 'Classes', applicationId: String(applicationId) },
        entityId: applicationId,
        entityType: 'TutorApplication',
    });
}
async function notifyRequirementClosed(teacherUserId, requirementId, reason) {
    return sendNotification({
        userId: teacherUserId,
        type: 'REQUIREMENT_CLOSED',
        category: 'application',
        title: 'Requirement Closed',
        body: `Requirement ${requirementId} has been closed. ${reason}`,
        data: { screen: 'Applications' },
        entityType: 'ParentRequirement',
    });
}
//# sourceMappingURL=notificationService.js.map