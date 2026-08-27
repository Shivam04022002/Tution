import express from 'express';
import {
  listPublishedCourses,
  getPublishedCourse,
  getLessonPlayback,
} from '../controllers/courseController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

// Course marketplace consumption is a parent-facing feature.
router.use(authenticate, authorize('parent'));

router.get('/', listPublishedCourses);
router.get('/:courseId', getPublishedCourse);
router.get('/:courseId/lessons/:lessonId/playback', getLessonPlayback);

export default router;
