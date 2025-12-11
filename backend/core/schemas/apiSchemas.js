/**
 * Professional API Validation Schemas
 * Centralized validation schemas for all API endpoints
 */

const Joi = require('joi');

const schemas = {
  // Authentication Schemas
  login: Joi.object({
    phone: Joi.string()
      .pattern(/^[0-9]{10,15}$/)
      .required()
      .messages({
        'string.pattern.base': 'Telefon numarası geçerli formatta olmalıdır (10-15 rakam)',
        'any.required': 'Telefon numarası gereklidir'
      }),
    password: Joi.string()
      .min(6)
      .required()
      .messages({
        'string.min': 'Şifre en az 6 karakter olmalıdır',
        'any.required': 'Şifre gereklidir'
      })
  }),

  register: Joi.object({
    phone: Joi.string()
      .pattern(/^[0-9]{10,15}$/)
      .required()
      .messages({
        'string.pattern.base': 'Telefon numarası geçerli formatta olmalıdır',
        'any.required': 'Telefon numarası gereklidir'
      }),
    password: Joi.string()
      .min(6)
      .max(128)
      .required()
      .messages({
        'string.min': 'Şifre en az 6 karakter olmalıdır',
        'string.max': 'Şifre en fazla 128 karakter olabilir',
        'any.required': 'Şifre gereklidir'
      }),
    name: Joi.string()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'İsim en az 2 karakter olmalıdır',
        'string.max': 'İsim en fazla 100 karakter olabilir',
        'any.required': 'İsim gereklidir'
      }),
    email: Joi.string()
      .email()
      .optional()
      .allow(null, '')
      .messages({
        'string.email': 'Geçerli bir e-posta adresi giriniz'
      })
  }),

  // Location Schemas
  storeLocation: Joi.object({
    coords: Joi.object({
      latitude: Joi.number()
        .min(-90)
        .max(90)
        .required()
        .messages({
          'number.min': 'Latitude -90 ile 90 arasında olmalıdır',
          'number.max': 'Latitude -90 ile 90 arasında olmalıdır',
          'any.required': 'Latitude gereklidir'
        }),
      longitude: Joi.number()
        .min(-180)
        .max(180)
        .required()
        .messages({
          'number.min': 'Longitude -180 ile 180 arasında olmalıdır',
          'number.max': 'Longitude -180 ile 180 arasında olmalıdır',
          'any.required': 'Longitude gereklidir'
        }),
      accuracy: Joi.number()
        .min(0)
        .max(10000)
        .optional()
        .allow(null),
      altitude: Joi.number()
        .optional()
        .allow(null),
      heading: Joi.number()
        .min(0)
        .max(360)
        .optional()
        .allow(null),
      speed: Joi.number()
        .min(0)
        .max(500)
        .optional()
        .allow(null)
    }).required(),
    timestamp: Joi.number()
      .integer()
      .min(0)
      .optional(),
    deviceId: Joi.string()
      .optional(),
    groupId: Joi.string()
      .optional()
  }),

  // Group Schemas
  createGroup: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Grup adı en az 2 karakter olmalıdır',
        'string.max': 'Grup adı en fazla 100 karakter olabilir',
        'any.required': 'Grup adı gereklidir'
      }),
    description: Joi.string()
      .max(500)
      .optional()
      .allow(null, ''),
    address: Joi.string()
      .max(200)
      .optional()
      .allow(null, ''),
    settings: Joi.object({
      isPublic: Joi.boolean().default(false),
      allowInvites: Joi.boolean().default(true),
      maxMembers: Joi.number().integer().min(2).max(1000).default(50),
      locationSharingEnabled: Joi.boolean().default(true),
      notificationsEnabled: Joi.boolean().default(true)
    }).optional()
  }),

  updateGroup: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .optional(),
    description: Joi.string()
      .max(500)
      .optional()
      .allow(null, ''),
    address: Joi.string()
      .max(200)
      .optional()
      .allow(null, ''),
    settings: Joi.object({
      isPublic: Joi.boolean(),
      allowInvites: Joi.boolean(),
      maxMembers: Joi.number().integer().min(2).max(1000),
      locationSharingEnabled: Joi.boolean(),
      notificationsEnabled: Joi.boolean()
    }).optional()
  }),

  // User Schemas
  updateProfile: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .optional(),
    email: Joi.string()
      .email()
      .optional()
      .allow(null, ''),
    phone: Joi.string()
      .pattern(/^[0-9]{10,15}$/)
      .optional(),
    avatar: Joi.string()
      .uri()
      .optional()
      .allow(null, ''),
    preferences: Joi.object({
      language: Joi.string().valid('tr', 'en').default('tr'),
      notifications: Joi.boolean().default(true),
      locationSharing: Joi.boolean().default(true),
      theme: Joi.string().valid('light', 'dark', 'auto').default('auto')
    }).optional()
  }),

  // Message Schemas
  sendMessage: Joi.object({
    groupId: Joi.string()
      .required()
      .messages({
        'any.required': 'Grup ID gereklidir'
      }),
    message: Joi.string()
      .min(1)
      .max(5000)
      .required()
      .messages({
        'string.min': 'Mesaj boş olamaz',
        'string.max': 'Mesaj en fazla 5000 karakter olabilir',
        'any.required': 'Mesaj gereklidir'
      }),
    type: Joi.string()
      .valid('text', 'location', 'image', 'file')
      .default('text'),
    replyTo: Joi.string()
      .optional()
      .allow(null, '')
  }),

  // Blog Schemas
  createArticle: Joi.object({
    title: Joi.string()
      .min(5)
      .max(200)
      .required()
      .messages({
        'string.min': 'Başlık en az 5 karakter olmalıdır',
        'string.max': 'Başlık en fazla 200 karakter olabilir',
        'any.required': 'Başlık gereklidir'
      }),
    content: Joi.string()
      .min(50)
      .max(50000)
      .required()
      .messages({
        'string.min': 'İçerik en az 50 karakter olmalıdır',
        'string.max': 'İçerik en fazla 50000 karakter olabilir',
        'any.required': 'İçerik gereklidir'
      }),
    excerpt: Joi.string()
      .max(500)
      .optional()
      .allow(null, ''),
    category: Joi.string()
      .max(50)
      .optional(),
    tags: Joi.array()
      .items(Joi.string().max(30))
      .max(10)
      .optional(),
    featuredImage: Joi.string()
      .uri()
      .optional()
      .allow(null, ''),
    isPublished: Joi.boolean().default(false)
  }),

  // Billing Schemas
  createPayment: Joi.object({
    planId: Joi.string()
      .valid('free', 'plus', 'business')
      .required()
      .messages({
        'any.only': 'Geçerli bir plan seçiniz (free, plus, business)',
        'any.required': 'Plan ID gereklidir'
      }),
    paymentMethod: Joi.string()
      .valid('credit_card', 'bank_transfer', 'iyzico')
      .required(),
    billingAddress: Joi.object({
      name: Joi.string().required(),
      address: Joi.string().required(),
      city: Joi.string().required(),
      country: Joi.string().required(),
      postalCode: Joi.string().optional()
    }).optional()
  }),

  // Query Parameters
  pagination: Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .default(1),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(10),
    sortBy: Joi.string()
      .optional(),
    sortOrder: Joi.string()
      .valid('asc', 'desc')
      .default('desc')
  }),

  dateRange: Joi.object({
    startDate: Joi.date()
      .optional(),
    endDate: Joi.date()
      .min(Joi.ref('startDate'))
      .optional(),
    dateRange: Joi.string()
      .valid('today', 'week', 'month', 'year', '7d', '30d', '90d', '1y')
      .optional()
  }),

  // ID Validation
  mongoId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Geçerli bir ID formatı gerekir'
    }),

  uuid: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Geçerli bir UUID formatı gerekir'
    })
};

/**
 * Validate request against schema
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = source === 'query' ? req.query : 
                 source === 'params' ? req.params : 
                 req.body;

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors,
        timestamp: new Date().toISOString()
      });
    }

    // Replace request data with validated and sanitized data
    if (source === 'query') {
      req.query = value;
    } else if (source === 'params') {
      req.params = value;
    } else {
      req.body = value;
    }

    next();
  };
}

module.exports = {
  schemas,
  validate
};

