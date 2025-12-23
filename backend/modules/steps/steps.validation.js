const Joi = require('joi');

const syncStepsSchema = Joi.object({
    steps: Joi.number().integer().min(0).max(1000000).required(),
    distance: Joi.number().min(0).max(10000).required(),
    calories: Joi.number().min(0).max(100000).required(),
    duration: Joi.number().integer().min(0).max(86400).required(),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
    timestamp: Joi.number().optional()
});

const updateGoalSchema = Joi.object({
    goal: Joi.number().integer().min(1).max(100000).required()
});

const historyQuerySchema = Joi.object({
    days: Joi.number().integer().min(1).max(365).default(7)
});

const statsQuerySchema = Joi.object({
    period: Joi.string().valid('week', 'month', 'year').default('week')
});

module.exports = {
    syncStepsSchema,
    updateGoalSchema,
    historyQuerySchema,
    statsQuerySchema
};
