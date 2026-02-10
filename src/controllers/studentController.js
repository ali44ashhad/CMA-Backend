import mongoose from 'mongoose';
import User from '../models/User.js';
import Package from '../models/Package.js';
import Purchase from '../models/Purchase.js';
import Exam from '../models/Exam.js';
import ExamAttempt from '../models/ExamAttempt.js';
import Topic from '../models/Topic.js';
import ActivityLog from '../models/ActivityLog.js';
import asyncHandler from '../utils/asyncHandler.js';
import { successResponse } from '../utils/responseFormatter.js';
import { AppError, NotFoundError, ValidationError, UnauthorizedError } from '../utils/customErrors.js';
import validator from '../validators/studentValidator.js';

// 1. Get Student Profile
export const getProfile = asyncHandler(async (req, res) => {
    const student = await User.findById(req.user.id).select('-password');
    if (!student) throw new NotFoundError('Student');

    res.json(successResponse('Profile fetched successfully', student));
});

// 2. Update Student Profile
export const updateProfile = asyncHandler(async (req, res) => {
    const { error } = validator.updateProfile(req.body);
    if (error) throw new ValidationError(error.details.map(d => d.message).join(', '));

    const { name } = req.body;

    // Only allow updating name as per docs
    const student = await User.findByIdAndUpdate(
        req.user.id,
        { name },
        { new: true, runValidators: true }
    ).select('-password');

    // Log activity
    await ActivityLog.create({
        userId: req.user.id,
        action: 'profile_updated',
        details: { fields: ['name'] }
    });

    res.json(successResponse('Profile updated successfully', student));
});

// 3. Get Available Packages
export const getPackages = asyncHandler(async (req, res) => {
    const { level, year } = req.query;
    const query = { status: 'active', isDeleted: false };

    if (level) query.level = level;
    if (year) query.year = Number(year);

    const packages = await Package.find(query).lean();

    // Enrich with exam count (mock count for now as per schema or aggregation if needed)
    // Enrich with exam count
    // Logic: Package -> Topics -> Exams
    // We need to count exams for each package.
    // 1. Find all topics associated with these packages
    const packageIds = packages.map(p => p._id);
    const topics = await Topic.find({ packageIds: { $in: packageIds }, status: 'active', isDeleted: false }).select('_id packageIds');

    // 2. Count exams for each topic
    const topicIds = topics.map(t => t._id);
    const examCountsByTopic = await Exam.aggregate([
        { $match: { topicId: { $in: topicIds }, status: 'active', isDeleted: false } },
        { $group: { _id: '$topicId', count: { $sum: 1 } } }
    ]);

    // Map topicId -> count
    const topicExamCountMap = {};
    examCountsByTopic.forEach(e => {
        topicExamCountMap[e._id.toString()] = e.count;
    });

    const packagesWithCount = packages.map(pkg => {
        // Sum exams of all topics belonging to this package
        const pkgTopics = topics.filter(t => t.packageIds.some(pid => pid.toString() === pkg._id.toString()));
        const count = pkgTopics.reduce((sum, t) => sum + (topicExamCountMap[t._id.toString()] || 0), 0);

        return {
            ...pkg,
            examCount: count
        };
    });

    res.json(successResponse('Packages fetched successfully', { packages: packagesWithCount }));
});

// 4. Get My Purchases
export const getPurchases = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [purchases, total] = await Promise.all([
        Purchase.find({ studentId: req.user.id })
            .populate('packageId', 'name level')
            .sort({ purchasedAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Purchase.countDocuments({ studentId: req.user.id })
    ]);

    res.json(successResponse('Purchases fetched successfully', {
        purchases,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            itemsPerPage: limit
        }
    }));
});

// Helper: Check access to exam
const checkExamAccess = async (studentId, exam) => {
    // 1. If Foundation, free access
    if (exam.level === 'foundation') return true;

    // 2. Check purchases
    // Find active purchase for any package that includes this exam's topic
    // Exam -> Topic -> Package
    // We need to fetch the topic to get packageIds if not populated
    let topic = exam.topicId;

    // If topicId is just an ID (not populated), we need to fetch it
    if (!topic.packageIds) {
        topic = await Topic.findById(exam.topicId).select('packageIds');
    }

    if (!topic || !topic.packageIds) return false;

    const purchases = await Purchase.find({
        studentId: studentId,
        paymentStatus: 'success',
        packageId: { $in: topic.packageIds }
    }).lean();

    return purchases.length > 0;
};

// 5. Get Available Exams
export const getExams = asyncHandler(async (req, res) => {
    const { level, year } = req.query;
    const query = { status: 'active', isDeleted: false };

    if (level) query.level = level;
    if (year) query.year = Number(year);

    const exams = await Exam.find(query)
        .select('name level year examType duration maxMarks extensionsAllowed extensionInterval topicId status')
        .lean();

    // Check access and attempt status for each exam
    const examList = [];

    // Get all attempts by student
    const attempts = await ExamAttempt.find({ studentId: req.user.id }).lean();
    const attemptMap = new Map(attempts.map(a => [a.examId.toString(), a]));

    // Get all purchases for student
    const purchases = await Purchase.find({ studentId: req.user.id, paymentStatus: 'success' }).lean();
    const purchasedPackageIds = new Set(purchases.map(p => p.packageId.toString()));

    // Fetch topics to check access (Exam -> Topic -> Package)
    const topicIds = [...new Set(exams.map(e => e.topicId.toString()))];
    const topics = await Topic.find({ _id: { $in: topicIds } }).select('_id packageIds name');
    const topicMap = new Map(topics.map(t => [t._id.toString(), t]));

    for (const exam of exams) {
        let hasAccess = false;

        if (exam.level === 'foundation') {
            hasAccess = true;
        } else {
            const topic = topicMap.get(exam.topicId.toString());
            if (topic && topic.packageIds) {
                hasAccess = topic.packageIds.some(pid => purchasedPackageIds.has(pid.toString()));
            }
        }

        const attempt = attemptMap.get(exam._id.toString());
        const topic = topicMap.get(exam.topicId.toString());

        examList.push({
            _id: exam._id,
            name: exam.name,
            level: exam.level,
            year: exam.year,
            topicId: exam.topicId,
            topicName: topic ? topic.name : 'Unknown',
            examType: exam.examType,
            duration: exam.duration,
            maxMarks: exam.maxMarks,
            extensionsAllowed: exam.extensionsAllowed,
            extensionInterval: exam.extensionInterval,
            hasAccess,
            attemptStatus: attempt ? attempt.status : null
        });
    }

    res.json(successResponse('Exams fetched successfully', { exams: examList }));
});

// 6. Get Exam Details
export const getExamDetails = asyncHandler(async (req, res) => {
    const { examId } = req.params;

    const exam = await Exam.findOne({ _id: examId, status: 'active', isDeleted: false }).lean();
    if (!exam) throw new NotFoundError('Exam', 'EXAM001');

    const hasAccess = await checkExamAccess(req.user.id, exam);
    if (!hasAccess) throw new AppError('No access to exam', 403, 'EXAM004');

    const attempt = await ExamAttempt.findOne({ studentId: req.user.id, examId }).lean();

    // Build response based on exam type
    const responseData = {
        _id: exam._id,
        name: exam.name,
        level: exam.level,
        year: exam.year,
        examType: exam.examType,
        duration: exam.duration,
        maxMarks: exam.maxMarks,
        extensionsAllowed: exam.extensionsAllowed,
        extensionInterval: exam.extensionInterval,
        hasAccess: true,
        attemptStatus: attempt ? attempt.status : null
    };

    if (exam.examType === 'mcq') {
        responseData.totalQuestions = exam.questions.length;
    } else {
        responseData.questionPaperUrl = exam.questionPaperUrl;
    }

    res.json(successResponse('Exam details fetched successfully', responseData));
});

// 7. Start Exam
export const startExam = asyncHandler(async (req, res) => {
    const { examId } = req.params;

    const exam = await Exam.findOne({ _id: examId, status: 'active', isDeleted: false });
    if (!exam) throw new NotFoundError('Exam', 'EXAM001');

    const hasAccess = await checkExamAccess(req.user.id, exam);
    if (!hasAccess) throw new AppError('No access to exam', 403, 'EXAM004');

    // Check existing attempt
    const existingAttempt = await ExamAttempt.findOne({ studentId: req.user.id, examId });
    if (existingAttempt) {
        if (existingAttempt.status === 'in_progress') {
            throw new AppError('Exam already in progress', 409, 'EXAM005');
        } else if (existingAttempt.status === 'submitted' || existingAttempt.status === 'evaluated') {
            throw new AppError('Exam already submitted', 400, 'EXAM002');
        }
    }

    // Create new attempt
    const attempt = await ExamAttempt.create({
        studentId: req.user.id,
        examId,
        status: 'in_progress',
        startTime: new Date(),
        timerDuration: exam.duration,
        extensionsUsed: 0
    });

    // Log activity
    await ActivityLog.create({
        userId: req.user.id,
        action: 'exam_started',
        details: { examId, attemptId: attempt._id }
    });

    // Prepare response data
    const responseData = {
        attemptId: attempt._id,
        examId: exam._id,
        startTime: attempt.startTime,
        duration: exam.duration,
        extensionsAllowed: exam.extensionsAllowed,
        extensionInterval: exam.extensionInterval,
        questions: []
    };

    if (exam.examType === 'mcq') {
        responseData.questions = exam.questions.map(q => ({
            _id: q._id,
            questionText: q.questionText,
            options: q.options,
            marks: q.marks
        }));
    } else {
        responseData.questionPaperUrl = exam.questionPaperUrl;
    }

    res.json(successResponse('Exam started successfully', responseData));
});

// 8. Submit MCQ Answer
export const submitAnswer = asyncHandler(async (req, res) => {
    const { attemptId } = req.params;
    const { error } = validator.submitAnswer(req.body);
    if (error) throw new ValidationError(error.details.map(d => d.message).join(', '));

    const { questionId, selectedOption } = req.body;

    const attempt = await ExamAttempt.findOne({ _id: attemptId, studentId: req.user.id });
    if (!attempt) throw new NotFoundError('Attempt');

    if (attempt.status !== 'in_progress') {
        throw new AppError('Exam is not in progress', 400, 'EXAM007');
    }

    // Update or push answer
    const existingAnswerIndex = attempt.answers.findIndex(a => a.questionId.toString() === questionId);
    if (existingAnswerIndex > -1) {
        attempt.answers[existingAnswerIndex].selectedOption = selectedOption;
    } else {
        attempt.answers.push({ questionId, selectedOption });
    }

    await attempt.save();
    res.json(successResponse('Answer saved successfully'));
});

// 9. Submit MCQ Exam
export const submitMcqExam = asyncHandler(async (req, res) => {
    const { attemptId } = req.params;

    const attempt = await ExamAttempt.findOne({ _id: attemptId, studentId: req.user.id })
        .populate('examId');
    if (!attempt) throw new NotFoundError('Attempt');

    if (attempt.status !== 'in_progress') {
        throw new AppError('Exam already submitted or not in progress', 400, 'EXAM002');
    }

    const exam = attempt.examId;
    if (exam.examType !== 'mcq') {
        throw new AppError('Not an MCQ exam', 400, 'EXAM008');
    }

    // Auto-grade
    let totalMarks = 0;
    const answersMap = new Map(attempt.answers.map(a => [a.questionId.toString(), a.selectedOption]));

    for (const question of exam.questions) {
        const studentOption = answersMap.get(question._id.toString());
        if (studentOption !== undefined && studentOption === question.correctOption) {
            totalMarks += question.marks;
        }
    }

    // Update attempt
    attempt.status = 'evaluated';
    attempt.endTime = new Date();
    attempt.autoGradedMarks = totalMarks;
    // For MCQ, autoGradedMarks IS the final marks technically, but let's see schema
    // If evaluatorMarks is null, specific logic might use autoGradedMarks
    // But for MCQ pure, we can treat it as final.
    // Spec says response should have 'marks'.

    await attempt.save();

    // Log activity
    await ActivityLog.create({
        userId: req.user.id,
        action: 'exam_submitted',
        details: { attemptId, marks: totalMarks }
    });

    // Get rank (simple count of people with more marks in this exam)
    // To be accurate, we need to aggregate
    const rank = await ExamAttempt.countDocuments({
        examId: exam._id,
        status: 'evaluated',
        autoGradedMarks: { $gt: totalMarks }
    }) + 1;

    const totalParticipants = await ExamAttempt.countDocuments({
        examId: exam._id,
        status: { $in: ['submitted', 'evaluated'] }
    });

    res.json(successResponse('Exam submitted and graded successfully', {
        attemptId: attempt._id,
        marks: totalMarks,
        maxMarks: exam.maxMarks,
        status: 'evaluated',
        rank,
        totalParticipants
    }));
});

// 10. Upload PDF Answer Sheet
export const uploadPdfAnswer = asyncHandler(async (req, res) => {
    const { attemptId } = req.params;

    if (!req.file) {
        throw new AppError('No file uploaded', 400, 'FILE001');
    }

    const attempt = await ExamAttempt.findOne({ _id: attemptId, studentId: req.user.id });
    if (!attempt) throw new NotFoundError('Attempt');

    if (attempt.status !== 'in_progress') {
        throw new AppError('Exam is not in progress', 409, 'EXAM002');
    }

    // Check grace period (10 mins) logic if needed, comparing startTime + duration + extensions + 10m vs Now
    // Assuming middleware or basic check here
    // Timer check logic:
    const allowedTime = attempt.timerDuration + (attempt.extensionsUsed * 15); // minutes
    const elapsedMinutes = (Date.now() - attempt.startTime) / 1000 / 60;
    const gracePeriod = 10;

    if (elapsedMinutes > allowedTime + gracePeriod) {
        throw new AppError('Grace period expired', 408, 'EXAM003');
    }
    // For now assuming valid submission window

    attempt.status = 'submitted';
    attempt.endTime = new Date();
    attempt.submittedPdfUrl = req.file.path; // Cloudinary path from middleware

    await attempt.save();

    // Log
    await ActivityLog.create({
        userId: req.user.id,
        action: 'exam_submitted',
        details: { attemptId, file: req.file.filename }
    });

    res.json(successResponse('Answer sheet uploaded successfully', {
        attemptId: attempt._id,
        submittedPdfUrl: attempt.submittedPdfUrl,
        status: 'submitted',
        submittedAt: attempt.endTime
    }));
});

// 11. Extend Exam Time
export const extendExamTime = asyncHandler(async (req, res) => {
    const { attemptId } = req.params;

    const attempt = await ExamAttempt.findOne({ _id: attemptId, studentId: req.user.id }).populate('examId');
    if (!attempt) throw new NotFoundError('Attempt');

    if (attempt.status !== 'in_progress') throw new AppError('Exam not in progress', 400);

    const exam = attempt.examId;
    if (attempt.extensionsUsed >= exam.extensionsAllowed) {
        throw new AppError('No extensions available', 400, 'EXAM006');
    }

    attempt.extensionsUsed += 1;
    await attempt.save();

    // Calculate new end time estimate (start + original duration + used extensions * interval)
    // But API says return 'newEndTime'. Since we track 'startTime' and 'duration', 
    // the 'endTime' is dynamic limit.
    // Client asks for absolute time.
    const totalMinutes = exam.duration + (attempt.extensionsUsed * exam.extensionInterval);
    const newEndTime = new Date(attempt.startTime.getTime() + totalMinutes * 60000);

    res.json(successResponse('Time extended successfully', {
        attemptId: attempt._id,
        extensionsUsed: attempt.extensionsUsed,
        extensionsRemaining: exam.extensionsAllowed - attempt.extensionsUsed,
        newEndTime
    }));
});

// 12. Forfeit Exam
export const forfeitExam = asyncHandler(async (req, res) => {
    const { attemptId } = req.params;

    const attempt = await ExamAttempt.findOne({ _id: attemptId, studentId: req.user.id });
    if (!attempt) throw new NotFoundError('Attempt');

    if (attempt.status !== 'in_progress') {
        throw new AppError('Can only forfeit in-progress exams', 400, 'EXAM009');
    }

    await ExamAttempt.findByIdAndDelete(attemptId); // Hard delete as per spec

    // Log
    await ActivityLog.create({
        userId: req.user.id,
        action: 'exam_forfeited',
        details: { attemptId }
    });

    res.json(successResponse('Exam forfeited successfully. You can reattempt.'));
});

// 13. Get Exam Attempt
export const getExamAttempt = asyncHandler(async (req, res) => {
    const { attemptId } = req.params;

    const attempt = await ExamAttempt.findOne({ _id: attemptId, studentId: req.user.id })
        .populate('examId', 'name examType maxMarks');

    if (!attempt) throw new NotFoundError('Attempt');

    // Filter sensitive fields if needed, but for student own attempt, mostly fine
    res.json(successResponse('Attempt details fetched successfully', attempt));
});

// 14. Get Exam Leaderboard
export const getLeaderboard = asyncHandler(async (req, res) => {
    const { examId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const exam = await Exam.findById(examId);
    if (!exam) throw new NotFoundError('Exam');

    // Get my rank
    const myAttempt = await ExamAttempt.findOne({
        examId,
        studentId: req.user.id,
        status: 'evaluated'
    });

    let myRank = null;
    let myMarks = null;

    if (myAttempt) {
        myMarks = myAttempt.autoGradedMarks || myAttempt.evaluatorMarks || 0;
        myRank = await ExamAttempt.countDocuments({
            examId,
            status: 'evaluated',
            $or: [
                { autoGradedMarks: { $gt: myMarks } },
                { evaluatorMarks: { $gt: myMarks } }
            ]
        }) + 1;
    }

    // Get leaders
    // We need to sort by marks. For MCQ it's autoGraded, for PDF it's evaluatorMarks.
    // We can use $max or assume field usage based on exam type.
    const sortField = exam.examType === 'mcq' ? 'autoGradedMarks' : 'evaluatorMarks';

    const [attempts, total] = await Promise.all([
        ExamAttempt.find({ examId, status: 'evaluated' })
            .sort({ [sortField]: -1 })
            .skip(skip)
            .limit(limit)
            .populate('studentId', 'name')
            .lean(),
        ExamAttempt.countDocuments({ examId, status: 'evaluated' })
    ]);

    const rankings = attempts.map((a, index) => ({
        rank: skip + index + 1, // Simple rank for pagination
        studentId: a.studentId._id,
        studentName: a.studentId.name,
        marks: a[sortField]
    }));

    res.json(successResponse('Leaderboard fetched successfully', {
        examId: exam._id,
        examName: exam.name,
        year: exam.year,
        rankings,
        myRank,
        myMarks,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            itemsPerPage: limit
        }
    }));
});
