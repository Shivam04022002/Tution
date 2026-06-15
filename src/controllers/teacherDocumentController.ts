import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { TeacherProfile } from '../models/TeacherProfile';
import { AuthRequest } from '../middleware/auth';
import { v2 as cloudinary } from 'cloudinary';
// Audit logging helper (can be imported or defined inline)
const writeAuditLog = async (
  userId: mongoose.Types.ObjectId | any,
  action: string,
  entityType: string,
  entityId: string,
  oldValue: any,
  newValue: any,
  req: any
) => {
  try {
    // Simple console log for now - implement proper audit logging later
    console.log(`[AUDIT] ${action}: ${entityType} ${entityId} by ${userId}`);
  } catch (e) {
    // Silent fail for audit logging
  }
};

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Document type definitions
export type DocumentType =
  | 'profile_photo'
  | 'government_id'
  | 'aadhaar'
  | 'pan'
  | 'driving_license'
  | 'passport'
  | 'degree_certificate'
  | 'teaching_certificate'
  | 'experience_certificate';

export type DocumentStatus = 'draft' | 'pending' | 'verified' | 'rejected';
export type FileType = 'jpg' | 'png' | 'pdf';

// Document category weights for profile completion
const DOCUMENT_WEIGHTS: Record<DocumentType, number> = {
  profile_photo: 10,
  government_id: 10,
  aadhaar: 10,
  pan: 10,
  driving_license: 10,
  passport: 10,
  degree_certificate: 10,
  teaching_certificate: 10,
  experience_certificate: 5,
};

// Document type labels
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  profile_photo: 'Profile Photo',
  government_id: 'Government ID',
  aadhaar: 'Aadhaar Card',
  pan: 'PAN Card',
  driving_license: 'Driving License',
  passport: 'Passport',
  degree_certificate: 'Degree Certificate',
  teaching_certificate: 'Teaching Certificate',
  experience_certificate: 'Experience Certificate',
};

// Document category mapping
const GOVERNMENT_ID_TYPES: DocumentType[] = ['aadhaar', 'pan', 'driving_license', 'passport'];
const CERTIFICATE_TYPES: DocumentType[] = ['degree_certificate', 'teaching_certificate', 'experience_certificate'];

interface DocumentResponse {
  _id: string;
  type: DocumentType;
  name: string;
  url: string;
  status: DocumentStatus;
  uploadedAt: string;
  verifiedAt?: string;
  rejectionReason?: string;
  fileType: FileType;
  fileSize: number;
  category: 'identity' | 'qualification' | 'profile';
}

// Helper: Get document category
const getDocumentCategory = (type: DocumentType): 'identity' | 'qualification' | 'profile' => {
  if (type === 'profile_photo') return 'profile';
  if (GOVERNMENT_ID_TYPES.includes(type)) return 'identity';
  return 'qualification';
};

// Helper: Format document for response
const formatDocument = (doc: any): DocumentResponse => ({
  _id: doc._id.toString(),
  type: doc.type,
  name: doc.name,
  url: doc.url,
  status: doc.status,
  uploadedAt: doc.uploadedAt.toISOString(),
  verifiedAt: doc.verifiedAt?.toISOString(),
  rejectionReason: doc.rejectionReason,
  fileType: doc.fileType,
  fileSize: doc.fileSize,
  category: getDocumentCategory(doc.type),
});

// Helper: Calculate profile completion from documents
const calculateDocumentCompletion = (documents: any[]): number => {
  if (!documents || documents.length === 0) return 0;

  const hasIdentityDoc = documents.some(d =>
    GOVERNMENT_ID_TYPES.includes(d.type) && (d.status === 'verified' || d.status === 'pending')
  );

  const hasQualificationDoc = documents.some(d =>
    CERTIFICATE_TYPES.includes(d.type) && (d.status === 'verified' || d.status === 'pending')
  );

  const hasProfilePhoto = documents.some(d =>
    d.type === 'profile_photo' && (d.status === 'verified' || d.status === 'pending')
  );

  let percentage = 0;
  if (hasIdentityDoc) percentage += 10;
  if (hasQualificationDoc) percentage += 10;
  if (hasProfilePhoto) percentage += 10;

  return percentage;
};

// ==================== CONTROLLER FUNCTIONS ====================

/**
 * GET /api/teachers/documents
 * Get all documents for the authenticated teacher
 */
export const getDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const profile = await TeacherProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Teacher profile not found',
      });
    }

    const documents = (profile.documents || []).map(formatDocument);

    // Calculate completion percentage
    const completionPercentage = calculateDocumentCompletion(profile.documents || []);

    // Group documents by category
    const grouped = {
      identity: documents.filter(d => d.category === 'identity'),
      qualification: documents.filter(d => d.category === 'qualification'),
      profile: documents.filter(d => d.category === 'profile'),
    };

    // Summary
    const summary = {
      total: documents.length,
      verified: documents.filter(d => d.status === 'verified').length,
      pending: documents.filter(d => d.status === 'pending').length,
      rejected: documents.filter(d => d.status === 'rejected').length,
      draft: documents.filter(d => d.status === 'draft').length,
      completionPercentage,
    };

    return res.status(200).json({
      success: true,
      data: {
        documents,
        grouped,
        summary,
      },
    });
  } catch (error: any) {
    console.error('Get documents error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get documents',
      error: error.message,
    });
  }
};

/**
 * POST /api/teachers/documents
 * Upload a new document
 */
export const uploadDocument = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const firebaseUid = req.user?.firebaseUid;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { type, name } = req.body as { type: DocumentType; name: string };
    const file = (req.files as Express.Multer.File[])?.[0];

    if (!type || !name) {
      return res.status(400).json({
        success: false,
        message: 'Document type and name are required',
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Validate document type
    const validTypes = Object.keys(DOCUMENT_TYPE_LABELS);
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document type',
      });
    }

    const profile = await TeacherProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Teacher profile not found',
      });
    }

    // Determine file type
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const fileType: FileType = ext === 'pdf' ? 'pdf' : ext === 'png' ? 'png' : 'jpg';

    // Upload to Cloudinary
    const folder = `teachers/documents/${type}`;
    const publicId = `${type}_${firebaseUid}_${Date.now()}`;

    const result = await cloudinary.uploader.upload(file.path, {
      folder,
      public_id: publicId,
      resource_type: fileType === 'pdf' ? 'raw' : 'image',
    });

    // Create document entry
    const newDocument = {
      _id: new mongoose.Types.ObjectId(),
      type,
      name,
      url: result.secure_url,
      publicId: result.public_id,
      status: 'draft' as DocumentStatus,
      uploadedAt: new Date(),
      fileType,
      fileSize: file.size,
    };

    // Add to documents array
    if (!profile.documents) {
      profile.documents = [];
    }
    profile.documents.push(newDocument);

    // Update legacy verificationDocuments fields for backward compatibility
    if (type === 'aadhaar') {
      profile.verificationDocuments.aadhaarCard = result.secure_url;
    } else if (type === 'pan') {
      profile.verificationDocuments.panCard = result.secure_url;
    } else if (CERTIFICATE_TYPES.includes(type)) {
      profile.verificationDocuments.qualificationDocuments.push(result.secure_url);
    }

    await profile.save();

    // Audit log
    await writeAuditLog(
      userId,
      'DOCUMENT_UPLOADED',
      'TeacherProfile',
      profile._id.toString(),
      null,
      { documentType: type, documentName: name, documentId: newDocument._id },
      req
    );

    return res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        document: formatDocument(newDocument),
      },
    });
  } catch (error: any) {
    console.error('Upload document error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload document',
      error: error.message,
    });
  }
};

/**
 * DELETE /api/teachers/documents/:id
 * Delete a document
 */
export const deleteDocument = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID',
      });
    }

    const profile = await TeacherProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Teacher profile not found',
      });
    }

    // Find document
    const documentIndex = profile.documents?.findIndex(
      (d) => d._id.toString() === id
    );

    if (documentIndex === undefined || documentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }

    const document = profile.documents![documentIndex];

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(document.publicId, {
        resource_type: document.fileType === 'pdf' ? 'raw' : 'image',
      });
    } catch (cloudError) {
      console.warn('Failed to delete from Cloudinary:', cloudError);
      // Continue even if Cloudinary delete fails
    }

    // Remove from array
    profile.documents!.splice(documentIndex, 1);

    await profile.save();

    // Audit log
    await writeAuditLog(
      userId,
      'DOCUMENT_DELETED',
      'TeacherProfile',
      profile._id.toString(),
      { documentType: document.type, documentName: document.name },
      null,
      req
    );

    return res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete document error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete document',
      error: error.message,
    });
  }
};

/**
 * PUT /api/teachers/documents/:id
 * Replace/update a document
 */
export const updateDocument = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const firebaseUid = req.user?.firebaseUid;
    const { id } = req.params;
    const { name } = req.body;
    const file = (req.files as Express.Multer.File[])?.[0];

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID',
      });
    }

    const profile = await TeacherProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Teacher profile not found',
      });
    }

    // Find document
    const documentIndex = profile.documents?.findIndex(
      (d) => d._id.toString() === id
    );

    if (documentIndex === undefined || documentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }

    const oldDocument = profile.documents![documentIndex];
    const oldValue = { ...oldDocument };

    // Update name if provided
    if (name) {
      profile.documents![documentIndex].name = name;
    }

    // Update file if provided
    if (file) {
      // Delete old file from Cloudinary
      try {
        await cloudinary.uploader.destroy(oldDocument.publicId, {
          resource_type: oldDocument.fileType === 'pdf' ? 'raw' : 'image',
        });
      } catch (cloudError) {
        console.warn('Failed to delete old file from Cloudinary:', cloudError);
      }

      // Determine file type
      const ext = file.originalname.split('.').pop()?.toLowerCase();
      const fileType: FileType = ext === 'pdf' ? 'pdf' : ext === 'png' ? 'png' : 'jpg';

      // Upload new file
      const folder = `teachers/documents/${oldDocument.type}`;
      const publicId = `${oldDocument.type}_${firebaseUid}_${Date.now()}`;

      const result = await cloudinary.uploader.upload(file.path, {
        folder,
        public_id: publicId,
        resource_type: fileType === 'pdf' ? 'raw' : 'image',
      });

      // Update document fields
      profile.documents![documentIndex].url = result.secure_url;
      profile.documents![documentIndex].publicId = result.public_id;
      profile.documents![documentIndex].fileType = fileType;
      profile.documents![documentIndex].fileSize = file.size;
      profile.documents![documentIndex].status = 'draft'; // Reset to draft
      profile.documents![documentIndex].uploadedAt = new Date();
      profile.documents![documentIndex].verifiedAt = undefined;
      profile.documents![documentIndex].rejectionReason = undefined;

      // Update legacy fields
      if (oldDocument.type === 'aadhaar') {
        profile.verificationDocuments.aadhaarCard = result.secure_url;
      } else if (oldDocument.type === 'pan') {
        profile.verificationDocuments.panCard = result.secure_url;
      }
    }

    await profile.save();

    const updatedDocument = profile.documents![documentIndex];

    // Audit log
    await writeAuditLog(
      userId,
      'DOCUMENT_UPDATED',
      'TeacherProfile',
      profile._id.toString(),
      oldValue,
      { documentType: updatedDocument.type, documentName: updatedDocument.name },
      req
    );

    return res.status(200).json({
      success: true,
      message: 'Document updated successfully',
      data: {
        document: formatDocument(updatedDocument),
      },
    });
  } catch (error: any) {
    console.error('Update document error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update document',
      error: error.message,
    });
  }
};

/**
 * POST /api/teachers/verification/submit
 * Submit profile for verification
 */
export const submitForVerification = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const profile = await TeacherProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Teacher profile not found',
      });
    }

    // Check if already verified or pending
    if (profile.verificationStatus === 'verified') {
      return res.status(400).json({
        success: false,
        message: 'Profile is already verified',
      });
    }

    if (profile.verificationStatus === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Profile is already pending verification',
      });
    }

    // Validate required documents exist
    const hasIdentityDoc = profile.documents?.some(d =>
      GOVERNMENT_ID_TYPES.includes(d.type) && d.status !== 'rejected'
    );

    const hasQualificationDoc = profile.documents?.some(d =>
      CERTIFICATE_TYPES.includes(d.type) && d.status !== 'rejected'
    );

    if (!hasIdentityDoc) {
      return res.status(400).json({
        success: false,
        message: 'At least one identity document (Aadhaar, PAN, etc.) is required',
      });
    }

    if (!hasQualificationDoc) {
      return res.status(400).json({
        success: false,
        message: 'At least one qualification document is required',
      });
    }

    // Update all draft documents to pending
    if (profile.documents) {
      profile.documents.forEach(doc => {
        if (doc.status === 'draft') {
          doc.status = 'pending';
        }
      });
    }

    // Update profile verification status
    const oldStatus = profile.verificationStatus;
    profile.verificationStatus = 'pending';

    await profile.save();

    // Audit log
    await writeAuditLog(
      userId,
      'VERIFICATION_SUBMITTED',
      'TeacherProfile',
      profile._id.toString(),
      { verificationStatus: oldStatus },
      { verificationStatus: 'pending' },
      req
    );

    return res.status(200).json({
      success: true,
      message: 'Profile submitted for verification successfully',
      data: {
        verificationStatus: profile.verificationStatus,
        submittedAt: new Date().toISOString(),
        estimatedReviewTime: '24-48 hours',
      },
    });
  } catch (error: any) {
    console.error('Submit verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit for verification',
      error: error.message,
    });
  }
};

/**
 * GET /api/teachers/verification/status
 * Get detailed verification status
 */
export const getVerificationStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const profile = await TeacherProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Teacher profile not found',
      });
    }

    const documents = (profile.documents || []).map(formatDocument);

    // Calculate document statistics
    const identityDocs = documents.filter(d => d.category === 'identity');
    const qualificationDocs = documents.filter(d => d.category === 'qualification');
    const profileDocs = documents.filter(d => d.category === 'profile');

    // Check requirements
    const requirements = {
      identityDocument: {
        required: true,
        met: identityDocs.some(d => d.status === 'verified' || d.status === 'pending'),
        documents: identityDocs,
      },
      qualificationDocument: {
        required: true,
        met: qualificationDocs.some(d => d.status === 'verified' || d.status === 'pending'),
        documents: qualificationDocs,
      },
      profilePhoto: {
        required: true,
        met: profileDocs.some(d => d.status === 'verified' || d.status === 'pending'),
        documents: profileDocs,
      },
    };

    // Build timeline
    const timeline = [];

    // Add document uploads to timeline
    documents.forEach(doc => {
      timeline.push({
        date: doc.uploadedAt,
        event: 'DOCUMENT_UPLOADED',
        description: `${DOCUMENT_TYPE_LABELS[doc.type]} uploaded`,
        documentId: doc._id,
      });

      if (doc.status === 'verified' && doc.verifiedAt) {
        timeline.push({
          date: doc.verifiedAt,
          event: 'DOCUMENT_VERIFIED',
          description: `${DOCUMENT_TYPE_LABELS[doc.type]} verified`,
          documentId: doc._id,
        });
      }

      if (doc.status === 'rejected') {
        timeline.push({
          date: doc.uploadedAt, // Use upload date since we don't track rejection date separately
          event: 'DOCUMENT_REJECTED',
          description: `${DOCUMENT_TYPE_LABELS[doc.type]} rejected${doc.rejectionReason ? `: ${doc.rejectionReason}` : ''}`,
          documentId: doc._id,
          reason: doc.rejectionReason,
        });
      }
    });

    // Add verification status changes
    if (profile.verificationStatus === 'pending') {
      timeline.push({
        date: profile.updatedAt.toISOString(),
        event: 'VERIFICATION_SUBMITTED',
        description: 'Profile submitted for verification',
      });
    }

    if (profile.verificationStatus === 'verified' && profile.verificationDate) {
      timeline.push({
        date: profile.verificationDate.toISOString(),
        event: 'PROFILE_VERIFIED',
        description: 'Profile verified successfully',
      });
    }

    if (profile.verificationStatus === 'rejected') {
      timeline.push({
        date: profile.updatedAt.toISOString(),
        event: 'PROFILE_REJECTED',
        description: `Profile rejected${profile.rejectionReason ? `: ${profile.rejectionReason}` : ''}`,
        reason: profile.rejectionReason,
      });
    }

    // Sort timeline by date (newest first)
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return res.status(200).json({
      success: true,
      data: {
        status: profile.verificationStatus,
        isVerified: profile.isVerified,
        submittedAt: profile.verificationDate?.toISOString(),
        rejectionReason: profile.rejectionReason,
        verificationNotes: profile.verificationNotes,
        requirements,
        documents: {
          total: documents.length,
          verified: documents.filter(d => d.status === 'verified').length,
          pending: documents.filter(d => d.status === 'pending').length,
          rejected: documents.filter(d => d.status === 'rejected').length,
          draft: documents.filter(d => d.status === 'draft').length,
          byCategory: {
            identity: identityDocs,
            qualification: qualificationDocs,
            profile: profileDocs,
          },
        },
        timeline: timeline.slice(0, 20), // Limit to 20 most recent events
        canSubmit: profile.verificationStatus === 'draft' || profile.verificationStatus === 'rejected',
        requiredActions: (() => {
          const actions = [];
          if (!requirements.identityDocument.met) {
            actions.push('Upload an identity document (Aadhaar, PAN, etc.)');
          }
          if (!requirements.qualificationDocument.met) {
            actions.push('Upload a qualification document');
          }
          if (!requirements.profilePhoto.met) {
            actions.push('Upload a profile photo');
          }
          if (profile.verificationStatus === 'rejected') {
            actions.push('Address the rejection reason and re-upload documents if needed');
          }
          return actions;
        })(),
      },
    });
  } catch (error: any) {
    console.error('Get verification status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get verification status',
      error: error.message,
    });
  }
};
