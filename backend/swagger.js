/**
 * Swagger/OpenAPI Configuration for BAVAXE API
 * Auto-generated API documentation
 */

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BAVAXE GPS Tracking API',
      version: '2.0.0',
      description: `
        Professional GPS Tracking and Location Management API
        
        ## Features
        - Real-time location tracking via Socket.IO
        - Group management and collaboration
        - Advanced analytics and reporting
        - Subscription-based billing system
        - Email verification and authentication
        - Push notifications via OneSignal
        
        ## Authentication
        Most endpoints require JWT authentication. Include the token in the Authorization header:
        \`\`\`
        Authorization: Bearer <your-token>
        \`\`\`
        
        ## Rate Limiting
        Rate limits are applied based on subscription plan:
        - Free: 50 requests/minute
        - Plus: 200 requests/minute
        - Business: 500 requests/minute
      `,
      contact: {
        name: 'BAVAXE Support',
        email: 'support@bavaxe.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:4000',
        description: 'Development Server',
      },
      {
        url: 'https://api.bavaxe.com',
        description: 'Production Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'user_123' },
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            name: { type: 'string', example: 'John Doe' },
            phone: { type: 'string', example: '+905551234567' },
            verified: { type: 'boolean', example: true },
            subscription: {
              type: 'object',
              properties: {
                plan: { type: 'string', enum: ['free', 'plus', 'business'], example: 'plus' },
                startDate: { type: 'string', format: 'date-time' },
                endDate: { type: 'string', format: 'date-time', nullable: true },
                status: { type: 'string', enum: ['active', 'cancelled', 'expired'], example: 'active' },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Location: {
          type: 'object',
          properties: {
            deviceId: { type: 'string', example: 'device_123' },
            userId: { type: 'string', example: 'user_123' },
            coords: {
              type: 'object',
              properties: {
                latitude: { type: 'number', format: 'float', example: 41.0082 },
                longitude: { type: 'number', format: 'float', example: 28.9784 },
                accuracy: { type: 'number', format: 'float', nullable: true, example: 10.5 },
                heading: { type: 'number', format: 'float', nullable: true, example: 45.0 },
                speed: { type: 'number', format: 'float', nullable: true, example: 5.2 },
              },
              required: ['latitude', 'longitude'],
            },
            timestamp: { type: 'integer', format: 'int64', example: 1704067200000 },
            metadata: {
              type: 'object',
              properties: {
                battery: { type: 'number', nullable: true },
                network: { type: 'string', nullable: true },
              },
            },
          },
        },
        Group: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'group_123' },
            name: { type: 'string', example: 'İş Ekibi' },
            code: { type: 'string', example: 'ABC123' },
            adminId: { type: 'string', example: 'user_123' },
            members: {
              type: 'array',
              items: { type: 'string' },
              example: ['user_123', 'user_456'],
            },
            settings: {
              type: 'object',
              properties: {
                isPublic: { type: 'boolean', example: false },
                allowInvites: { type: 'boolean', example: true },
                maxMembers: { type: 'integer', example: 50 },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Error message' },
            code: { type: 'string', example: 'ERROR_CODE' },
            errorId: { type: 'string', example: 'abc123def456' },
            timestamp: { type: 'string', format: 'date-time' },
            details: { type: 'object', nullable: true },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            message: { type: 'string', nullable: true },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                success: false,
                error: 'Geçersiz veya süresi dolmuş token',
                code: 'AUTH_ERROR',
                errorId: 'abc123',
                timestamp: '2025-01-09T12:00:00.000Z',
              },
            },
          },
        },
        ValidationError: {
          description: 'Validation failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                success: false,
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: [
                  { field: 'email', message: 'Email is required' },
                ],
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
    },
    tags: [
      { name: 'Authentication', description: 'User authentication and authorization' },
      { name: 'Location', description: 'Location tracking and management' },
      { name: 'Groups', description: 'Group management and collaboration' },
      { name: 'Analytics', description: 'Analytics and reporting' },
      { name: 'Billing', description: 'Subscription and payment management' },
      { name: 'Notifications', description: 'Push notifications' },
      { name: 'System', description: 'System health and metrics' },
    ],
  },
  apis: [
    './routes/*.js',
    './controllers/*.js',
    './modules/**/*.js',
    './core/**/*.js',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

