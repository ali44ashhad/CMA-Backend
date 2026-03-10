import mongoose from 'mongoose';

const examSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Exam name is required'],
        trim: true
    },
    topicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Topic',
        required: [true, 'Topic is required']
    },
    level: {
        type: String,
        enum: ['foundation', 'intermediate', 'final'],
        required: [true, 'Level is required']
    },
    year: {
        type: Number,
        required: [true, 'Year is required']
    },
    month: {
        type: Number,
        min: 1,
        max: 12,
        default: null
    },
    examType: {
        type: String,
        enum: ['mcq', 'pdf'],
        required: [true, 'Exam type is required']
    },
    duration: {
        type: Number,
        required: [true, 'Duration is required'], // in minutes
    },
    maxMarks: {
        type: Number,
        required: [true, 'Max marks are required']
    },
    extensionsAllowed: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    extensionInterval: {
        type: Number,
        default: 0 // in minutes
    },
    // MCQ specific fields
    questions: [{
        questionText: {
            type: String,
            required: function () { return this.examType === 'mcq'; }
        },
        options: [{
            type: String,
            required: true
        }],
        correctOption: {
            type: Number,
            required: true,
            min: 0,
            max: 3
        },
        marks: {
            type: Number,
            required: true,
            default: 1
        }
    }],
    // PDF specific fields
    questionPaperUrl: {
        type: String,
        default: null
    },
    answerKeyUrl: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['draft', 'active', 'archived'],
        default: 'draft'
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
examSchema.index({ level: 1, year: 1, month: 1, status: 1 });
examSchema.index({ topicId: 1 });
examSchema.index({ examType: 1 });
examSchema.index({ status: 1, isDeleted: 1 });

// Validation
examSchema.path('questions').validate(function (questions) {
    if (this.examType === 'mcq') {
        return questions && questions.length > 0;
    }
    return true;
}, 'MCQ exams must have at least one question');

examSchema.path('questionPaperUrl').validate(function (url) {
    if (this.examType === 'pdf') {
        return url != null && url.length > 0;
    }
    return true;
}, 'PDF exams must have a question paper URL');

// Methods
examSchema.methods.softDelete = function () {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
};

examSchema.query.active = function () {
    return this.where({ isDeleted: false });
};

const Exam = mongoose.model('Exam', examSchema);

export default Exam;
