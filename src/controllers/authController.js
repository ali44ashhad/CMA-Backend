import crypto from 'crypto';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { comparePassword, hashPassword } from '../utils/bcrypt.js';
import { successResponse } from '../utils/responseFormatter.js';
import { AppError, UnauthorizedError, ValidationError } from '../utils/customErrors.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validate, registerSchema, loginSchema, refreshTokenSchema, changePasswordSchema } from '../validators/authValidator.js';

// Register User
export const register = asyncHandler(async (req, res) => {
    const { error } = validate(registerSchema)(req.body);
    if (error) {
        throw new ValidationError(error.details.map((d) => d.message).join(', '));
    }

    const { name, email, phone, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
        if (existingUser.email === email) throw new ValidationError('Email already exists');
        if (existingUser.phone === phone) throw new ValidationError('Phone already exists');
    }

    // Create user
    // Password hashing is handled by pre-save hook in User model
    const user = await User.create({
        name,
        email,
        phone,
        password,
        role: 'student' // Default role
    });

    // Generate tokens
    const accessToken = generateAccessToken({ id: user._id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({
        id: user._id,
        uuid: crypto.randomUUID()
    });

    // Save refresh token
    await RefreshToken.create({
        userId: user._id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    res.status(201).json(successResponse('Registration successful', {
        user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role
        },
        accessToken,
        refreshToken
    }));
});

// Login User
export const login = asyncHandler(async (req, res) => {
    const { error } = validate(loginSchema)(req.body);
    if (error) {
        throw new ValidationError(error.details.map((d) => d.message).join(', '));
    }

    const { email, password } = req.body;

    // Check user
    const user = await User.findOne({ email }).select('+password'); // Explicitly select password
    if (!user) {
        throw new UnauthorizedError('Invalid credentials');
    }

    // Check isDeleted
    if (user.isDeleted) {
        throw new AppError('Account deleted or disabled', 403, 'AUTH004');
    }

    // Match password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
        throw new UnauthorizedError('Invalid credentials');
    }

    // Generate tokens
    const accessToken = generateAccessToken({ id: user._id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({
        id: user._id,
        uuid: crypto.randomUUID()
    });

    // Save refresh token
    await RefreshToken.create({
        userId: user._id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    res.json(successResponse('Login successful', {
        user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role
        },
        accessToken,
        refreshToken
    }));
});

// Refresh Token
export const refresh = asyncHandler(async (req, res) => {
    const { error } = validate(refreshTokenSchema)(req.body);
    if (error) {
        throw new ValidationError(error.details.map((d) => d.message).join(', '));
    }

    const { refreshToken } = req.body;

    try {
        const decoded = verifyRefreshToken(refreshToken);

        // Check if token exists in DB
        const existingToken = await RefreshToken.findOne({ token: refreshToken });
        if (!existingToken) {
            throw new UnauthorizedError('Invalid refresh token');
        }

        // Check if user exists and not deleted
        const user = await User.findById(decoded.id);
        if (!user || user.isDeleted) {
            throw new UnauthorizedError('User not found or disabled');
        }

        // Delete old token
        await RefreshToken.findByIdAndDelete(existingToken._id);

        // Generate new tokens
        const newAccessToken = generateAccessToken({ id: user._id, email: user.email, role: user.role });
        const newRefreshToken = generateRefreshToken({
            id: user._id,
            uuid: crypto.randomUUID()
        });

        // Save new refresh token
        await RefreshToken.create({
            userId: user._id,
            token: newRefreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });

        res.json(successResponse('Token refreshed', {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        }));

    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            throw new AppError('Token expired', 401, 'AUTH002');
        }
        throw new UnauthorizedError('Invalid refresh token');
    }
});

// Logout
export const logout = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body; // Optional: revoke specific token, or revoke all for user?
    // API spec says request body has refreshToken.

    if (refreshToken) {
        await RefreshToken.findOneAndDelete({ token: refreshToken });
    } else {
        // If no refresh token provided, maybe just relying on client dropping it?
        // But helpful to clean up DB.
        // Spec says 'refreshToken' is required body param for logout in API_01_AUTH.md implementation notes
        // but validation table says required.
    }

    res.json(successResponse('Logout successful'));
});

// Change Password
export const changePassword = asyncHandler(async (req, res) => {
    const { error } = validate(changePasswordSchema)(req.body);
    if (error) {
        throw new ValidationError(error.details.map((d) => d.message).join(', '));
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id; // From auth middleware

    const user = await User.findById(userId).select('+password');
    if (!user) {
        throw new NotFoundError('User');
    }

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
        throw new UnauthorizedError('Current password incorrect');
    }

    // Check if new password is same as old (optional, but good practice)
    const isSame = await user.matchPassword(newPassword);
    if (isSame) {
        throw new ValidationError('New password cannot be the same as current password');
    }

    // Update password
    // We need to re-hash. User model pre-save hook handles hashing if 'password' is modified.
    // user.password = newPassword; 
    // But wait, the hook uses bcrypt, we want consistent usage.
    // The hook does: isModified check then hash.
    // user.password = newPassword; await user.save(); triggers hook.

    user.password = newPassword;
    await user.save();

    // Revoke all refresh tokens
    await RefreshToken.deleteMany({ userId: user._id });

    res.json(successResponse('Password changed successfully. Please login again.'));
});
