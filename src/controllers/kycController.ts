import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { TeacherKyc, KycStatus, KycDocumentType } from '../models/TeacherKyc';
import { TeacherProfile } from '../models/TeacherProfile';
import { User } from '../models/User';
import { v2 as cloudinary } from 'cloudinary';
import {
  sendNotification,
  sendNotificationToMany,
} from '../services/notificationService';

// ─────────────────────────────────────────────────────────────────────────────
// Audit helper
// ─────────────────────────────────────────────────────────────────────────────
const writeAuditLog = async (
  userId: any,
  action: string,
  entityType: string,
  entityId: string,
  oldValue: any,
  newValue: any,
) => {
  try {
    console.log(`[AUDIT] ${action}: ${entityType} ${entityId} by ${userId}`);
  } catch (e) {
    // Silent
  }
};

// Required document types for submission
const REQUIRED_DOCUMENT_TYPES: KycDocumentType[] = [
  'PAN_CARD',
  'AADHAAR_FRONT',
  'AADHAAR_BACK',
  'SELFIE_PHOTO',
];

// ─────────────────────────────────────────────────────────────────────────────
// TEACHER ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/kyc/upload
 * Upload a KYC document
 */
export const uploadKycDocument = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { documentType } = req.body as { documentType: KycDocumentType };
    const file = (req as any).file;

    if (!documentType) {
      return res.status(400).json({ success: false, message: 'documentType is required' });
    }

    const validTypes: KycDocumentType[] = ['PAN_CARD', 'AADHAAR_FRONT', 'AADHAAR_BACK', 'BANK_PROOF', 'ADDRESS_PROOF', 'SELFIE_PHOTO'];
    if (!validTypes.includes(documentType)) {
      return res.status(400).json({ success: false, message: 'Invalid document type' });
    }

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Get teacher profile
    const profile = await TeacherProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    // Get or create KYC record
    let kyc = await TeacherKyc.findOne({ teacherId: profile._id });
    if (!kyc) {
      kyc = new TeacherKyc({ teacherId: profile._id, documents: [] });
    }

    // Prevent editing after approval
    if (kyc.status === 'approved') {
      return res.status(400).json({ success: false, message: 'KYC is already approved. Cannot modify.' });
    }

    // Upload to Cloudinary
    const folder = `kyc/${documentType.toLowerCase()}`;
    const publicId = `kyc_${profile._id}_${documentType}_${Date.now()}`;

    const result = await cloudinary.uploader.upload(file.path, {
      folder,
      public_id: publicId,
      resource_type: 'image',
    });

    // Remove existing document of same type (replace)
    const existingIdx = kyc.documents.findIndex(d => d.documentType === documentType);
    if (existingIdx !== -1) {
      const existingDoc = kyc.documents[existingIdx];
      // Delete old from Cloudinary (non-blocking)
      cloudinary.uploader.destroy(existingDoc.cloudinaryPublicId).catch(() => {});
      kyc.documents.splice(existingIdx, 1);

      await writeAuditLog(userId, 'DOCUMENT_REPLACED', 'TeacherKyc', kyc.kycId || '', { documentType }, { documentType, url: result.secure_url });
    } else {
      await writeAuditLog(userId, 'DOCUMENT_UPLOADED', 'TeacherKyc', kyc.kycId || '', null, { documentType, url: result.secure_url });
    }

    // Add new document
    kyc.documents.push({
      _id: new mongoose.Types.ObjectId(),
      documentType,
      documentUrl: result.secure_url,
      cloudinaryPublicId: result.public_id,
      verificationStatus: 'pending',
      uploadedAt: new Date(),
    });

    // If status was reupload_required, move back to draft
    if (kyc.status === 'reupload_required' || kyc.status === 'rejected') {
      kyc.status = 'draft';
    }

    await kyc.save();

    return res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        kycId: kyc.kycId,
        document: kyc.documents[kyc.documents.length - 1],
      },
    });
  } catch (error: any) {
    console.error('Upload KYC document error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload document', error: error.message });
  }
};

/**
 * POST /api/kyc/submit
 * Submit KYC for review
 */
export const submitKyc = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const profile = await TeacherProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    // Check profile completion >= 70%
    const profileCompletion = profile.get('profileCompletion') || 0;
    if (profileCompletion < 70) {
      return res.status(400).json({
        success: false,
        message: 'Profile completion must be at least 70% before submitting KYC',
        data: { currentCompletion: profileCompletion },
      });
    }

    let kyc = await TeacherKyc.findOne({ teacherId: profile._id });
    if (!kyc) {
      return res.status(400).json({ success: false, message: 'No KYC record found. Please upload documents first.' });
    }

    // Prevent duplicate submission
    if (kyc.status === 'submitted' || kyc.status === 'under_review') {
      return res.status(400).json({ success: false, message: 'KYC is already submitted and pending review' });
    }

    if (kyc.status === 'approved') {
      return res.status(400).json({ success: false, message: 'KYC is already approved' });
    }

    // Validate required documents
    const uploadedTypes = kyc.documents.map(d => d.documentType);
    const missingDocs = REQUIRED_DOCUMENT_TYPES.filter(t => !uploadedTypes.includes(t));
    if (missingDocs.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Required documents missing',
        data: { missingDocuments: missingDocs },
      });
    }

    // Update status
    const oldStatus = kyc.status;
    kyc.status = 'submitted';
    kyc.submittedAt = new Date();
    await kyc.save();

    await writeAuditLog(userId, 'KYC_SUBMITTED', 'TeacherKyc', kyc.kycId, { status: oldStatus }, { status: 'submitted' });

    // Notify teacher
    await sendNotification({
      userId,
      type: 'KYC_SUBMITTED' as any,
      category: 'system',
      title: 'KYC Submitted',
      body: 'Your KYC documents have been submitted for verification. Review typically takes 24-48 hours.',
      data: { screen: 'TeacherKycStatus' },
      entityId: kyc._id,
      entityType: 'TeacherKyc',
    });

    // Notify admins
    const admins = await User.find({ role: 'admin' }).select('_id');
    const adminIds = admins.map(a => a._id);
    if (adminIds.length > 0) {
      await sendNotificationToMany(adminIds, {
        type: 'NEW_KYC_SUBMISSION' as any,
        category: 'admin',
        title: 'New KYC Submission',
        body: `${profile.basicDetails?.fullName || 'A teacher'} has submitted KYC for verification.`,
        data: { screen: 'AdminKycDetail', kycId: kyc._id.toString() },
        entityId: kyc._id,
        entityType: 'TeacherKyc',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'KYC submitted for verification',
      data: {
        kycId: kyc.kycId,
        status: kyc.status,
        submittedAt: kyc.submittedAt,
        estimatedReviewTime: '24-48 hours',
      },
    });
  } catch (error: any) {
    console.error('Submit KYC error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit KYC', error: error.message });
  }
};

/**
 * GET /api/kyc/status
 * Get KYC status summary
 */
export const getKycStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const profile = await TeacherProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    const kyc = await TeacherKyc.findOne({ teacherId: profile._id });

    if (!kyc) {
      return res.status(200).json({
        success: true,
        data: {
          status: 'not_started',
          documentsUploaded: 0,
          requiredDocuments: REQUIRED_DOCUMENT_TYPES,
          missingDocuments: REQUIRED_DOCUMENT_TYPES,
          canSubmit: false,
        },
      });
    }

    const uploadedTypes = kyc.documents.map(d => d.documentType);
    const missingDocs = REQUIRED_DOCUMENT_TYPES.filter(t => !uploadedTypes.includes(t));
    const profileCompletion = profile.get('profileCompletion') || 0;

    return res.status(200).json({
      success: true,
      data: {
        kycId: kyc.kycId,
        status: kyc.status,
        documentsUploaded: kyc.documents.length,
        requiredDocuments: REQUIRED_DOCUMENT_TYPES,
        missingDocuments: missingDocs,
        submittedAt: kyc.submittedAt,
        reviewedAt: kyc.reviewedAt,
        approvedAt: kyc.approvedAt,
        rejectedAt: kyc.rejectedAt,
        rejectionReason: kyc.rejectionReason,
        verificationNotes: kyc.verificationNotes,
        profileCompletion,
        canSubmit: missingDocs.length === 0 && profileCompletion >= 70 && ['draft', 'reupload_required', 'rejected'].includes(kyc.status),
      },
    });
  } catch (error: any) {
    console.error('Get KYC status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get KYC status', error: error.message });
  }
};

/**
 * GET /api/kyc/details
 * Get full KYC details including documents
 */
export const getKycDetails = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const profile = await TeacherProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    const kyc = await TeacherKyc.findOne({ teacherId: profile._id }).populate('reviewedBy', 'profile.firstName profile.lastName');

    if (!kyc) {
      return res.status(200).json({
        success: true,
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        kycId: kyc.kycId,
        status: kyc.status,
        documents: kyc.documents,
        verificationNotes: kyc.verificationNotes,
        submittedAt: kyc.submittedAt,
        reviewedAt: kyc.reviewedAt,
        reviewedBy: kyc.reviewedBy,
        approvedAt: kyc.approvedAt,
        rejectedAt: kyc.rejectedAt,
        rejectionReason: kyc.rejectionReason,
        createdAt: kyc.createdAt,
        updatedAt: kyc.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Get KYC details error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get KYC details', error: error.message });
  }
};

/**
 * PUT /api/kyc/document/:documentId
 * Replace a specific KYC document
 */
export const updateKycDocument = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const documentId = req.params.documentId as string;
    const file = (req as any).file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    if (!documentId || !mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({ success: false, message: 'Invalid document ID' });
    }

    const profile = await TeacherProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    const kyc = await TeacherKyc.findOne({ teacherId: profile._id });
    if (!kyc) {
      return res.status(404).json({ success: false, message: 'KYC record not found' });
    }

    if (kyc.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Cannot modify documents after approval' });
    }

    const docIdx = kyc.documents.findIndex(d => d._id.toString() === documentId);
    if (docIdx === -1) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const existingDoc = kyc.documents[docIdx];

    // Upload new to Cloudinary
    const folder = `kyc/${existingDoc.documentType.toLowerCase()}`;
    const publicId = `kyc_${profile._id}_${existingDoc.documentType}_${Date.now()}`;

    const result = await cloudinary.uploader.upload(file.path, {
      folder,
      public_id: publicId,
      resource_type: 'image',
    });

    // Delete old from Cloudinary
    cloudinary.uploader.destroy(existingDoc.cloudinaryPublicId).catch(() => {});

    // Update document
    kyc.documents[docIdx].documentUrl = result.secure_url;
    kyc.documents[docIdx].cloudinaryPublicId = result.public_id;
    kyc.documents[docIdx].verificationStatus = 'pending';
    kyc.documents[docIdx].uploadedAt = new Date();
    kyc.documents[docIdx].verifiedAt = undefined;
    kyc.documents[docIdx].notes = undefined;

    // If reupload_required, move back to draft
    if (kyc.status === 'reupload_required' || kyc.status === 'rejected') {
      kyc.status = 'draft';
    }

    await kyc.save();

    await writeAuditLog(userId, 'DOCUMENT_REPLACED', 'TeacherKyc', kyc.kycId, { documentType: existingDoc.documentType }, { url: result.secure_url });

    return res.status(200).json({
      success: true,
      message: 'Document updated successfully',
      data: { document: kyc.documents[docIdx] },
    });
  } catch (error: any) {
    console.error('Update KYC document error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update document', error: error.message });
  }
};

/**
 * DELETE /api/kyc/document/:documentId
 * Delete a KYC document
 */
export const deleteKycDocument = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const documentId = req.params.documentId as string;

    if (!documentId || !mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({ success: false, message: 'Invalid document ID' });
    }

    const profile = await TeacherProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    const kyc = await TeacherKyc.findOne({ teacherId: profile._id });
    if (!kyc) {
      return res.status(404).json({ success: false, message: 'KYC record not found' });
    }

    if (kyc.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Cannot delete documents after approval' });
    }

    if (kyc.status === 'submitted' || kyc.status === 'under_review') {
      return res.status(400).json({ success: false, message: 'Cannot delete documents while under review' });
    }

    const docIdx = kyc.documents.findIndex(d => d._id.toString() === documentId);
    if (docIdx === -1) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const doc = kyc.documents[docIdx];

    // Delete from Cloudinary
    cloudinary.uploader.destroy(doc.cloudinaryPublicId).catch(() => {});

    kyc.documents.splice(docIdx, 1);
    await kyc.save();

    await writeAuditLog(userId, 'DOCUMENT_DELETED', 'TeacherKyc', kyc.kycId, { documentType: doc.documentType }, null);

    return res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete KYC document error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete document', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/kyc
 * List all KYC submissions with optional status filter
 */
export const getKycQueue = async (req: AuthRequest, res: Response) => {
  try {
    const { status, page = '1', limit = '20', search } = req.query;

    const filter: any = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    // Get KYC records
    let query = TeacherKyc.find(filter)
      .populate({
        path: 'teacherId',
        select: 'basicDetails verificationStatus userId',
        populate: { path: 'userId', select: 'profile.firstName profile.lastName email phoneNumber' },
      })
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const [records, total] = await Promise.all([
      query.exec(),
      TeacherKyc.countDocuments(filter),
    ]);

    // Get counts by status
    const [submitted, underReview, approved, rejected, reuploadRequired] = await Promise.all([
      TeacherKyc.countDocuments({ status: 'submitted' }),
      TeacherKyc.countDocuments({ status: 'under_review' }),
      TeacherKyc.countDocuments({ status: 'approved' }),
      TeacherKyc.countDocuments({ status: 'rejected' }),
      TeacherKyc.countDocuments({ status: 'reupload_required' }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        records,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
        counts: {
          all: total,
          submitted,
          under_review: underReview,
          approved,
          rejected,
          reupload_required: reuploadRequired,
        },
      },
    });
  } catch (error: any) {
    console.error('Get KYC queue error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get KYC queue', error: error.message });
  }
};

/**
 * GET /api/admin/kyc/:id
 * Get KYC detail for admin review
 */
export const getKycDetailAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const kyc = await TeacherKyc.findById(id)
      .populate({
        path: 'teacherId',
        select: 'basicDetails education teachingDetails locationAvailability pricingRevenue verificationStatus verificationDocuments documents stats isVerified',
        populate: { path: 'userId', select: 'profile.firstName profile.lastName email phoneNumber createdAt' },
      })
      .populate('reviewedBy', 'profile.firstName profile.lastName email');

    if (!kyc) {
      return res.status(404).json({ success: false, message: 'KYC record not found' });
    }

    // Calculate profile completion
    const teacherProfile = kyc.teacherId as any;
    const profileCompletion = teacherProfile?.profileCompletion || 0;

    return res.status(200).json({
      success: true,
      data: {
        kyc,
        teacherProfile,
        profileCompletion,
      },
    });
  } catch (error: any) {
    console.error('Get KYC detail admin error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get KYC details', error: error.message });
  }
};

/**
 * POST /api/admin/kyc/:id/approve
 * Approve KYC
 */
export const approveKyc = async (req: AuthRequest, res: Response) => {
  try {
    const adminUserId = req.user?._id;
    const { id } = req.params;
    const { notes } = req.body;

    const kyc = await TeacherKyc.findById(id);
    if (!kyc) {
      return res.status(404).json({ success: false, message: 'KYC record not found' });
    }

    if (kyc.status === 'approved') {
      return res.status(400).json({ success: false, message: 'KYC is already approved' });
    }

    // Verify all required documents are present
    const uploadedTypes = kyc.documents.map(d => d.documentType);
    const missingDocs = REQUIRED_DOCUMENT_TYPES.filter(t => !uploadedTypes.includes(t));
    if (missingDocs.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot approve: mandatory documents missing',
        data: { missingDocuments: missingDocs },
      });
    }

    const oldStatus = kyc.status;
    kyc.status = 'approved';
    kyc.approvedAt = new Date();
    kyc.reviewedAt = new Date();
    kyc.reviewedBy = adminUserId;
    if (notes) kyc.verificationNotes = notes;

    // Mark all documents as verified
    kyc.documents.forEach(doc => {
      doc.verificationStatus = 'verified';
      doc.verifiedAt = new Date();
    });

    await kyc.save();

    // Update TeacherProfile verification status
    const profile = await TeacherProfile.findById(kyc.teacherId);
    if (profile) {
      profile.verificationStatus = 'verified';
      profile.isVerified = true;
      profile.verificationDate = new Date();
      if (notes) profile.verificationNotes = notes;
      await profile.save();

      // Notify teacher
      await sendNotification({
        userId: profile.userId,
        type: 'KYC_APPROVED' as any,
        category: 'system',
        title: 'KYC Approved!',
        body: 'Congratulations! Your KYC verification is complete. You are now a verified teacher on the platform.',
        data: { screen: 'TeacherKycStatus' },
        entityId: kyc._id,
        entityType: 'TeacherKyc',
      });
    }

    await writeAuditLog(adminUserId, 'KYC_APPROVED', 'TeacherKyc', kyc.kycId, { status: oldStatus }, { status: 'approved' });

    return res.status(200).json({
      success: true,
      message: 'KYC approved successfully',
      data: { kycId: kyc.kycId, status: kyc.status, approvedAt: kyc.approvedAt },
    });
  } catch (error: any) {
    console.error('Approve KYC error:', error);
    return res.status(500).json({ success: false, message: 'Failed to approve KYC', error: error.message });
  }
};

/**
 * POST /api/admin/kyc/:id/reject
 * Reject KYC
 */
export const rejectKyc = async (req: AuthRequest, res: Response) => {
  try {
    const adminUserId = req.user?._id;
    const { id } = req.params;
    const { reason, notes } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const kyc = await TeacherKyc.findById(id);
    if (!kyc) {
      return res.status(404).json({ success: false, message: 'KYC record not found' });
    }

    if (kyc.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Cannot reject an approved KYC' });
    }

    const oldStatus = kyc.status;
    kyc.status = 'rejected';
    kyc.rejectedAt = new Date();
    kyc.rejectionReason = reason;
    kyc.reviewedAt = new Date();
    kyc.reviewedBy = adminUserId;
    if (notes) kyc.verificationNotes = notes;

    await kyc.save();

    // Update TeacherProfile
    const profile = await TeacherProfile.findById(kyc.teacherId);
    if (profile) {
      profile.verificationStatus = 'rejected';
      profile.rejectionReason = reason;
      await profile.save();

      // Notify teacher
      await sendNotification({
        userId: profile.userId,
        type: 'KYC_REJECTED' as any,
        category: 'system',
        title: 'KYC Rejected',
        body: `Your KYC verification was not approved. Reason: ${reason}`,
        data: { screen: 'TeacherKycStatus' },
        entityId: kyc._id,
        entityType: 'TeacherKyc',
      });
    }

    await writeAuditLog(adminUserId, 'KYC_REJECTED', 'TeacherKyc', kyc.kycId, { status: oldStatus }, { status: 'rejected', reason });

    return res.status(200).json({
      success: true,
      message: 'KYC rejected',
      data: { kycId: kyc.kycId, status: kyc.status, rejectedAt: kyc.rejectedAt, rejectionReason: reason },
    });
  } catch (error: any) {
    console.error('Reject KYC error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reject KYC', error: error.message });
  }
};

/**
 * POST /api/admin/kyc/:id/request-reupload
 * Request re-upload of specific documents
 */
export const requestReupload = async (req: AuthRequest, res: Response) => {
  try {
    const adminUserId = req.user?._id;
    const { id } = req.params;
    const { documentIds, notes } = req.body;

    if (!notes) {
      return res.status(400).json({ success: false, message: 'Notes explaining what needs to be re-uploaded are required' });
    }

    const kyc = await TeacherKyc.findById(id);
    if (!kyc) {
      return res.status(404).json({ success: false, message: 'KYC record not found' });
    }

    if (kyc.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Cannot request reupload for approved KYC' });
    }

    const oldStatus = kyc.status;
    kyc.status = 'reupload_required';
    kyc.reviewedAt = new Date();
    kyc.reviewedBy = adminUserId;
    kyc.verificationNotes = notes;

    // Mark specific documents as reupload_required
    if (documentIds && Array.isArray(documentIds)) {
      documentIds.forEach((docId: string) => {
        const doc = kyc.documents.find(d => d._id.toString() === docId);
        if (doc) {
          doc.verificationStatus = 'reupload_required';
          doc.notes = notes;
        }
      });
    } else {
      // Mark all as reupload_required
      kyc.documents.forEach(doc => {
        doc.verificationStatus = 'reupload_required';
        doc.notes = notes;
      });
    }

    await kyc.save();

    // Notify teacher
    const profile = await TeacherProfile.findById(kyc.teacherId);
    if (profile) {
      await sendNotification({
        userId: profile.userId,
        type: 'KYC_REUPLOAD_REQUIRED' as any,
        category: 'system',
        title: 'KYC: Re-upload Required',
        body: `Some documents need to be re-uploaded. Notes: ${notes}`,
        data: { screen: 'TeacherKyc' },
        entityId: kyc._id,
        entityType: 'TeacherKyc',
      });
    }

    await writeAuditLog(adminUserId, 'KYC_REUPLOAD_REQUESTED', 'TeacherKyc', kyc.kycId, { status: oldStatus }, { status: 'reupload_required', notes });

    return res.status(200).json({
      success: true,
      message: 'Re-upload request sent',
      data: { kycId: kyc.kycId, status: kyc.status, notes },
    });
  } catch (error: any) {
    console.error('Request reupload error:', error);
    return res.status(500).json({ success: false, message: 'Failed to request reupload', error: error.message });
  }
};
