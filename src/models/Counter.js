import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    sequence: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Composite PK: _id + year? 
// No, the doc said: {_id: "invoiceNumber", year: 2025, sequence: 0}
// This implies finding by _id AND year.
// _id is "invoiceNumber".

// Let's index lookup fields
counterSchema.index({ _id: 1, year: 1 }, { unique: true });

const Counter = mongoose.model('Counter', counterSchema);

export default Counter;
