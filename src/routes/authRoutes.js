import express from 'express';
import { register, login, refresh, logout, changePassword } from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', protect, logout);
router.put('/change-password', protect, changePassword);

export default router;
