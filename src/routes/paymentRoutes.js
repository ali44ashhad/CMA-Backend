import express from 'express';
import * as paymentController from '../controllers/paymentController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/webhook', paymentController.webhook);

// Protected Routes
router.use(protect);
router.use(authorize('student'));

router.post('/create-order', paymentController.createOrder);
router.post('/verify', paymentController.verifyPayment);
router.post('/retry', paymentController.retryPayment);

export default router;
