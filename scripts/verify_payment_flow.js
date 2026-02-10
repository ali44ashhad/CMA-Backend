import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Purchase from '../src/models/Purchase.js';
import Package from '../src/models/Package.js';
import User from '../src/models/User.js';
import Counter from '../src/models/Counter.js';
import * as paymentService from '../src/services/paymentService.js';
import crypto from 'crypto';

dotenv.config();

// Mock Razorpay
import razorpay from '../src/utils/razorpay.js';
razorpay.orders.create = async (options) => {
    console.log('Mocking Razorpay Order Creation:', options);
    return {
        id: `order_mock_${Date.now()}`,
        amount: options.amount,
        currency: options.currency
    };
};

const verifyPaymentFlow = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Get a Student and a Package
        const student = await User.findOne({ role: 'student' });
        if (!student) throw new Error('No student found in DB. Please seed users first.');

        // Find or create a package
        let pkg = await Package.findOne({ status: 'active', isDeleted: false });
        if (!pkg) {
            console.log('Creating a dummy package...');
            pkg = await Package.create({
                name: 'Test Package 2026',
                level: 'foundation',
                year: 2026,
                price: 999,
                status: 'active'
            });
        }

        console.log(`Using Student: ${student.email}`);
        console.log(`Using Package: ${pkg.name} (${pkg._id})`);

        // Clean up previous purchases for this pair to allow fresh test
        await Purchase.deleteMany({ studentId: student._id, packageId: pkg._id });

        // 2. Test Create Order
        console.log('\n--- Testing Create Order ---');
        const orderResult = await paymentService.createOrder(student._id, pkg._id);
        console.log('Order created locally:', orderResult);

        // Verify Purchase record exists and is pending
        const purchase = await Purchase.findOne({ razorpayOrderId: orderResult.orderId });
        if (!purchase || purchase.paymentStatus !== 'pending') {
            throw new Error(`Purchase record mismatch. Status: ${purchase?.paymentStatus}`);
        }
        console.log('✅ Purchase record created with status: PENDING');

        // 3. Test Webhook (Payment Captured)
        console.log('\n--- Testing Webhook (Payment Captured) ---');

        const payload = {
            id: `pay_mock_${Date.now()}`,
            order_id: orderResult.orderId,
            status: 'captured',
            email: student.email,
            amount: orderResult.amount * 100
        };

        const body = {
            event: 'payment.captured',
            payload: {
                payment: {
                    entity: payload
                }
            }
        };

        // Create Valid Signature
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_secret';
        // Note: Logic allows skipping signature check if we mock the service function or set ENV correctly.
        // We mocked razorpay.js but not the service. The service uses process.env.RAZORPAY_WEBHOOK_SECRET.

        // IMPORTANT: For this test to pass without real ENV secret, we need to temporarily ensure 
        // the computed signature matches. 
        if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
            process.env.RAZORPAY_WEBHOOK_SECRET = 'test_secret';
            console.log('⚠️ Setting mock RAZORPAY_WEBHOOK_SECRET="test_secret" for verification');
        }

        const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET);
        shasum.update(JSON.stringify(body));
        const signature = shasum.digest('hex');

        // Call Service
        await paymentService.handleWebhook(signature, body);
        console.log('Webhook processed.');

        // 4. Verify Success State
        const updatedPurchase = await Purchase.findById(purchase._id);
        console.log('Updated Purchase:', {
            status: updatedPurchase.paymentStatus,
            invoiceNumber: updatedPurchase.invoiceNumber,
            invoiceUrl: updatedPurchase.invoiceUrl
        });

        if (updatedPurchase.paymentStatus !== 'success') {
            throw new Error('❌ Payment status did not update to SUCCESS');
        }
        if (!updatedPurchase.invoiceNumber || !updatedPurchase.invoiceNumber.startsWith('INV-')) {
            throw new Error('❌ Invoice number generation failed');
        }
        if (!updatedPurchase.invoiceUrl) {
            throw new Error('❌ Invoice PDF URL missing (Cloudinary upload failed?)');
        }

        console.log('✅ Payment Flow Verified Successfully!');
        console.log(`Invoice generated: ${updatedPurchase.invoiceUrl}`);

    } catch (error) {
        console.error('Verification Failed:', error);
    } finally {
        await mongoose.disconnect();
    }
};

verifyPaymentFlow();
