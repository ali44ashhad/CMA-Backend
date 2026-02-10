import { verifyAccessToken } from '../utils/jwt.js';
import { UnauthorizedError } from '../utils/customErrors.js';
import asyncHandler from '../utils/asyncHandler.js';
import User from '../models/User.js';

export const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        throw new UnauthorizedError('No token provided');
    }

    try {
        const decoded = verifyAccessToken(token);

        // Check if user still exists
        const user = await User.findById(decoded.id).select('-password'); // Exclude password
        if (!user) {
            throw new UnauthorizedError('User belonging to this token no longer exists');
        }

        // Check if user is deleted
        if (user.isDeleted) {
            throw new UnauthorizedError('User account is disabled');
        }

        req.user = decoded; // or req.user = user; depending on pref using light payload vs full user
        // The decoded payload has id, email, role. Often sufficient.
        // But fetching user ensures existence.
        // Let's attach full user object or just payload?
        // Plan uses req.user = decoded in notes, but controller changePassword used req.user.id
        // It's safer to just attach decoded info if we don't need full user user object every time, 
        // but verifying user existence in DB is critical for security (revocation/deletion).

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new UnauthorizedError('Token expired'); // Or specific code
        }
        throw new UnauthorizedError('Invalid or expired token');
    }
});

export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            throw new UnauthorizedError('Not authorized to access this route'); // 403 ideally
        }
        next();
    };
};
