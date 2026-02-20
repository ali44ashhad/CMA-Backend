import User from '../models/User.js';
import Package from '../models/Package.js';
import Exam from '../models/Exam.js';
import ExamAttempt from '../models/ExamAttempt.js';
import Topic from '../models/Topic.js';
import EvaluatorAssignment from '../models/EvaluatorAssignment.js';
import Purchase from '../models/Purchase.js';
import { AppError, ValidationError, NotFoundError } from '../utils/customErrors.js';
import { hashPassword } from '../utils/bcrypt.js';

// User Management
export const getAllUsers = async (query) => {
    const { role, isDeleted, search, page = 1, limit = 20 } = query;
    const filter = {};

    if (role) filter.role = role;
    if (isDeleted) filter.isDeleted = isDeleted === 'true';
    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
    }

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
        User.find(filter).skip(skip).limit(Number(limit)).lean(),
        User.countDocuments(filter)
    ]);

    return {
        users,
        pagination: {
            currentPage: Number(page),
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            itemsPerPage: Number(limit)
        }
    };
};

export const createEvaluator = async (data) => {
    const { email } = data;
    const existing = await User.findOne({ email });
    if (existing) throw new ValidationError('User with this email already exists');

    // Hash is handled by User model pre-save hook, but if createEvaluator passes raw password, 
    // we should ensure it matches User model expectation.
    // User model: pre-save hashes 'password' field.
    // data should contain 'password'.

    // However, if we want to be explicit or if we used different flow. 
    // The User model pre-save hook handles hashing if 'password' is modified.
    // So we just create user.

    const evaluator = await User.create({
        ...data,
        role: 'evaluator'
    });

    return evaluator;
};

// List all successful purchases (for admin: see which user bought which package)
export const getAllPurchases = async (query) => {
    const { studentId, limit = 500 } = query;
    const filter = { paymentStatus: 'success' };
    if (studentId) filter.studentId = studentId;

    const purchases = await Purchase.find(filter)
        .populate('studentId', 'name email')
        .populate('packageId', 'name level')
        .sort({ purchasedAt: -1 })
        .limit(Number(limit))
        .lean();

    return { purchases };
};

export const softDeleteUser = async (userId) => {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('User');
    await user.softDelete();

    // If evaluator, handle assignments? 
    // Schema says: "Evaluators: Ongoing assignments returned to pool"
    if (user.role === 'evaluator') {
        await EvaluatorAssignment.updateMany(
            { evaluatorId: userId, status: { $in: ['pending', 'accepted'] } },
            { status: 'rejected', respondedAt: new Date() } // Or some other logic to return to pool?
            // "returned to pool" usually means deleting assignment so it appears in pending?
            // Or marking rejected so admin sees it?
            // "If evaluator soft-deleted: All pending and accepted assignments -> rejected, sent back to admin"
        );
    }

    return;
};

// Package Management
export const getPackages = async (query) => {
    const { level, year, status } = query;
    const filter = { isDeleted: false };
    if (level) filter.level = level;
    if (year) filter.year = Number(year);
    if (status) filter.status = status;

    const packages = await Package.find(filter).lean();

    // Enrich with exam count: Package -> Topics -> Exams
    const packageIds = packages.map(p => p._id);
    const topics = await Topic.find({ packageIds: { $in: packageIds }, isDeleted: false }).select('_id packageIds');
    const topicIds = topics.map(t => t._id);
    const examCountsByTopic = await Exam.aggregate([
        { $match: { topicId: { $in: topicIds }, isDeleted: false } },
        { $group: { _id: '$topicId', count: { $sum: 1 } } }
    ]);
    const topicExamCountMap = {};
    examCountsByTopic.forEach(e => { topicExamCountMap[e._id.toString()] = e.count; });

    return packages.map(pkg => {
        const pkgTopics = topics.filter(t => t.packageIds.some(pid => pid.toString() === pkg._id.toString()));
        const examCount = pkgTopics.reduce((sum, t) => sum + (topicExamCountMap[t._id.toString()] || 0), 0);
        return { ...pkg, examCount };
    });
};

export const createPackage = async (data) => {
    // Validate business logic: Only ONE set of packages per level can be active at a time per year? 
    // Schema logic: "Only ONE set of packages per level can be active at a time per year"
    // "When new year packages are activated, previous year's packages become archived"

    // Just create for now, enforcement can be strict or loose.
    return await Package.create(data);
};

export const updatePackage = async (packageId, data) => {
    const pkg = await Package.findByIdAndUpdate(packageId, data, { new: true, runValidators: true });
    if (!pkg) throw new NotFoundError('Package');
    return pkg;
};

export const archivePackage = async (packageId) => {
    const pkg = await Package.findByIdAndUpdate(packageId, { status: 'archived' }, { new: true, runValidators: true });
    if (!pkg) throw new NotFoundError('Package');
    return pkg;
};

// Topic Management
export const createTopic = async (data) => {
    const { packageIds, level } = data;

    // Verify packages exist and match level
    if (packageIds && packageIds.length > 0) {
        const packages = await Package.find({ _id: { $in: packageIds } });
        if (packages.length !== packageIds.length) throw new NotFoundError('One or more packages not found');

        const invalidPackages = packages.filter(p => p.level !== level);
        if (invalidPackages.length > 0) {
            throw new ValidationError('All assigned packages must match the topic level');
        }
    }

    return await Topic.create(data);
};

export const updateTopic = async (topicId, data) => {
    // If updating packageIds, verify level consistency
    if (data.packageIds || data.level) {
        const topic = await Topic.findById(topicId);
        if (!topic) throw new NotFoundError('Topic');

        const newLevel = data.level || topic.level;
        const newPackageIds = data.packageIds || topic.packageIds;

        if (newPackageIds && newPackageIds.length > 0) {
            const packages = await Package.find({ _id: { $in: newPackageIds } });
            const invalidPackages = packages.filter(p => p.level !== newLevel);
            if (invalidPackages.length > 0) {
                throw new ValidationError('All assigned packages must match the topic level');
            }
        }
    }

    const updatedTopic = await Topic.findByIdAndUpdate(topicId, data, { new: true, runValidators: true });
    if (!updatedTopic) throw new NotFoundError('Topic');
    return updatedTopic;
};

export const getTopics = async (query) => {
    const { packageId, level, status } = query;
    const filter = {};
    if (packageId) filter.packageIds = packageId;
    if (level) filter.level = level;
    if (status) filter.status = status;

    return await Topic.find(filter).populate('packageIds', 'name level');
};

// Exam Management
export const getExams = async (query) => {
    const { level, year, examType, status } = query;
    const filter = { isDeleted: false };
    if (level) filter.level = level;
    if (year) filter.year = Number(year);
    if (examType) filter.examType = examType;
    if (status) filter.status = status;

    const exams = await Exam.find(filter)
        .populate('topicId', 'name')
        .sort({ level: 1, year: -1, createdAt: -1 })
        .lean();

    return exams.map(e => ({
        ...e,
        topicName: e.topicId?.name || '—'
    }));
};

export const createMCQExam = async (data) => {
    const { topicId } = data;
    const topic = await Topic.findById(topicId);
    if (!topic) throw new NotFoundError('Topic');

    // remove packageIds from data if present from old frontend
    const { packageIds, ...examData } = data;

    return await Exam.create({ ...examData, examType: 'mcq', status: 'active' });
};

export const createPDFExam = async (data) => {
    const { topicId } = data;
    const topic = await Topic.findById(topicId);
    if (!topic) throw new NotFoundError('Topic');

    const { packageIds, ...examData } = data;

    return await Exam.create({ ...examData, examType: 'pdf', status: 'active' });
};

export const updateExam = async (examId, data) => {
    const exam = await Exam.findById(examId);
    if (!exam) throw new NotFoundError('Exam');

    Object.assign(exam, data);
    await exam.save();
    return exam;
};

export const softDeleteExam = async (examId) => {
    const exam = await Exam.findById(examId);
    if (!exam) throw new NotFoundError('Exam');
    await exam.softDelete();
    return;
};

// Assignment Management
export const getPendingAssignments = async (query) => {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    // Find attempts that are submitted (for PDF) and NOT assigned yet?
    // Or attempts that are submitted (pdf)
    // "Pending assignments" usually means submitted PDF exams that need evaluation.
    // Also we need to check if they are already assigned.

    // Using aggregation or separate queries.
    // Logic: Find ExamAttempts where status='submitted' AND (evaluatorId is null OR not in assignments with status pending/accepted?)
    // Simpler: ExamAttempt status 'submitted' (implies waiting for evaluation).
    // If it's assigned, it might be 'submitted' but have an entry in EvaluatorAssignments?
    // Schema: EvaluatorAssignment links to ExamAttempt. 
    // ExamAttempt has evaluatorId field too.

    // We can just query ExamAttempt where status is 'submitted' and evaluatorId is null?
    // Or strictly rely on EvaluatorAssignment collection.

    // Let's assume ExamAttempt.status matches flow:
    // 'submitted' -> student submitted, waiting for eval.
    // When assigned, does status change? No, status remains 'submitted' until 'evaluated'.
    // So we need attempts that are 'submitted' and NOT assigned.

    // Using aggregation to look up assignments is cleaner, but for V1 let's stick to simpler logic if possible.
    // Use ExamAttempt.find({ status: 'submitted', evaluatorId: null }).

    const filter = { status: 'submitted', evaluatorId: null };

    const [attempts, total] = await Promise.all([
        ExamAttempt.find(filter)
            .populate('studentId', 'name')
            .populate('examId', 'name')
            .skip(skip)
            .limit(Number(limit))
            .lean(),
        ExamAttempt.countDocuments(filter)
    ]);

    // Map to response format
    const pendingExams = attempts.map(attempt => ({
        _id: attempt._id,
        studentName: attempt.studentId?.name || 'Unknown',
        examName: attempt.examId?.name || 'Unknown',
        submittedAt: attempt.endTime, // or updatedAt if specific field missing, schema has evaluationSubmittedAt but not submittedAt explicitly?
        // Schema: endTime is set when student submits.
        submittedPdfUrl: attempt.submittedPdfUrl
    }));

    return {
        pendingExams,
        pagination: {
            currentPage: Number(page),
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            itemsPerPage: Number(limit)
        }
    };
};

export const assignEvaluator = async (data) => {
    const { examAttemptId, evaluatorId, adminId } = data;

    const attempt = await ExamAttempt.findById(examAttemptId);
    if (!attempt) throw new NotFoundError('Exam Attempt');

    const evaluator = await User.findById(evaluatorId);
    if (!evaluator || evaluator.role !== 'evaluator') throw new ValidationError('Invalid evaluator');

    const existingAssignment = await EvaluatorAssignment.findOne({ examAttemptId });
    if (existingAssignment) throw new ValidationError('Exam is already assigned');

    const assignment = await EvaluatorAssignment.create({
        examAttemptId,
        evaluatorId,
        assignedBy: adminId,
        status: 'pending'
    });

    // Also update exam attempt with evaluatorId? 
    // Schema says "One exam attempt can only be assigned to ONE evaluator at a time"
    // And ExamAttempt has evaluatorId.
    // It's good practice to sync them if that's the design.
    attempt.evaluatorId = evaluatorId;
    await attempt.save();

    return assignment;
};

export const reassignEvaluator = async (assignmentId, newEvaluatorId) => {
    const assignment = await EvaluatorAssignment.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment');

    const evaluator = await User.findById(newEvaluatorId);
    if (!evaluator || evaluator.role !== 'evaluator') throw new ValidationError('Invalid new evaluator');

    assignment.evaluatorId = newEvaluatorId;
    assignment.status = 'pending';
    assignment.respondedAt = null;
    await assignment.save();

    // Update attempt as well
    await ExamAttempt.findByIdAndUpdate(assignment.examAttemptId, { evaluatorId: newEvaluatorId }, { runValidators: true });

    return assignment;
};

// Analytics
export const getDashboardAnalytics = async () => {
    const [
        totalStudents,
        totalEvaluators,
        totalRevenueResult,
        pendingEvaluations,
        completedEvaluations,
        activePackages,
        activeExams
    ] = await Promise.all([
        User.countDocuments({ role: 'student', isDeleted: false }),
        User.countDocuments({ role: 'evaluator', isDeleted: false }),
        Purchase.aggregate([
            { $match: { paymentStatus: 'success' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        ExamAttempt.countDocuments({ status: 'submitted' }),
        ExamAttempt.countDocuments({ status: 'evaluated' }),
        Package.countDocuments({ status: 'active', isDeleted: false }),
        Exam.countDocuments({ status: 'active', isDeleted: false })
    ]);

    const totalRevenue = totalRevenueResult.length > 0 ? totalRevenueResult[0].total : 0;

    return {
        totalStudents,
        totalEvaluators,
        totalRevenue,
        pendingEvaluations,
        completedEvaluations,
        activePackages,
        activeExams
    };
};
