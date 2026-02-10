import mongoose from 'mongoose';

const packageSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Package name is required'],
        trim: true
    },
    level: {
        type: String,
        enum: {
            values: ['foundation', 'intermediate', 'final'],
            message: '{VALUE} is not a valid level'
        },
        required: [true, 'Level is required']
    },
    group: {
        type: String,
        enum: {
            values: ['group_a', 'group_b', 'combination', null],
            message: '{VALUE} is not a valid group'
        },
        default: null
    },
    year: {
        type: Number,
        required: [true, 'Year is required']
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    status: {
        type: String,
        enum: ['active', 'archived'],
        default: 'active'
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Indexes
packageSchema.index({ level: 1, year: 1, status: 1 });
packageSchema.index({ status: 1, isDeleted: 1 });
packageSchema.index({ year: -1 });

// Methods
packageSchema.methods.softDelete = function () {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
};

packageSchema.query.active = function () {
    return this.where({ isDeleted: false });
};

const Package = mongoose.model('Package', packageSchema);

export default Package;
