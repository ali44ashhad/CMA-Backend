export const successResponse = (message, data = null) => {
    return {
        success: true,
        message,
        data,
        error: null
    };
};

export const errorResponse = (message, errorCode, details = {}) => {
    return {
        success: false,
        message,
        data: null,
        error: {
            code: errorCode,
            details
        }
    };
};
