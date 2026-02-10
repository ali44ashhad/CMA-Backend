import Joi from 'joi';

const evaluatorValidator = {
    submitEvaluation: (data) => {
        const schema = Joi.object({
            marks: Joi.number().required().min(0),
            remarks: Joi.string().max(1000).allow('', null).optional()
        });
        return schema.validate(data, { abortEarly: false });
    },

    assignmentsQuery: (data) => {
        const schema = Joi.object({
            status: Joi.string().valid('pending', 'accepted', 'completed').optional(),
            page: Joi.number().min(1).optional(),
            limit: Joi.number().min(1).max(100).optional()
        });
        return schema.validate(data, { abortEarly: false });
    }
};

export default evaluatorValidator;
