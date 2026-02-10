import mongoose from 'mongoose';

const leaderboardSchema = new mongoose.Schema({
    examId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: [true, 'Exam ID is required']
    },
    year: {
        type: Number,
        required: [true, 'Year is required']
    },
    rankings: [{
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        studentName: {
            type: String,
            required: true
        },
        marks: {
            type: Number,
            required: true
        },
        rank: {
            type: Number,
            required: true
        },
        attemptId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ExamAttempt',
            required: true
        }
    }],
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes
leaderboardSchema.index({ examId: 1, year: 1 }, { unique: true });
leaderboardSchema.index({ year: 1 });

const Leaderboard = mongoose.model('Leaderboard', leaderboardSchema);

export default Leaderboard;
