import mongoose from 'mongoose';
import { LeadUnlock } from '../models/LeadUnlock';
import { TeacherProfile, ITeacherProfile } from '../models/TeacherProfile';
import { ParentRequirement, IParentRequirement } from '../models/ParentRequirement';

// ─────────────────────────────────────────────────────────────────────────────
// canTeacherViewParentContact
// Returns true when a teacher has an active paid unlock for that requirement.
// ─────────────────────────────────────────────────────────────────────────────
export async function canTeacherViewParentContact(
  tutorId: mongoose.Types.ObjectId | string,
  requirementId: mongoose.Types.ObjectId | string,
): Promise<boolean> {
  const unlock = await LeadUnlock.findOne({
    tutorId,
    requirementId,
    unlockStatus: 'active',
    'paymentDetails.paymentStatus': 'completed',
    expiresAt: { $gt: new Date() },
  }).lean();

  return unlock !== null;
}

// ─────────────────────────────────────────────────────────────────────────────
// canParentViewTeacherContact
// Returns true when a parent has an active paid unlock for that teacher.
// ─────────────────────────────────────────────────────────────────────────────
export async function canParentViewTeacherContact(
  parentId: mongoose.Types.ObjectId | string,
  tutorId: mongoose.Types.ObjectId | string,
): Promise<boolean> {
  const unlock = await LeadUnlock.findOne({
    parentId,
    tutorId,
    unlockStatus: 'active',
    'paymentDetails.paymentStatus': 'completed',
    expiresAt: { $gt: new Date() },
  }).lean();

  return unlock !== null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Masked placeholders shown before unlock
// ─────────────────────────────────────────────────────────────────────────────
const HIDDEN_PHONE = '+91 XXXXXXXXXX';
const HIDDEN_EMAIL = '****@****.com';
const HIDDEN_ADDRESS = 'Address hidden — unlock to view';

// ─────────────────────────────────────────────────────────────────────────────
// getVisibleContactData
// Merges profile data with access check.  Hidden fields are replaced with
// placeholders when the caller has not paid for access.
// ─────────────────────────────────────────────────────────────────────────────
export async function getVisibleContactData(
  viewerRole: 'teacher' | 'parent',
  viewerId: mongoose.Types.ObjectId | string,
  targetId: mongoose.Types.ObjectId | string,
  contextId?: mongoose.Types.ObjectId | string, // requirementId (teacher) or tutorId (parent)
): Promise<{
  phone: string;
  email: string;
  address: string;
  isUnlocked: boolean;
}> {
  let hasAccess = false;

  if (viewerRole === 'teacher') {
    // Teacher viewing parent contact — contextId = requirementId
    if (!contextId) {
      hasAccess = false;
    } else {
      hasAccess = await canTeacherViewParentContact(viewerId, contextId);
    }

    if (hasAccess) {
      const req = await ParentRequirement.findById(contextId).lean() as IParentRequirement | null;
      if (!req) {
        return { phone: HIDDEN_PHONE, email: HIDDEN_EMAIL, address: HIDDEN_ADDRESS, isUnlocked: false };
      }
      // Parent contact details are stored inside the LeadUnlock record
      const unlock = await LeadUnlock.findOne({
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

  // Parent viewing teacher contact — targetId = tutorId
  hasAccess = await canParentViewTeacherContact(viewerId, targetId);

  if (hasAccess) {
    const profile = await TeacherProfile.findById(targetId)
      .select('basicDetails.mobileNumber basicDetails.email locationAvailability.address')
      .lean() as ITeacherProfile | null;

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
