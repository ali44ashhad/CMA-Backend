import { AppError, ValidationError } from '../utils/customErrors.js';
import { errorResponse } from '../utils/responseFormatter.js';

const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Keep the original error for reference
    error.name = err.name;
    error.code = err.code;

    // Log error for debugging
    console.error('Error:', {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method
    });

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map((val) => val.message);
        // Directly use the logic from customErrors or instantiate new ValidationError
        // But since we are inside handler, we construct response directly or re-throw?
        // Following standard pattern: modify 'error' object and usage
        // Here we just return the response
        return res.status(400).json(errorResponse(message.join(', '), 'VAL001'));
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const message = `${field} already exists`;
        return res.status(400).json(errorResponse(message, 'VAL001'));
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json(errorResponse('Invalid token', 'AUTH003'));
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json(errorResponse('Token expired', 'AUTH002'));
    }

    // Custom AppError
    if (err instanceof AppError) {
        return res.status(err.statusCode).json(errorResponse(err.message, err.errorCode, err.details));
    }

    // Check if error object has statusCode set (from spread) or fallback
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';
    const errorCode = error.errorCode || 'SRV001';

    res.status(statusCode).json(errorResponse(message, errorCode));
};

export default errorHandler;
