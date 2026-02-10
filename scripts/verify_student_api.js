import request from 'supertest';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Package from '../src/models/Package.js';
import Exam from '../src/models/Exam.js';
import Purchase from '../src/models/Purchase.js';
import ExamAttempt from '../src/models/ExamAttempt.js';
import ActivityLog from '../src/models/ActivityLog.js';
import RefreshToken from '../src/models/RefreshToken.js';
import crypto from 'crypto';

dotenv.config();

// Ensure unique test data
const TIMESTAMP = Date.now();
const STUDENT_EMAIL = `student_${TIMESTAMP}@test.com`;
const STUDENT_PHONE = `99${Math.floor(Math.random() * 100000000)}`;
const PASSWORD = 'password123';

let studentToken;
let studentId;
let packageId;
let examId;
let attemptId;

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

const setupData = async () => {
    console.log('\n--- Setting up Test Data ---');

    // 1. Create Student
    const student = await User.create({
        name: 'Test Student',
        email: STUDENT_EMAIL,
        phone: STUDENT_PHONE,
        password: PASSWORD, // Will be hashed
        role: 'student'
    });
    studentId = student._id;
    console.log(`Student created: ${student.email}`);

    // 2. Login to get token
    const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: STUDENT_EMAIL, password: PASSWORD });

    if (res.status !== 200) {
        throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
    }
    studentToken = res.body.data.accessToken;
    console.log('Login successful, token obtained');

    // 3. Create Package
    const pkg = await Package.create({
        name: `Test Package ${TIMESTAMP}`,
        level: 'intermediate',
        group: 'group_a',
        year: 2025,
        price: 1000,
        description: 'Test Package',
        status: 'active'
    });
    packageId = pkg._id;

    // 4. Create Exam
    const exam = await Exam.create({
        name: `Test MCQ Exam ${TIMESTAMP}`,
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
            { questionText: 'Q1?', options: ['A', 'B', 'C', 'D'], correctOption: 1, marks: 5, _id: new mongoose.Types.ObjectId() },
            { questionText: 'Q2?', options: ['A', 'B', 'C', 'D'], correctOption: 2, marks: 5, _id: new mongoose.Types.ObjectId() }
        ]
    });
    examId = exam._id;
    console.log('Package and Exam created');
};

const runTests = async () => {
    console.log('\n--- Running Tests ---\n');

    // Test 1: Get Profile
    console.log('1. GET /profile');
    let res = await request(app)
        .get('/api/v1/students/profile')
        .set('Authorization', `Bearer ${studentToken}`);
    if (res.status === 200 && res.body.data.email === STUDENT_EMAIL) {
        console.log('   ✅ PASS');
    } else {
        console.error('   ❌ FAIL', res.body);
    }

    // Test 2: Update Profile
    console.log('2. PUT /profile');
    res = await request(app)
        .put('/api/v1/students/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ name: 'Updated Student' });
    if (res.status === 200 && res.body.data.name === 'Updated Student') {
        console.log('   ✅ PASS');
    } else {
        console.error('   ❌ FAIL', res.body);
    }

    // Test 3: Get Exams (No Purchase) - Should show hasAccess=false
    console.log('3. GET /exams (No Access)');
    res = await request(app)
        .get('/api/v1/students/exams')
        .set('Authorization', `Bearer ${studentToken}`);
    const examData = res.body.data.exams.find(e => e._id === examId.toString());
    if (res.status === 200 && examData && examData.hasAccess === false) {
        console.log('   ✅ PASS');
    } else {
        console.error('   ❌ FAIL', res.body);
    }

    // Test 4: Buy Package
    console.log('4. Creating Purchase (Manual DB insert)');
    await Purchase.create({
        studentId: studentId,
        packageId: packageId,
        amount: 1000,
        razorpayOrderId: 'order_' + crypto.randomUUID(),
        paymentStatus: 'success',
        purchasedAt: new Date()
    });
    console.log('   ✅ PASS (Inserted)');

    // Test 5: Get Exams (With Purchase) - Should show hasAccess=true
    console.log('5. GET /exams (With Access)');
    res = await request(app)
        .get('/api/v1/students/exams')
        .set('Authorization', `Bearer ${studentToken}`);
    const examDataAccess = res.body.data.exams.find(e => e._id === examId.toString());
    if (res.status === 200 && examDataAccess && examDataAccess.hasAccess === true) {
        console.log('   ✅ PASS');
    } else {
        console.error('   ❌ FAIL', JSON.stringify(examDataAccess));
    }

    // Test 6: Start Exam
    console.log('6. POST /exams/:id/start');
    res = await request(app)
        .post(`/api/v1/students/exams/${examId}/start`)
        .set('Authorization', `Bearer ${studentToken}`);
    if (res.status === 200 && res.body.data.attemptId) {
        attemptId = res.body.data.attemptId;
        console.log('   ✅ PASS');
    } else {
        console.error('   ❌ FAIL', res.body);
    }

    // Test 7: Submit Answer (Correct)
    console.log('7. PUT /exams/attempts/:id/answer');
    const questions = res.body.data.questions;
    // Question 0: correct is index 1
    // Question 1: correct is index 2

    // Submit correct answer for Q1
    res = await request(app)
        .put(`/api/v1/students/exams/attempts/${attemptId}/answer`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ questionId: questions[0]._id, selectedOption: 1 });

    if (res.status === 200) {
        console.log('   ✅ PASS (Q1 Answered)');
    } else {
        console.error('   ❌ FAIL', res.body);
    }

    // Submit wrong answer for Q2 (e.g. index 0)
    await request(app)
        .put(`/api/v1/students/exams/attempts/${attemptId}/answer`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ questionId: questions[1]._id, selectedOption: 0 });

    // Test 8: Extend Time
    console.log('8. POST /exams/attempts/:id/extend');
    res = await request(app)
        .post(`/api/v1/students/exams/attempts/${attemptId}/extend`)
        .set('Authorization', `Bearer ${studentToken}`);

    if (res.status === 200 && res.body.data.extensionsUsed === 1) {
        console.log('   ✅ PASS');
    } else {
        console.error('   ❌ FAIL', res.body);
    }

    // Test 9: Submit Exam (MCQ)
    console.log('9. POST /exams/attempts/:id/submit-mcq');
    res = await request(app)
        .post(`/api/v1/students/exams/attempts/${attemptId}/submit-mcq`)
        .set('Authorization', `Bearer ${studentToken}`);

    // Total marks: Q1 correct (5), Q2 wrong (0) = 5
    if (res.status === 200 && res.body.data.status === 'evaluated' && res.body.data.marks === 5) {
        console.log('   ✅ PASS (Marks verified: 5/10)');
    } else {
        console.error('   ❌ FAIL', res.body);
    }

    // Test 10: Get Leaderboard
    console.log('10. GET /exams/:id/leaderboard');
    res = await request(app)
        .get(`/api/v1/students/exams/${examId}/leaderboard`)
        .set('Authorization', `Bearer ${studentToken}`);

    if (res.status === 200 && res.body.data.rankings.length > 0) {
        console.log('   ✅ PASS');
    } else {
        console.error('   ❌ FAIL', res.body);
    }

    // Cleanup
    console.log('\n--- Cleanup ---');
    await User.findByIdAndDelete(studentId);
    await Package.findByIdAndDelete(packageId);
    await Exam.findByIdAndDelete(examId);
    await ExamAttempt.findByIdAndDelete(attemptId);
    await Purchase.deleteOne({ studentId });
    await RefreshToken.deleteOne({ userId: studentId });
    await ActivityLog.deleteMany({ userId: studentId });
    console.log('Cleanup done');
};

const main = async () => {
    await connectDB();
    try {
        await setupData();
        await runTests();
    } catch (err) {
        console.error('Verification failed:', err);
    } finally {
        await mongoose.disconnect();
        // Force exit because Express server might keep event loop alive if attached
        process.exit(0);
    }
};

main();
