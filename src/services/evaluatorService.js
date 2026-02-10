import ExamAttempt from '../models/ExamAttempt.js';
import EvaluatorAssignment from '../models/EvaluatorAssignment.js';
import { NotFoundError, ValidationError, AppError } from '../utils/customErrors.js';

// 1. Get Assignments
export const getAssignments = async (evaluatorId, query) => {
    const { status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const filter = { evaluatorId };
    if (status) filter.status = status;

    const [assignments, total] = await Promise.all([
        EvaluatorAssignment.find(filter)
            .populate({
                path: 'examAttemptId',
                select: 'studentId examId submittedPdfUrl', // Select needed fields
                populate: [
                    { path: 'studentId', select: 'name' }, // Get student name
                    { path: 'examId', select: 'name maxMarks' } // Get exam details
                ]
            })
            .sort({ assignedAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean(),
        EvaluatorAssignment.countDocuments(filter)
    ]);

    // Format response explicitly to match docs
    const formattedAssignments = assignments.map(assignment => {
        // Handle cases where populated fields might be null (though schema enforces refs)
        const attempt = assignment.examAttemptId || {};
        const student = attempt.studentId || {};
        const exam = attempt.examId || {};

        return {
            _id: assignment._id, // Assignment ID
            examAttemptId: attempt._id,
            studentName: student.name || 'Unknown',
            examName: exam.name || 'Unknown',
            submittedPdfUrl: attempt.submittedPdfUrl, // From attempt
            maxMarks: exam.maxMarks,
            status: assignment.status,
            assignedAt: assignment.assignedAt
        };
    });

    return {
        assignments: formattedAssignments,
        pagination: {
            currentPage: Number(page),
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            itemsPerPage: Number(limit)
        }
    };
};

// 2. Accept Assignment
export const acceptAssignment = async (assignmentId, evaluatorId) => {
    const assignment = await EvaluatorAssignment.findOne({ _id: assignmentId, evaluatorId });

    if (!assignment) throw new NotFoundError('Assignment');

    if (assignment.status !== 'pending') {
        throw new AppError('Only pending assignments can be accepted', 400, 'EVAL001');
    }

    assignment.status = 'accepted';
    assignment.respondedAt = new Date();
    await assignment.save();

    return assignment;
};

// 3. Reject Assignment
export const rejectAssignment = async (assignmentId, evaluatorId) => {
    const assignment = await EvaluatorAssignment.findOne({ _id: assignmentId, evaluatorId });

    if (!assignment) throw new NotFoundError('Assignment');

    if (assignment.status !== 'pending') {
        throw new AppError('Only pending assignments can be rejected', 400, 'EVAL002');
    }

    // According to docs/spec: "Assignment is deleted and returns to admin pool for reassignment" or marked rejected
    // Implementation Plan said "Reject Assignment -> status rejected".
    // Admin service logic suggests we might want to just set it to rejected so admin sees it.
    // Let's set to rejected. Admin can then reassign (which creates new assignment or updates this one).

    assignment.status = 'rejected';
    assignment.respondedAt = new Date();
    await assignment.save();

    // Note: We don't delete the assignment document usually if we want to track history, 
    // but the API docs said "returns to admin pool".
    // If we just mark 'rejected', admin needs a way to see these.
    // For now, status updated is safest.

    return;
};

// 4. Submit Evaluation
export const submitEvaluation = async (assignmentId, evaluatorId, data, file) => {
    const { marks, remarks } = data;

    // Start session for atomic update? For now simple await sequence.
    const assignment = await EvaluatorAssignment.findOne({ _id: assignmentId, evaluatorId });
    if (!assignment) throw new NotFoundError('Assignment');

    if (assignment.status !== 'accepted') {
        throw new AppError('You must accept assignment before submitting', 400, 'EVAL003');
    }

    const attempt = await ExamAttempt.findById(assignment.examAttemptId).populate('examId');
    if (!attempt) throw new NotFoundError('Exam Attempt');

    // Validation
    const maxMarks = attempt.examId.maxMarks;
    if (marks > maxMarks) {
        throw new ValidationError(`Marks cannot exceed max marks of ${maxMarks}`);
    }

    if (!file) throw new ValidationError('Checked PDF is required');

    // Update Attempt
    attempt.evaluatorMarks = marks;
    // For PDF exams, total marks is evaluator marks.
    // We can also set autoGradedMarks to null or same if needed, but evaluatorMarks is the source of truth for PDF.
    attempt.evaluatorRemarks = remarks;
    attempt.checkedPdfUrl = file.path; // Cloudinary path
    attempt.status = 'evaluated';
    attempt.evaluationSubmittedAt = new Date();
    attempt.evaluatorId = evaluatorId; // Ensure this is set

    await attempt.save();

    // Update Assignment
    assignment.status = 'completed';
    assignment.completedAt = new Date();
    await assignment.save();

    // Trigger Side Effects (Leaderboard update is automatic via queries, Email is separate service call if needed)
    // Docs say "Sends email to student". We can add that here if EmailService exists, 
    // but currently we focus on core logic. 
    // TODO: Add EmailService notification here.

    return {
        attemptId: attempt._id,
        marks: attempt.evaluatorMarks,
        checkedPdfUrl: attempt.checkedPdfUrl,
        status: attempt.status,
        completedAt: assignment.completedAt
    };
};
