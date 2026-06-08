"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canTeacherViewParentContact = canTeacherViewParentContact;
exports.canParentViewTeacherContact = canParentViewTeacherContact;
exports.getVisibleContactData = getVisibleContactData;
const LeadUnlock_1 = require("../models/LeadUnlock");
const TeacherProfile_1 = require("../models/TeacherProfile");
const ParentRequirement_1 = require("../models/ParentRequirement");
async function canTeacherViewParentContact(tutorId, requirementId) {
    const unlock = await LeadUnlock_1.LeadUnlock.findOne({
        tutorId,
        requirementId,
        unlockStatus: 'active',
        'paymentDetails.paymentStatus': 'completed',
        expiresAt: { $gt: new Date() },
    }).lean();
    return unlock !== null;
}
async function canParentViewTeacherContact(parentId, tutorId) {
    const unlock = await LeadUnlock_1.LeadUnlock.findOne({
        parentId,
        tutorId,
        unlockStatus: 'active',
        'paymentDetails.paymentStatus': 'completed',
        expiresAt: { $gt: new Date() },
    }).lean();
    return unlock !== null;
}
const HIDDEN_PHONE = '+91 XXXXXXXXXX';
const HIDDEN_EMAIL = '****@****.com';
const HIDDEN_ADDRESS = 'Address hidden — unlock to view';
async function getVisibleContactData(viewerRole, viewerId, targetId, contextId) {
    let hasAccess = false;
    if (viewerRole === 'teacher') {
        if (!contextId) {
            hasAccess = false;
        }
        else {
            hasAccess = await canTeacherViewParentContact(viewerId, contextId);
        }
        if (hasAccess) {
            const req = await ParentRequirement_1.ParentRequirement.findById(contextId).lean();
            if (!req) {
                return { phone: HIDDEN_PHONE, email: HIDDEN_EMAIL, address: HIDDEN_ADDRESS, isUnlocked: false };
            }
            const unlock = await LeadUnlock_1.LeadUnlock.findOne({
                tutorId: viewerId,
                requirementId: contextId,
                unlockStatus: 'active',
                'paymentDetails.paymentStatus': 'completed',
            }).lean();
            if (!unlock) {
                return { phone: HIDDEN_PHONE, email: HIDDEN_EMAIL, address: HIDDEN_ADDRESS, isUnlocked: false };
            }
            return {
                phone: unlock.parentContactDetails.mobileNumber,
                email: unlock.parentContactDetails.email,
                address: unlock.parentContactDetails.address,
                isUnlocked: true,
            };
        }
        return { phone: HIDDEN_PHONE, email: HIDDEN_EMAIL, address: HIDDEN_ADDRESS, isUnlocked: false };
    }
    hasAccess = await canParentViewTeacherContact(viewerId, targetId);
    if (hasAccess) {
        const profile = await TeacherProfile_1.TeacherProfile.findById(targetId)
            .select('basicDetails.mobileNumber basicDetails.email locationAvailability.address')
            .lean();
        if (!profile) {
            return { phone: HIDDEN_PHONE, email: HIDDEN_EMAIL, address: HIDDEN_ADDRESS, isUnlocked: false };
        }
        return {
            phone: profile.basicDetails.mobileNumber,
            email: profile.basicDetails.email,
            address: profile.locationAvailability.address,
            isUnlocked: true,
        };
    }
    return { phone: HIDDEN_PHONE, email: HIDDEN_EMAIL, address: HIDDEN_ADDRESS, isUnlocked: false };
}
//# sourceMappingURL=contactAccessService.js.map