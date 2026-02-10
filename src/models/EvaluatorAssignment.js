import mongoose from 'mongoose';

const evaluatorAssignmentSchema = new mongoose.Schema({
    examAttemptId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ExamAttempt',
        required: [true, 'Exam attempt ID is required'],
        unique: true
    },
    evaluatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Evaluator ID is required']
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Assigned by (Admin) is required']
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'completed'],
        default: 'pending'
    },
    assignedAt: {
        type: Date,
        default: Date.now
    },
    respondedAt: {
        type: Date,
        default: null
    },
    completedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Indexes
// evaluatorAssignmentSchema.index({ examAttemptId: 1 }, { unique: true }); // Removed: Already defined in schema with unique: true
evaluatorAssignmentSchema.index({ evaluatorId: 1, status: 1 });
evaluatorAssignmentSchema.index({ status: 1 });
evaluatorAssignmentSchema.index({ assignedAt: -1 });

const EvaluatorAssignment = mongoose.model('EvaluatorAssignment', evaluatorAssignmentSchema);

export default EvaluatorAssignment;
