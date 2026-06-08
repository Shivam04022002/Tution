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
//# sourceMappingURL=notificationService.js.map