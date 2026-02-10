import * as evaluatorService from '../services/evaluatorService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { successResponse } from '../utils/responseFormatter.js';
import evaluatorValidator from '../validators/evaluatorValidator.js';
import { ValidationError } from '../utils/customErrors.js';

// 1. Get Assigned Exams
export const getAssignments = asyncHandler(async (req, res) => {
    const { error } = evaluatorValidator.assignmentsQuery(req.query);
    if (error) throw new ValidationError(error.details.map(d => d.message).join(', '));

    const result = await evaluatorService.getAssignments(req.user.id, req.query);
    res.json(successResponse('Assignments fetched successfully', result));
});

// 2. Accept Assignment
export const acceptAssignment = asyncHandler(async (req, res) => {
    const { assignmentId } = req.params;
    const result = await evaluatorService.acceptAssignment(assignmentId, req.user.id);
    res.json(successResponse('Assignment accepted successfully', result));
});

// 3. Reject Assignment
export const rejectAssignment = asyncHandler(async (req, res) => {
    const { assignmentId } = req.params;
    await evaluatorService.rejectAssignment(assignmentId, req.user.id);
    res.json(successResponse('Assignment rejected successfully'));
});

// 4. Submit Evaluation
export const submitEvaluation = asyncHandler(async (req, res) => {
    const { assignmentId } = req.params;

    const { error } = evaluatorValidator.submitEvaluation(req.body);
    if (error) throw new ValidationError(error.details.map(d => d.message).join(', '));

    const result = await evaluatorService.submitEvaluation(
        assignmentId,
        req.user.id,
        req.body,
        req.file
    );

    res.json(successResponse('Evaluation submitted successfully', result));
});
