import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import compression from 'compression';
import errorHandler from './middlewares/errorMiddleware.js';
import { successResponse } from './utils/responseFormatter.js';

// Import Routes (will be created later)
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import evaluatorRoutes from './routes/evaluatorRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';

import connectDB from './config/database.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(mongoSanitize());
app.use(compression());

// Ensure database connection for serverless environments (like Vercel)
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        next(error);
    }
});

// Routes
app.get('/', (req, res) => {
    res.json(successResponse('API is running...'));
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/students', studentRoutes);
app.use('/api/v1/evaluators', evaluatorRoutes);
app.use('/api/v1/payments', paymentRoutes);

// Error Handler
app.use(errorHandler);

export default app;
