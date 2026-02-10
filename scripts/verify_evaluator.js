import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.js';
import Exam from '../src/models/Exam.js';
import ExamAttempt from '../src/models/ExamAttempt.js';
import EvaluatorAssignment from '../src/models/EvaluatorAssignment.js';
import { getAssignments, acceptAssignment, rejectAssignment, submitEvaluation } from '../src/services/evaluatorService.js';
import connectDB from '../src/config/database.js';

dotenv.config();

const runVerification = async () => {
    try {
        await connectDB();
        console.log('Connected to DB');

        // Cleanup
        await User.deleteMany({ email: { $in: ['testevaluator@example.com', 'teststudent_eval@example.com'] } });
        await User.deleteMany({ phone: { $in: ['1234567890', '9876543210'] } });
        await ExamAttempt.deleteMany({ submittedPdfUrl: 'test_pdf_url' });
        await Exam.deleteMany({ name: 'Test PDF Exam' });

        // 1. Setup Data
        console.log('1. Setting up Test Data...');
        const student = await User.create({
            name: 'Test Student',
            email: 'teststudent_eval@example.com',
            password: 'password123',
            role: 'student',
            phone: '1234567890'
        });

        const evaluator = await User.create({
            name: 'Test Evaluator',
            email: 'testevaluator@example.com',
            password: 'password123',
            role: 'evaluator',
            phone: '9876543210'
        });

        const exam = await Exam.create({
            name: 'Test PDF Exam',
            level: 'foundation',
            year: 2025,
            examType: 'pdf',
            duration: 60,
            maxMarks: 100,
            status: 'active',
            questionPaperUrl: 'http://example.com/qp.pdf'
        });

        const attempt = await ExamAttempt.create({
            studentId: student._id,
            examId: exam._id,
            status: 'submitted',
            startTime: new Date(),
            timerDuration: 60,
            submittedPdfUrl: 'test_pdf_url'
        });

        const adminId = student._id; // Just using an ID for assignedBy

        const assignment = await EvaluatorAssignment.create({
            examAttemptId: attempt._id,
            evaluatorId: evaluator._id,
            assignedBy: adminId,
            status: 'pending'
        });

        console.log('   Data setup complete.');

        // 2. Test Get Assignments
        console.log('2. Testing Get Assignments...');
        const assignmentsData = await getAssignments(evaluator._id, {});
        if (assignmentsData.assignments.length !== 1) throw new Error('Failed to fetch assignments');
        if (assignmentsData.assignments[0]._id.toString() !== assignment._id.toString()) throw new Error('Assignment ID mismatch');
        console.log('   Get Assignments Passed.');

        // 3. Test Accept Assignment
        console.log('3. Testing Accept Assignment...');
        await acceptAssignment(assignment._id, evaluator._id);
        const acceptedAssignment = await EvaluatorAssignment.findById(assignment._id);
        if (acceptedAssignment.status !== 'accepted') throw new Error('Failed to accept assignment');
        console.log('   Accept Assignment Passed.');

        // Reset for Reject Test (status needs to be pending)
        acceptedAssignment.status = 'pending';
        await acceptedAssignment.save();

        // 4. Test Reject Assignment
        console.log('4. Testing Reject Assignment...');
        await rejectAssignment(assignment._id, evaluator._id);
        const rejectedAssignment = await EvaluatorAssignment.findById(assignment._id);
        if (rejectedAssignment.status !== 'rejected') throw new Error('Failed to reject assignment');
        console.log('   Reject Assignment Passed.');

        // Reset for Submit Test (needs to be accepted)
        rejectedAssignment.status = 'accepted';
        await rejectedAssignment.save();

        // 5. Test Submit Evaluation
        console.log('5. Testing Submit Evaluation...');
        const result = await submitEvaluation(
            assignment._id,
            evaluator._id,
            { marks: 85, remarks: 'Good job' },
            { path: 'http://cloudinary.com/checked.pdf' } // Mock file object
        );

        if (result.status !== 'evaluated') throw new Error('Attempt status not updated');
        if (result.marks !== 85) throw new Error('Marks not updated');

        const completedAssignment = await EvaluatorAssignment.findById(assignment._id);
        if (completedAssignment.status !== 'completed') throw new Error('Assignment status not completed');
        console.log('   Submit Evaluation Passed.');

        console.log('Verification Successful!');

        // Cleanup
        await User.deleteMany({ email: 'testevaluator@example.com' });
        await User.deleteMany({ email: 'teststudent_eval@example.com' });
        await ExamAttempt.deleteMany({ _id: attempt._id });
        await Exam.deleteMany({ _id: exam._id });
        await EvaluatorAssignment.deleteMany({ _id: assignment._id });

        process.exit(0);

    } catch (error) {
        console.error('Verification Failed:', error);
        process.exit(1);
    }
};

runVerification();
