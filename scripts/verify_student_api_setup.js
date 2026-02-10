import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.js';
import Package from '../src/models/Package.js';
import Exam from '../src/models/Exam.js';
import Purchase from '../src/models/Purchase.js';
import ExamAttempt from '../src/models/ExamAttempt.js';
import ActivityLog from '../src/models/ActivityLog.js';
import crypto from 'crypto';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cma_test_series';

const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB connected');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

const runVerification = async () => {
    await connectDB();

    try {
        console.log('\n--- Starting Verification ---\n');

        // 1. Cleanup previous test data
        const testEmail = 'teststudent@example.com';
        await User.deleteOne({ email: testEmail });
        // Clean up related data ideally, but for now just user to avoid collision

        // 2. Create Test Student
        console.log('1. Creating Test Student...');
        const user = await User.create({
            name: 'Test Student',
            email: testEmail,
            phone: '9988776655',
            password: 'password123',
            role: 'student'
        });
        console.log('   User created:', user._id);

        // 3. Create Test Package
        console.log('2. Creating Test Package...');
        const pkg = await Package.create({
            name: 'Test Package 2025',
            level: 'intermediate',
            group: 'group_a',
            year: 2025,
            price: 1000,
            description: 'Test Package',
            status: 'active'
        });
        console.log('   Package created:', pkg._id);

        // 4. Create Test Exam (MCQ)
        console.log('3. Creating Test Exam...');
        const exam = await Exam.create({
            name: 'Test MCQ Exam',
            packageIds: [pkg._id],
            level: 'intermediate',
            year: 2025,
            examType: 'mcq',
            duration: 60,
            maxMarks: 10,
            extensionsAllowed: 1,
            extensionInterval: 15,
            status: 'active',
            questions: [
                {
                    questionText: 'Q1?',
                    options: ['A', 'B', 'C', 'D'],
                    correctOption: 1,
                    marks: 5
                },
                {
                    questionText: 'Q2?',
                    options: ['A', 'B', 'C', 'D'],
                    correctOption: 2,
                    marks: 5
                }
            ]
        });
        console.log('   Exam created:', exam._id);

        // 5. Create Purchase (to allow access)
        console.log('4. Creating Purchase...');
        await Purchase.create({
            studentId: user._id,
            packageId: pkg._id,
            amount: 1000,
            razorpayOrderId: 'order_' + crypto.randomUUID(),
            paymentStatus: 'success',
            purchasedAt: new Date()
        });
        console.log('   Purchase created');

        // Note: We are testing Controller LOGIC here via direct calls if we imported controller, 
        // BUT better to test via API requests to verify Routes + Middleware + Controller.
        // However, making HTTP requests requires running server.
        // Since we are inside the codebase, we can simulate params and call controller? 
        // No, middleware (req.user) is needed.
        // Easiest is to use `supertest` with `app`. 
        // But let's stick to this script calling Mongoose to set up state, 
        // then maybe I can use `fetch` against running server or mock `req, res`.

        // Let's use `supertest` approach in this script! 
        // I need to import app.
    } catch (err) {
        console.error('Setup failed:', err);
    } finally {
        await mongoose.disconnect();
    }
};

// I will rewrite this file content to use supertest.
