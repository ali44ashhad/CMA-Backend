import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

if (!secret) {
    console.error('Error: RAZORPAY_WEBHOOK_SECRET not found in .env');
    process.exit(1);
}

const orderId = process.argv[2];

if (!orderId) {
    console.error('Usage: node src/scripts/generate_signature.js <order_id>');
    process.exit(1);
}

// Construct the payload exactly as it appears in the Postman/Webhook request
const payload = {
    event: 'payment.captured',
    payload: {
        payment: {
            entity: {
                order_id: orderId,
                status: 'captured'
            }
        }
    }
};

const body = JSON.stringify(payload);
const shasum = crypto.createHmac('sha256', secret);
shasum.update(body);
const signature = shasum.digest('hex');

console.log('----------------------------------------');
console.log('Generated Signature for Order:', orderId);
console.log('----------------------------------------');
console.log(signature);
console.log('----------------------------------------');
console.log('Use this signature in the "x-razorpay-signature" header in Postman.');
