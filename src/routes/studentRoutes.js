import express from 'express';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';
import {
    getProfile,
    updateProfile,
    getPackages,
    getPurchases,
    getExams,
    getExamDetails,
    startExam,
    submitAnswer,
    submitMcqExam,
    uploadPdfAnswer,
    extendExamTime,
    forfeitExam,
    getExamAttempt,
    getLeaderboard
} from '../controllers/studentController.js';

const router = express.Router();

// Public routes (or arguably public, but doc says 'Public/Student' for packages. 
// If public allowed, we might need optional auth or separate route. 
// Doc says 'Access: Public (can view before registration) / Protected (Student)'
// For now, let's allow public access to packages if no token, but controller doesn't use user ID for packages listing logic 
// except maybe for `hasBought` check? 
// Controller: `getPackages` uses `Package.find`. Does not use `req.user`. So safe for public.
// But `getExams` definitely uses `req.user`.
// Let's keep `getPackages` public.

router.get('/packages', getPackages);

// Protected routes
router.use(protect);
router.use(authorize('student'));

router.get('/profile', getProfile);
router.put('/profile', updateProfile);

router.get('/purchases', getPurchases);

router.get('/exams', getExams);
router.get('/exams/:examId', getExamDetails);
router.get('/exams/:examId/leaderboard', getLeaderboard);

router.post('/exams/:examId/start', startExam);

router.get('/exams/attempts/:attemptId', getExamAttempt);
router.put('/exams/attempts/:attemptId/answer', submitAnswer);
router.post('/exams/attempts/:attemptId/submit-mcq', submitMcqExam);
router.post('/exams/attempts/:attemptId/upload-pdf', upload.single('answerSheet'), uploadPdfAnswer);
router.post('/exams/attempts/:attemptId/extend', extendExamTime);
router.delete('/exams/attempts/:attemptId/forfeit', forfeitExam);

export default router;
