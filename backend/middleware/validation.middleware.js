/**
 * Input Validation Middleware
 * Provides request validation using Joi schemas
 */

const Joi = require('joi');

/**
 * Validate request body against a Joi schema
 */
const validateBody = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors
            });
        }

        req.body = value;
        next();
    };
};

/**
 * Validate query parameters against a Joi schema
 */
const validateQuery = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.query, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors
            });
        }

        req.query = value;
        next();
    };
};

/**
 * Validate route parameters against a Joi schema
 */
const validateParams = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.params, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors
            });
        }

        req.params = value;
        next();
    };
};

// Common validation schemas
const schemas = {
    // User schemas
    register: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        displayName: Joi.string().min(2).max(50).required(),
        phone: Joi.string().pattern(/^\+90\d{10}$/).optional()
    }),

    login: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    }),

    updateProfile: Joi.object({
        displayName: Joi.string().min(2).max(50).optional(),
        phone: Joi.string().pattern(/^\+90\d{10}$/).optional(),
        currentPassword: Joi.string().optional(),
        newPassword: Joi.string().min(6).optional(),
        verificationCode: Joi.string().length(6).optional()
    }).custom((value, helpers) => {
        // If newPassword is provided, either currentPassword or verificationCode must be provided
        if (value.newPassword && !value.currentPassword && !value.verificationCode) {
            return helpers.error('any.custom', {
                message: 'Either currentPassword or verificationCode is required when changing password'
            });
        }
        return value;
    }),

    changePassword: Joi.object({
        currentPassword: Joi.string().required(),
        newPassword: Joi.string().min(6).required()
    }),

    resetPassword: Joi.object({
        email: Joi.string().email().required(),
        code: Joi.string().length(6).required(),
        newPassword: Joi.string().min(6).required()
    }),

    // Location schemas
    locationUpdate: Joi.object({
        latitude: Joi.number().min(-90).max(90).required(),
        longitude: Joi.number().min(-180).max(180).required(),
        accuracy: Joi.number().min(0).optional(),
        heading: Joi.number().min(0).max(360).optional(),
        speed: Joi.number().min(0).optional(),
        timestamp: Joi.number().optional()
    }),

    // Steps schema
    stepsUpdate: Joi.object({
        steps: Joi.number().integer().min(0).required(),
        distance: Joi.number().min(0).optional(),
        calories: Joi.number().min(0).optional(),
        timestamp: Joi.number().optional()
    }),

    // Group schemas
    createGroup: Joi.object({
        name: Joi.string().min(2).max(50).required(),
        description: Joi.string().max(200).optional(),
        members: Joi.array().items(Joi.string()).optional()
    }),

    updateGroup: Joi.object({
        name: Joi.string().min(2).max(50).optional(),
        description: Joi.string().max(200).optional()
    }),

    // Pagination schema
    pagination: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20),
        sortBy: Joi.string().optional(),
        sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    }),

    // ID parameter
    id: Joi.object({
        id: Joi.string().required()
    })
};

module.exports = {
    validateBody,
    validateQuery,
    validateParams,
    schemas
};
