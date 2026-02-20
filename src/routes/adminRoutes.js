import express from 'express';
import * as adminController from '../controllers/adminController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';

const router = express.Router();

// Apply auth and role check to all routes
router.use(protect);
router.use(authorize('admin'));

// User Management
router.route('/users')
    .get(adminController.getAllUsers);

router.route('/users/:userId')
    .delete(adminController.softDeleteUser);

router.route('/evaluators')
    .post(adminController.createEvaluator);

router.get('/purchases', adminController.getAllPurchases);

// Package Management
router.route('/packages')
    .get(adminController.getPackages)
    .post(adminController.createPackage);

router.route('/packages/:packageId')
    .put(adminController.updatePackage);

router.route('/packages/:packageId/archive')
    .put(adminController.archivePackage);

// Topic Management
router.route('/topics')
    .post(adminController.createTopic)
    .get(adminController.getTopics);

router.route('/topics/:topicId')
    .put(adminController.updateTopic);

// Exam Management
router.route('/exams')
    .get(adminController.getExams);

router.route('/exams/mcq')
    .post(adminController.createMCQExam);

router.route('/exams/pdf')
    .post(upload.single('questionPaper'), adminController.createPDFExam);

router.route('/exams/:examId')
    .put(adminController.updateExam)
    .delete(adminController.softDeleteExam);

// Assignment Management
router.route('/assignments/pending')
    .get(adminController.getPendingAssignments);

router.route('/assignments')
    .post(adminController.assignEvaluator);

router.route('/assignments/:assignmentId/reassign')
    .put(adminController.reassignEvaluator);

// Analytics
router.route('/analytics/dashboard')
    .get(adminController.getDashboardAnalytics);

export default router;
