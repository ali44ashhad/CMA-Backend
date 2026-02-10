import * as adminService from '../services/adminService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { successResponse } from '../utils/responseFormatter.js';

// User Management
export const getAllUsers = asyncHandler(async (req, res) => {
    const result = await adminService.getAllUsers(req.query);
    res.status(200).json(successResponse('Users fetched successfully', result));
});

export const createEvaluator = asyncHandler(async (req, res) => {
    const result = await adminService.createEvaluator(req.body);
    res.status(201).json(successResponse('Evaluator created successfully', result));
});

export const softDeleteUser = asyncHandler(async (req, res) => {
    await adminService.softDeleteUser(req.params.userId);
    res.status(200).json(successResponse('User deleted successfully'));
});

// Package Management
export const createPackage = asyncHandler(async (req, res) => {
    const result = await adminService.createPackage(req.body);
    res.status(201).json(successResponse('Package created successfully', result));
});

export const updatePackage = asyncHandler(async (req, res) => {
    const result = await adminService.updatePackage(req.params.packageId, req.body);
    res.status(200).json(successResponse('Package updated successfully', result));
});

export const archivePackage = asyncHandler(async (req, res) => {
    await adminService.archivePackage(req.params.packageId);
    res.status(200).json(successResponse('Package archived successfully'));
});

// Topic Management
export const createTopic = asyncHandler(async (req, res) => {
    const result = await adminService.createTopic(req.body);
    res.status(201).json(successResponse('Topic created successfully', result));
});

export const updateTopic = asyncHandler(async (req, res) => {
    const result = await adminService.updateTopic(req.params.topicId, req.body);
    res.status(200).json(successResponse('Topic updated successfully', result));
});

export const getTopics = asyncHandler(async (req, res) => {
    const result = await adminService.getTopics(req.query);
    res.status(200).json(successResponse('Topics fetched successfully', result));
});

// Exam Management
export const createMCQExam = asyncHandler(async (req, res) => {
    const result = await adminService.createMCQExam(req.body);
    res.status(201).json(successResponse('MCQ exam created successfully', result));
});

export const createPDFExam = asyncHandler(async (req, res) => {
    const examData = { ...req.body };
    if (req.file) {
        examData.questionPaperUrl = req.file.path; // Example
    }



    const result = await adminService.createPDFExam(examData);
    res.status(201).json(successResponse('PDF exam created successfully', result));
});

export const updateExam = asyncHandler(async (req, res) => {
    const result = await adminService.updateExam(req.params.examId, req.body);
    res.status(200).json(successResponse('Exam updated successfully', result));
});

export const softDeleteExam = asyncHandler(async (req, res) => {
    await adminService.softDeleteExam(req.params.examId);
    res.status(200).json(successResponse('Exam deleted successfully'));
});

// Assignment Management
export const getPendingAssignments = asyncHandler(async (req, res) => {
    const result = await adminService.getPendingAssignments(req.query);
    res.status(200).json(successResponse('Pending assignments fetched successfully', result));
});

export const assignEvaluator = asyncHandler(async (req, res) => {
    const result = await adminService.assignEvaluator({
        ...req.body,
        adminId: req.user.id // Provided by auth middleware
    });
    res.status(201).json(successResponse('Assignment created successfully. Evaluator notified.', result));
});

export const reassignEvaluator = asyncHandler(async (req, res) => {
    const result = await adminService.reassignEvaluator(req.params.assignmentId, req.body.newEvaluatorId);
    res.status(200).json(successResponse('Assignment reassigned successfully', result));
});

// Analytics
export const getDashboardAnalytics = asyncHandler(async (req, res) => {
    const result = await adminService.getDashboardAnalytics();
    res.status(200).json(successResponse('Dashboard analytics fetched successfully', result));
});
