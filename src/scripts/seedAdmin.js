import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import connectDB from '../config/database.js';

const seedAdmin = async () => {
    try {
        await connectDB();

        const adminEmail = process.env.ADMIN_EMAIL || 'admin@cma.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'password';
        const adminName = 'Admin User';
        const adminPhone = '1234567890'; // Default phone for seed

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: adminEmail });

        if (existingAdmin) {
            console.log('Admin user already exists');
            process.exit();
        }

        const admin = await User.create({
            name: adminName,
            email: adminEmail,
            password: adminPassword,
            phone: adminPhone,
            role: 'admin',
        });

        console.log(`Admin created successfully: ${admin.email}`);
        process.exit();
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

seedAdmin();
