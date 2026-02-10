import mongoose from 'mongoose';

const topicSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Topic name is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    level: {
        type: String,
        enum: ['foundation', 'intermediate', 'final'],
        required: [true, 'Level is required']
    },
    packageIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Package'
    }],
    status: {
        type: String,
        enum: ['active', 'archived'],
        default: 'active'
    },
    order: {
        type: Number,
        default: 0
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
topicSchema.index({ level: 1, status: 1 });
topicSchema.index({ packageIds: 1 });

// Methods
topicSchema.methods.softDelete = function () {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
};

topicSchema.query.active = function () {
    return this.where({ isDeleted: false });
};

const Topic = mongoose.model('Topic', topicSchema);

export default Topic;
