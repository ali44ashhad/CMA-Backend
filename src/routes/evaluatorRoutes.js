import express from 'express';
import * as evaluatorController from '../controllers/evaluatorController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';

const router = express.Router();

// Apply authentication and role authorization to all routes
router.use(protect);
router.use(authorize('evaluator'));

// Routes
router.get('/assignments', evaluatorController.getAssignments);

router.put('/assignments/:assignmentId/accept', evaluatorController.acceptAssignment);

router.put('/assignments/:assignmentId/reject', evaluatorController.rejectAssignment);

router.post(
    '/assignments/:assignmentId/submit',
    upload.single('checkedPdf'),
    evaluatorController.submitEvaluation
);

export default router;
