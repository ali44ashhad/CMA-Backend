import mongoose from 'mongoose';

const examAttemptSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Student ID is required']
    },
    examId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: [true, 'Exam ID is required']
    },
    status: {
        type: String,
        enum: ['in_progress', 'submitted', 'evaluated', 'incomplete'],
        default: 'in_progress'
    },
    startTime: {
        type: Date,
        required: true,
        default: Date.now
    },
    endTime: {
        type: Date,
        default: null
    },
    timerDuration: {
        type: Number,
        required: [true, 'Timer duration is required']
    },
    extensionsUsed: {
        type: Number,
        default: 0
    },
    // MCQ specific fields
    answers: [{
        questionId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        selectedOption: {
            type: Number,
            min: 0,
            max: 3
        }
    }],
    // PDF specific fields
    submittedPdfUrl: {
        type: String,
        default: null
    },
    // Marks
    autoGradedMarks: {
        type: Number,
        default: null
    },
    // Evaluation
    evaluatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    evaluatorMarks: {
        type: Number,
        default: null
    },
    evaluatorRemarks: {
        type: String,
        default: null,
        maxlength: 1000
    },
    checkedPdfUrl: {
        type: String,
        default: null
    },
    evaluationSubmittedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Indexes
examAttemptSchema.index({ studentId: 1, examId: 1 });
examAttemptSchema.index({ status: 1 });
examAttemptSchema.index({ evaluatorId: 1, status: 1 });
examAttemptSchema.index({ examId: 1, status: 1 });
examAttemptSchema.index({ startTime: -1 });

const ExamAttempt = mongoose.model('ExamAttempt', examAttemptSchema);

export default ExamAttempt;
