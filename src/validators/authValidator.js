import Joi from 'joi';

export const registerSchema = Joi.object({
    name: Joi.string().min(2).max(100).required().trim().messages({
        'string.base': 'Name should be a type of text',
        'string.empty': 'Name cannot be an empty field',
        'string.min': 'Name should have a minimum length of {#limit}',
        'string.max': 'Name should have a maximum length of {#limit}',
        'any.required': 'Name is a required field'
    }),
    email: Joi.string().email().required().lowercase().trim().messages({
        'string.email': 'Invalid email format',
        'any.required': 'Email is a required field'
    }),
    phone: Joi.string().pattern(/^[0-9]{10}$/).required().messages({
        'string.pattern.base': 'Phone number must be exactly 10 digits',
        'any.required': 'Phone number is a required field'
    }),
    password: Joi.string().min(8).max(128).required().messages({
        'string.min': 'Password should have a minimum length of {#limit}',
        'string.max': 'Password should have a maximum length of {#limit}',
        'any.required': 'Password is a required field'
    })
});

export const loginSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Invalid email format',
        'any.required': 'Email is a required field'
    }),
    password: Joi.string().required().messages({
        'any.required': 'Password is a required field'
    })
});

export const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string().required().messages({
        'any.required': 'Refresh token is required'
    })
});

export const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required().messages({
        'any.required': 'Current password is required'
    }),
    newPassword: Joi.string().min(8).max(128).required().messages({
        'string.min': 'New password should have a minimum length of {#limit}',
        'string.max': 'New password should have a maximum length of {#limit}',
        'any.required': 'New password is a required field'
    })
});

export const validate = (schema) => (data) => {
    return schema.validate(data, { abortEarly: false });
};
