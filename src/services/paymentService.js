import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import razorpay from '../utils/razorpay.js';
import Purchase from '../models/Purchase.js';
import Package from '../models/Package.js';
import User from '../models/User.js';
import Counter from '../models/Counter.js';
import { generateInvoicePDF } from '../utils/invoiceGenerator.js';
import { AppError, NotFoundError, ValidationError } from '../utils/customErrors.js';

// Ensure Cloudinary is configured (idempotent if already configured)
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Create Order
export const createOrder = async (studentId, packageId) => {
    // 1. Check Package
    const pkg = await Package.findOne({ _id: packageId, status: 'active', isDeleted: false });
    if (!pkg) throw new NotFoundError('Package', 'PAY004');

    // 2. Check if already purchased (success)
    const existingPurchase = await Purchase.findOne({
        studentId,
        packageId,
        paymentStatus: 'success'
    });
    if (existingPurchase) {
        throw new AppError('Package already purchased', 400, 'PAY003');
    }

    const amountPaise = Math.round((pkg.price || 0) * 100);
    const isFree = amountPaise < 100; // Razorpay minimum is 100 paise (₹1)

    // 3a. Free package: activate directly without Razorpay
    if (isFree) {
        const purchase = await Purchase.create({
            studentId,
            packageId,
            amount: pkg.price,
            razorpayOrderId: `free_${Date.now()}_${studentId.toString().slice(-4)}`,
            paymentStatus: 'success',
            purchasedAt: new Date()
        });
        return {
            free: true,
            orderId: purchase.razorpayOrderId,
            amount: pkg.price,
            packageId: pkg._id,
            packageName: pkg.name
        };
    }

    // 3b. Paid package: validate Razorpay config
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
        console.error('Razorpay credentials missing: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env');
        throw new AppError('Payment gateway not configured. Please contact support.', 500, 'PAY005');
    }

    const options = {
        amount: amountPaise,
        currency: 'INR',
        receipt: `rcpt_${Date.now().toString().slice(-8)}_${studentId.toString().slice(-4)}`,
        notes: {
            packageId: packageId.toString(),
            studentId: studentId.toString()
        }
    };

    let order;
    try {
        order = await razorpay.orders.create(options);
    } catch (err) {
        console.error('Razorpay Order Creation Error:', err);
        throw new AppError(err?.error?.description || 'Failed to create payment order. Please try again.', 500, 'PAY001');
    }

    // 4. Create Purchase Record
    const purchase = await Purchase.create({
        studentId,
        packageId,
        amount: pkg.price,
        razorpayOrderId: order.id,
        paymentStatus: 'pending'
    });

    return {
        orderId: order.id,
        amount: pkg.price,
        currency: 'INR',
        packageId: pkg._id,
        packageName: pkg.name,
        key: keyId
    };
};

// Handle Webhook
export const handleWebhook = async (signature, body) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // 1. Verify Signature
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(JSON.stringify(body));
    const digest = shasum.digest('hex');

    if (digest !== signature) {
        throw new AppError('Invalid webhook signature', 400, 'PAY002');
    }

    const event = body.event;
    const payload = body.payload.payment.entity;
    const orderId = payload.order_id;

    console.log(`Webhook Processing: Event=${event}, OrderID=${orderId}`);

    // 2. Find Purchase
    const purchase = await Purchase.findOne({ razorpayOrderId: orderId }).populate('studentId').populate('packageId');

    if (!purchase) {
        // Log warning: Received webhook for unknown order
        console.warn(`Webhook received for unknown order: ${orderId}`);
        return;
    }

    console.log(`Found Purchase: ${purchase._id}, Current Status: ${purchase.paymentStatus}`);

    // 3. Handle Events
    if (event === 'payment.captured') {
        if (purchase.paymentStatus === 'success') {
            console.log('Payment already successful. Skipping.');
            return; // Idempotency check
        }

        // Update status
        purchase.paymentStatus = 'success';
        purchase.razorpayPaymentId = payload.id;
        purchase.purchasedAt = new Date(); // Use current time or payload.created_at

        // Generate Invoice
        // a. Get Next Invoice Number
        const year = new Date().getFullYear();
        const counter = await Counter.findOneAndUpdate(
            { _id: 'invoiceNumber', year },
            { $inc: { sequence: 1 } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        const paddedSeq = String(counter.sequence).padStart(5, '0');
        const invoiceNumber = `INV-${year}-${paddedSeq}`;

        purchase.invoiceNumber = invoiceNumber;

        // b. Generate PDF
        const pdfBuffer = await generateInvoicePDF({
            invoiceNumber,
            date: purchase.purchasedAt,
            student: {
                name: purchase.studentId.name,
                email: purchase.studentId.email
            },
            package: {
                name: purchase.packageId.name
            },
            amount: purchase.amount,
            orderId: purchase.razorpayOrderId
        });

        // c. Upload to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'cma-invoices',
                    resource_type: 'raw', // PDF treats as raw or image? Usually raw for PDF docs? 
                    // Cloudinary 'image' type supports PDF transformation to image, 'raw' stores just file.
                    // 'auto' often detects. Let's use 'auto' or 'image' with format 'pdf'.
                    // Use 'auto' to be safe.
                    resource_type: 'auto',
                    public_id: `invoice_${invoiceNumber}`,
                    format: 'pdf'
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            streamifier.createReadStream(pdfBuffer).pipe(uploadStream);
        });

        purchase.invoiceUrl = uploadResult.secure_url;
        await purchase.save();

        // TODO: Send Email (using nodemailer service)
        console.log(`Invoice emailed to ${purchase.studentId.email}`);

    } else if (event === 'payment.failed') {
        purchase.paymentStatus = 'failed';
        await purchase.save();
    }

    return;
};

// Verify Payment (from frontend after Razorpay success - webhooks often don't reach localhost)
export const verifyPayment = async (studentId, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new ValidationError('razorpay_order_id, razorpay_payment_id and razorpay_signature are required');
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new AppError('Payment verification not configured', 500, 'PAY005');

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', keySecret).update(body).digest('hex');
    if (expectedSignature !== razorpay_signature) {
        throw new AppError('Invalid payment signature', 400, 'PAY002');
    }

    const purchase = await Purchase.findOne({ razorpayOrderId: razorpay_order_id, studentId })
        .populate('studentId')
        .populate('packageId');
    if (!purchase) throw new NotFoundError('Purchase', 'PAY006');
    if (purchase.paymentStatus === 'success') {
        return { success: true, message: 'Already verified' };
    }

    purchase.paymentStatus = 'success';
    purchase.razorpayPaymentId = razorpay_payment_id;
    purchase.purchasedAt = new Date();

    const year = new Date().getFullYear();
    const counter = await Counter.findOneAndUpdate(
        { _id: 'invoiceNumber', year },
        { $inc: { sequence: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const paddedSeq = String(counter.sequence).padStart(5, '0');
    purchase.invoiceNumber = `INV-${year}-${paddedSeq}`;

    try {
        const pdfBuffer = await generateInvoicePDF({
            invoiceNumber: purchase.invoiceNumber,
            date: purchase.purchasedAt,
            student: { name: purchase.studentId.name, email: purchase.studentId.email },
            package: { name: purchase.packageId.name },
            amount: purchase.amount,
            orderId: purchase.razorpayOrderId
        });
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder: 'cma-invoices', resource_type: 'auto', public_id: `invoice_${purchase.invoiceNumber}`, format: 'pdf' },
                (err, result) => (err ? reject(err) : resolve(result))
            );
            streamifier.createReadStream(pdfBuffer).pipe(uploadStream);
        });
        purchase.invoiceUrl = uploadResult.secure_url;
    } catch (invErr) {
        console.error('Invoice generation failed (payment still verified):', invErr);
    }
    await purchase.save();

    return { success: true, message: 'Payment verified successfully' };
};

// Retry Payment
export const retryPayment = async (studentId, packageId) => {
    // Almost same as createOrder, but maybe we want to link to previous failed attempt?
    // Docs say: "Create new Razorpay order". 
    // And "Create new Purchase document (or update existing failed one)".
    // Creating new is cleaner for history.

    return await createOrder(studentId, packageId);
};
