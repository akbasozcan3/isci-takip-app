/**
 * Swagger API Documentation Routes
 * Example endpoint documentation
 */

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the API server
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                   example: 2.0.0
 *                 uptime:
 *                   type: number
 *                   example: 3600
 *                 database:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: number
 *                     devices:
 *                       type: number
 *                     groups:
 *                       type: number
 */

/**
 * @swagger
 * /api/location/store:
 *   post:
 *     summary: Store location data
 *     description: Store a new location update for a device
 *     tags: [Location]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - coords
 *             properties:
 *               coords:
 *                 type: object
 *                 required:
 *                   - latitude
 *                   - longitude
 *                 properties:
 *                   latitude:
 *                     type: number
 *                     format: float
 *                     example: 41.0082
 *                   longitude:
 *                     type: number
 *                     format: float
 *                     example: 28.9784
 *                   accuracy:
 *                     type: number
 *                     format: float
 *                     nullable: true
 *                   heading:
 *                     type: number
 *                     format: float
 *                     nullable: true
 *                   speed:
 *                     type: number
 *                     format: float
 *                     nullable: true
 *               timestamp:
 *                 type: integer
 *                 format: int64
 *                 example: 1704067200000
 *     responses:
 *       200:
 *         description: Location stored successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/groups:
 *   post:
 *     summary: Create a new group
 *     description: Create a new location tracking group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: İş Ekibi
 *               address:
 *                 type: string
 *                 nullable: true
 *               settings:
 *                 type: object
 *                 properties:
 *                   isPublic:
 *                     type: boolean
 *                     default: false
 *                   allowInvites:
 *                     type: boolean
 *                     default: true
 *                   maxMembers:
 *                     type: integer
 *                     default: 50
 *     responses:
 *       200:
 *         description: Group created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Group'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/groups/{groupId}/members:
 *   get:
 *     summary: Get group members
 *     description: Retrieve all members of a group with their locations
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *     responses:
 *       200:
 *         description: Group members retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                       displayName:
 *                         type: string
 *                       location:
 *                         type: object
 *                         nullable: true
 *                       isOnline:
 *                         type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

module.exports = {};

