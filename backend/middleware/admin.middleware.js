/**
 * Admin Authorization Middleware
 * Ensures only admin users can access protected routes
 */

const ResponseFormatter = require('../core/utils/responseFormatter');

/**
 * Middleware to require admin role
 * Use this middleware on routes that should only be accessible to admins
 */
const requireAdmin = (req, res, next) => {
    try {
        // Check if user is authenticated
        if (!req.user) {
            return res.status(401).json(
                ResponseFormatter.error('Authentication required', 'AUTH_REQUIRED')
            );
        }

        // Check if user has admin role
        if (req.user.role !== 'admin') {
            console.warn(`[Admin] Unauthorized access attempt by user ${req.user.id} (role: ${req.user.role})`);
            return res.status(403).json(
                ResponseFormatter.error('Admin access required', 'FORBIDDEN', {
                    requiredRole: 'admin',
                    currentRole: req.user.role
                })
            );
        }

        // User is admin, proceed
        console.log(`[Admin] Admin access granted to user ${req.user.id}`);
        next();
    } catch (error) {
        console.error('[Admin] Middleware error:', error);
        return res.status(500).json(
            ResponseFormatter.error('Authorization check failed', 'AUTH_ERROR')
        );
    }
};

/**
 * Middleware to require specific role
 * More flexible than requireAdmin, allows checking for any role
 */
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json(
                    ResponseFormatter.error('Authentication required', 'AUTH_REQUIRED')
                );
            }

            const userRole = req.user.role;
            const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

            if (!rolesArray.includes(userRole)) {
                console.warn(`[Admin] Unauthorized access attempt by user ${req.user.id} (role: ${userRole}, required: ${rolesArray.join(', ')})`);
                return res.status(403).json(
                    ResponseFormatter.error('Insufficient permissions', 'FORBIDDEN', {
                        requiredRoles: rolesArray,
                        currentRole: userRole
                    })
                );
            }

            next();
        } catch (error) {
            console.error('[Admin] Role check error:', error);
            return res.status(500).json(
                ResponseFormatter.error('Authorization check failed', 'AUTH_ERROR')
            );
        }
    };
};

module.exports = {
    requireAdmin,
    requireRole
};
