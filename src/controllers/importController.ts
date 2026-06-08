import { Response } from 'express';
import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { TeacherProfile } from '../models/TeacherProfile';
import { ImportHistory, IImportError } from '../models/ImportHistory';
import { AuditLog } from '../models/AuditLog';
import { AuthRequest } from '../middleware/auth';
import { notifyAdminImportCompleted } from '../services/notificationService';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function normalize(v: any): string {
  return String(v ?? '').trim();
}

function toPhone(v: any): string {
  return normalize(v).replace(/\D/g, '');
}

function getIP(req: AuthRequest): string {
  return (
    req.headers['x-forwarded-for']?.toString() ||
    req.socket?.remoteAddress ||
    ''
  );
}

/** Parse an uploaded XLSX/XLS file buffer into an array of row objects */
function parseSheet(buffer: Buffer): Record<string, any>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('No sheets found in workbook');
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    defval: '',
    raw: false,
  });
}

// ─────────────────────────────────────────────
// POST /api/admin/import/parents
// ─────────────────────────────────────────────
export const importParentsExcel = async (req: AuthRequest, res: Response) => {
  const adminId = req.user?._id;

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const fileName = req.file.originalname;

  // Create pending ImportHistory record
  const history = await ImportHistory.create({
    uploadedBy: adminId,
    fileName,
    importType: 'parents',
    totalRows: 0,
    successfulRows: 0,
    failedRows: 0,
    duplicates: 0,
    status: 'processing',
    rowErrors: [],
  });

  try {
    const rows = parseSheet(req.file.buffer);
    const totalRows = rows.length;
    const rowErrors: IImportError[] = [];
    const toInsert: any[] = [];
    let duplicates = 0;

    // Collect all emails + mobiles for bulk duplicate check
    const candidateEmails = rows
      .map(r => normalize(r['Email'] || r['email'])).filter(Boolean);
    const candidateMobiles = rows
      .map(r => toPhone(r['Mobile'] || r['mobile'])).filter(Boolean);

    const [existingEmails, existingMobiles] = await Promise.all([
      User.find({ email: { $in: candidateEmails } }).select('email').lean(),
      User.find({ phoneNumber: { $in: candidateMobiles } }).select('phoneNumber').lean(),
    ]);

    const emailSet = new Set(existingEmails.map((u: any) => u.email.toLowerCase()));
    const mobileSet = new Set(existingMobiles.map((u: any) => u.phoneNumber));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2: header is row 1

      const name = normalize(row['Name'] || row['name']);
      const email = normalize(row['Email'] || row['email']).toLowerCase();
      const mobile = toPhone(row['Mobile'] || row['mobile']);
      const city = normalize(row['City'] || row['city']);
      const address = normalize(row['Address'] || row['address']);
      const pincode = normalize(row['Pincode'] || row['pincode']);

      // Validate required fields
      if (!name) { rowErrors.push({ rowNumber, rowData: row, errorMessage: 'Name is required' }); continue; }
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) { rowErrors.push({ rowNumber, rowData: row, errorMessage: 'Invalid or missing email' }); continue; }
      if (!mobile || mobile.length < 10) { rowErrors.push({ rowNumber, rowData: row, errorMessage: 'Invalid or missing mobile number' }); continue; }

      // Duplicate check
      if (emailSet.has(email) || mobileSet.has(mobile)) {
        duplicates++;
        continue;
      }

      // Mark as seen to catch intra-file duplicates
      emailSet.add(email);
      mobileSet.add(mobile);

      const nameParts = name.split(' ');
      const firstName = nameParts[0] ?? name;
      const lastName = nameParts.slice(1).join(' ') || '-';

      const tempPassword = await bcrypt.hash(mobile.slice(-6), 10);

      toInsert.push({
        email,
        phoneNumber: mobile,
        password: tempPassword,
        role: 'parent',
        profile: {
          firstName,
          lastName,
          ...(city && { city }),
        },
        isActive: true,
        isVerified: false,
        profileCompleted: false,
        onboardingCompleted: false,
        preferences: {
          notifications: true,
          emailNotifications: true,
          smsNotifications: true,
          language: 'en',
        },
      });
    }

    let successfulRows = 0;
    if (toInsert.length > 0) {
      const result = await User.insertMany(toInsert, {
        ordered: false,
        // @ts-ignore — mongoose insertMany options
        rawResult: true,
      });
      successfulRows = Array.isArray(result) ? result.length : (result as any).insertedCount ?? toInsert.length;
    }

    const failedRows = rowErrors.length;
    const status =
      successfulRows === totalRows - duplicates
        ? 'completed'
        : successfulRows === 0
        ? 'failed'
        : 'partial';

    await ImportHistory.findByIdAndUpdate(history._id, {
      totalRows,
      successfulRows,
      failedRows,
      duplicates,
      status,
      rowErrors,
    });

    // Audit log
    try {
      await AuditLog.create({
        adminId,
        action: 'IMPORT_PARENTS',
        entityType: 'User',
        entityId: history._id,
        newValue: { fileName, rowsImported: successfulRows, duplicates, failedRows },
        ipAddress: getIP(req),
        userAgent: req.headers['user-agent'] || '',
      });
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: 'Import completed',
      data: {
        importId: history._id,
        fileName,
        totalRows,
        successfulRows,
        failedRows,
        duplicates,
        status,
        errors: rowErrors.slice(0, 50), // cap response size
      },
    });
  } catch (error) {
    await ImportHistory.findByIdAndUpdate(history._id, { status: 'failed' });
    console.error('importParentsExcel error:', error);
    return res.status(500).json({
      success: false,
      message: 'Import failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// POST /api/admin/import/teachers
// ─────────────────────────────────────────────
export const importTeachersExcel = async (req: AuthRequest, res: Response) => {
  const adminId = req.user?._id;

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const fileName = req.file.originalname;

  const history = await ImportHistory.create({
    uploadedBy: adminId,
    fileName,
    importType: 'teachers',
    totalRows: 0,
    successfulRows: 0,
    failedRows: 0,
    duplicates: 0,
    status: 'processing',
    rowErrors: [],
  });

  try {
    const rows = parseSheet(req.file.buffer);
    const totalRows = rows.length;
    const rowErrors: IImportError[] = [];
    const toInsertUsers: any[] = [];
    const toInsertProfiles: any[] = [];
    let duplicates = 0;

    const candidateEmails = rows
      .map(r => normalize(r['Email'] || r['email'])).filter(Boolean);
    const candidateMobiles = rows
      .map(r => toPhone(r['Mobile'] || r['mobile'])).filter(Boolean);

    const [existingEmails, existingMobiles] = await Promise.all([
      User.find({ email: { $in: candidateEmails } }).select('email').lean(),
      User.find({ phoneNumber: { $in: candidateMobiles } }).select('phoneNumber').lean(),
    ]);

    const emailSet = new Set(existingEmails.map((u: any) => u.email.toLowerCase()));
    const mobileSet = new Set(existingMobiles.map((u: any) => u.phoneNumber));

    // Pre-assign ObjectIds so User → TeacherProfile can be linked
    const mongoose = (await import('mongoose')).default;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      const name = normalize(row['Name'] || row['name']);
      const email = normalize(row['Email'] || row['email']).toLowerCase();
      const mobile = toPhone(row['Mobile'] || row['mobile']);
      const city = normalize(row['City'] || row['city']);
      const address = normalize(row['Address'] || row['address']);
      const pincode = normalize(row['Pincode'] || row['pincode']);
      const qualification = normalize(row['Qualification'] || row['qualification']);
      const experience = parseInt(normalize(row['Experience'] || row['experience'])) || 0;
      const subjectsRaw = normalize(row['Subjects'] || row['subjects']);
      const classesRaw = normalize(row['Classes'] || row['classes']);
      const pricing = parseInt(normalize(row['Pricing'] || row['pricing'])) || 0;

      if (!name) { rowErrors.push({ rowNumber, rowData: row, errorMessage: 'Name is required' }); continue; }
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) { rowErrors.push({ rowNumber, rowData: row, errorMessage: 'Invalid or missing email' }); continue; }
      if (!mobile || mobile.length < 10) { rowErrors.push({ rowNumber, rowData: row, errorMessage: 'Invalid or missing mobile number' }); continue; }

      if (emailSet.has(email) || mobileSet.has(mobile)) {
        duplicates++;
        continue;
      }

      emailSet.add(email);
      mobileSet.add(mobile);

      const nameParts = name.split(' ');
      const firstName = nameParts[0] ?? name;
      const lastName = nameParts.slice(1).join(' ') || '-';

      const tempPassword = await bcrypt.hash(mobile.slice(-6), 10);
      const userId = new mongoose.Types.ObjectId();

      toInsertUsers.push({
        _id: userId,
        email,
        phoneNumber: mobile,
        password: tempPassword,
        role: 'teacher',
        profile: { firstName, lastName },
        isActive: true,
        isVerified: false,
        profileCompleted: false,
        onboardingCompleted: false,
        preferences: {
          notifications: true,
          emailNotifications: true,
          smsNotifications: true,
          language: 'en',
        },
      });

      const subjects = subjectsRaw
        ? subjectsRaw.split(/[,;]/).map(s => s.trim()).filter(Boolean)
        : [];
      const classes = classesRaw
        ? classesRaw.split(/[,;]/).map(s => s.trim()).filter(Boolean)
        : [];

      toInsertProfiles.push({
        userId,
        basicDetails: {
          fullName: name,
          email,
          mobileNumber: mobile,
          gender: 'male',
          languages: ['English'],
          profilePhoto: '',
        },
        education: {
          highestQualification: qualification || 'Graduate',
          degree: qualification || '',
          university: '',
          yearOfCompletion: new Date().getFullYear(),
          status: 'completed',
        },
        teachingDetails: {
          subjects,
          classes,
          boards: [],
          specialization: '',
          teachingModes: ['home'],
          teachingExperience: experience,
          groupTuitionOption: false,
          groupSize: 0,
          groupRate: 0,
        },
        locationAvailability: {
          address,
          city,
          pincode,
          coordinates: { latitude: 0, longitude: 0 },
          preferredAreas: [],
          teachingRadius: 5,
          availableDays: [],
          availableTimeSlots: [],
          vacationMode: false,
        },
        pricingRevenue: {
          hourlyRate: pricing,
          monthlyRate: pricing * 20,
          currentRevenue: '0',
        },
        verificationStatus: 'pending',
        isActive: true,
        isVerified: false,
        isBlocked: false,
        stats: {
          totalStudents: 0,
          activeStudents: 0,
          totalEarnings: 0,
          averageRating: 0,
          totalReviews: 0,
          completionRate: 0,
          responseRate: 0,
        },
      });
    }

    let successfulRows = 0;

    if (toInsertUsers.length > 0) {
      await User.insertMany(toInsertUsers, { ordered: false });
      await TeacherProfile.insertMany(toInsertProfiles, { ordered: false });
      successfulRows = toInsertUsers.length;
    }

    const failedRows = rowErrors.length;
    const status =
      successfulRows === totalRows - duplicates
        ? 'completed'
        : successfulRows === 0
        ? 'failed'
        : 'partial';

    await ImportHistory.findByIdAndUpdate(history._id, {
      totalRows,
      successfulRows,
      failedRows,
      duplicates,
      status,
      rowErrors,
    });

    try {
      await AuditLog.create({
        adminId,
        action: 'IMPORT_TEACHERS',
        entityType: 'TeacherProfile',
        entityId: history._id,
        newValue: { fileName, rowsImported: successfulRows, duplicates, failedRows },
        ipAddress: getIP(req),
        userAgent: req.headers['user-agent'] || '',
      });
    } catch (_) {}

    // Notify all admins
    try {
      const admins = await User.find({ role: 'admin' }).select('_id').lean();
      const adminIds = admins.map((a) => a._id);
      await notifyAdminImportCompleted(adminIds, 'Teachers', successfulRows, history._id);
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: 'Import completed',
      data: {
        importId: history._id,
        fileName,
        totalRows,
        successfulRows,
        failedRows,
        duplicates,
        status,
        errors: rowErrors.slice(0, 50),
      },
    });
  } catch (error) {
    await ImportHistory.findByIdAndUpdate(history._id, { status: 'failed' });
    console.error('importTeachersExcel error:', error);
    return res.status(500).json({
      success: false,
      message: 'Import failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/admin/import/history
// Query: importType, status, page, limit
// ─────────────────────────────────────────────
export const getImportHistory = async (req: AuthRequest, res: Response) => {
  try {
    const {
      importType,
      status,
      page = '1',
      limit = '20',
    } = req.query;

    const filter: Record<string, any> = {};
    if (importType) filter.importType = importType;
    if (status) filter.status = status;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [records, total] = await Promise.all([
      ImportHistory.find(filter)
        .select('-rowErrors')
        .populate('uploadedBy', 'profile.firstName profile.lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ImportHistory.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: records,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('getImportHistory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch import history',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
