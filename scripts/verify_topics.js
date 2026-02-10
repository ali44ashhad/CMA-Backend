import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Package from '../src/models/Package.js';
import Topic from '../src/models/Topic.js';
import Exam from '../src/models/Exam.js';
import User from '../src/models/User.js';
import Purchase from '../src/models/Purchase.js';

dotenv.config();

const verify = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        // Cleanup
        await Package.deleteMany({ name: 'Test Pkg' });
        await Topic.deleteMany({ name: 'Test Topic' });
        await Exam.deleteMany({ name: 'Test Exam' });
        console.log('Cleanup done');

        // 1. Create Package
        const pkg = await Package.create({
            name: 'Test Pkg',
            level: 'intermediate',
            group: 'group_a',
            year: 2025,
            price: 1000,
            status: 'active'
        });
        console.log('Package created:', pkg._id);

        // 2. Create Topic
        const topic = await Topic.create({
            name: 'Test Topic',
            level: 'intermediate',
            packageIds: [pkg._id],
            status: 'active'
        });
        console.log('Topic created:', topic._id);

        // 3. Create Exam
        const exam = await Exam.create({
            name: 'Test Exam',
            level: 'intermediate',
            year: 2025,
            topicId: topic._id,
            examType: 'mcq',
            duration: 60,
            maxMarks: 100,
            questions: [{
                questionText: 'Test Q?',
                options: ['A', 'B', 'C', 'D'],
                correctOption: 0,
                marks: 1
            }],
            status: 'active'
        });
        console.log('Exam created:', exam._id);

        // 4. Verify Access Query Logic (Simulate studentController.getExams)
        // Mock User Purchase

        // Scenario A: No purchase
        console.log('Testing access: No purchase...');
        const purchasedPackageIds = new Set();
        let hasAccess = false;
        if (topic.packageIds.some(pid => purchasedPackageIds.has(pid.toString()))) {
            hasAccess = true;
        }
        console.log('Access (Expect False):', hasAccess);

        // Scenario B: With Purchase
        console.log('Testing access: With purchase...');
        purchasedPackageIds.add(pkg._id.toString());
        if (topic.packageIds.some(pid => purchasedPackageIds.has(pid.toString()))) {
            hasAccess = true;
        }
        console.log('Access (Expect True):', hasAccess);

        // 5. Verify Populate
        const fetchedExam = await Exam.findById(exam._id).populate('topicId');
        console.log('Exam Topic populated:', fetchedExam.topicId.name);

        console.log('Verification Successful');
    } catch (e) {
        console.error('Verification Failed:', e);
    } finally {
        await mongoose.connection.close();
    }
};

verify();
