import mongoose from 'mongoose';

const purchaseSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Student ID is required']
    },
    packageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Package',
        required: [true, 'Package ID is required']
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0, 'Amount must be non-negative']
    },
    razorpayOrderId: {
        type: String,
        required: [true, 'Razorpay Order ID is required'],
        unique: true
    },
    razorpayPaymentId: {
        type: String,
        default: null
    },
    razorpaySignature: {
        type: String,
        default: null
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'success', 'failed'],
        default: 'pending'
    },
    invoiceNumber: {
        type: String,
        unique: true,
        sparse: true
    },
    invoiceUrl: {
        type: String,
        default: null
    },
    purchasedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Indexes
purchaseSchema.index({ studentId: 1, packageId: 1 });
purchaseSchema.index({ razorpayOrderId: 1 }, { unique: true });
purchaseSchema.index({ paymentStatus: 1 });
purchaseSchema.index({ invoiceNumber: 1 }, { unique: true, sparse: true });
purchaseSchema.index({ purchasedAt: -1 });

const Purchase = mongoose.model('Purchase', purchaseSchema);

export default Purchase;
