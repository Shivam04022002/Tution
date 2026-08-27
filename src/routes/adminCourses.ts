import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  setCoursePublished,
  deleteCourse,
  createLesson,
  updateLesson,
  deleteLesson,
  uploadVideo,
  removeVideo,
  getVideoDetails,
  updateVideoMetadata,
} from '../controllers/adminCourseController';
import { authenticate, authorize } from '../middleware/auth';
import { getMaxCourseVideoBytes } from '../services/fileValidationService';

const router = express.Router();

const TEMP_UPLOAD_DIR = 'uploads/temp/';

// Multer's disk storage does not create the destination, so make sure it exists.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdir(TEMP_UPLOAD_DIR, { recursive: true }, (err) => cb(err, TEMP_UPLOAD_DIR));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'course-video-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// First line of defence only — the controller re-validates via fileValidationService.
const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-m4v'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only MP4, M4V and MOV videos are allowed.'));
  }
};

const uploadVideoFile = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: getMaxCourseVideoBytes(),
    files: 1,
  },
});

/** Turn multer rejections into the standard JSON error shape. */
const handleUploadErrors = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!err) {
    next();
    return;
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `Video is too large. Maximum size is ${Math.round(getMaxCourseVideoBytes() / (1024 * 1024))}MB.`
        : `Upload failed: ${err.message}`;
    res.status(400).json({ success: false, message });
    return;
  }

  res.status(400).json({ success: false, message: err.message || 'Upload failed' });
};

// Every route in this module is admin-only.
router.use(authenticate, authorize('admin'));

// ---- Courses ----
router.get('/', listCourses);
router.post('/', createCourse);
router.get('/:courseId', getCourse);
router.put('/:courseId', updateCourse);
router.patch('/:courseId/publish', setCoursePublished);
router.delete('/:courseId', deleteCourse);

// ---- Lessons ----
router.post('/:courseId/lessons', createLesson);
router.put('/:courseId/lessons/:lessonId', updateLesson);
router.delete('/:courseId/lessons/:lessonId', deleteLesson);

// ---- Lesson video ----
router.get('/:courseId/lessons/:lessonId/video', getVideoDetails);
router.post(
  '/:courseId/lessons/:lessonId/video',
  uploadVideoFile.single('video'),
  handleUploadErrors,
  uploadVideo
);
router.patch('/:courseId/lessons/:lessonId/video/metadata', updateVideoMetadata);
router.delete('/:courseId/lessons/:lessonId/video', removeVideo);

export default router;
