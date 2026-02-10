import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

async function testRazorpay() {
    console.log('Testing Razorpay Connection...');
    console.log(`Key ID: ${process.env.RAZORPAY_KEY_ID}`);
    // console.log(`Key Secret: ${process.env.RAZORPAY_KEY_SECRET}`); // Don't log secret

    try {
        const options = {
            amount: 50000, // 500 INR
            currency: 'INR',
            receipt: `receipt_${Date.now()}`,
            notes: {
                test: 'validation'
            }
        };

        const order = await razorpay.orders.create(options);
        console.log('Successfully created order:', order);
    } catch (error) {
        console.error('Razorpay Error:', error);
    }
}

testRazorpay();
