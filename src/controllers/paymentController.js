import * as paymentService from '../services/paymentService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { successResponse } from '../utils/responseFormatter.js';
import { ValidationError } from '../utils/customErrors.js';

export const createOrder = asyncHandler(async (req, res) => {
    const { packageId } = req.body;
    if (!packageId) throw new ValidationError('Package ID is required');

    const result = await paymentService.createOrder(req.user.id, packageId);
    res.json(successResponse('Order created successfully', result));
});

export const webhook = asyncHandler(async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    await paymentService.handleWebhook(signature, req.body);
    // Always return 200 OK to Razorpay to prevent retries
    res.status(200).json(successResponse('Webhook processed successfully'));
});

export const verifyPayment = asyncHandler(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    await paymentService.verifyPayment(req.user.id, {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
    });
    res.json(successResponse('Payment verified successfully'));
});

export const retryPayment = asyncHandler(async (req, res) => {
    const { packageId } = req.body;
    if (!packageId) throw new ValidationError('Package ID is required');

    const result = await paymentService.retryPayment(req.user.id, packageId);
    res.json(successResponse('Retry order created successfully', result));
});
