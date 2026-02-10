import Joi from 'joi';

const updateProfileSchema = Joi.object({
    name: Joi.string().min(2).max(100).optional().trim()
});

const submitAnswerSchema = Joi.object({
    questionId: Joi.string().required(),
    selectedOption: Joi.number().min(0).max(3).required()
});

// Helper for validating params like examId, attemptId
const objectIdSchema = Joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ID format');

const updateProfile = (data) => updateProfileSchema.validate(data, { abortEarly: false });
const submitAnswer = (data) => submitAnswerSchema.validate(data, { abortEarly: false });

export default {
    updateProfile,
    submitAnswer
};
