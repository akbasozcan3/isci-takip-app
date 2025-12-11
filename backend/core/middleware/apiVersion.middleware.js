/**
 * API Versioning Middleware
 * Handles API versioning and backward compatibility
 */

const ResponseFormatter = require('../utils/responseFormatter');

function apiVersionMiddleware(req, res, next) {
  // Extract API version from header or default to v1
  const apiVersion = req.headers['api-version'] || req.headers['x-api-version'] || 'v1';
  
  // Validate version format
  if (!/^v\d+$/.test(apiVersion)) {
    return res.status(400).json(ResponseFormatter.error(
      'Invalid API version format. Use format: v1, v2, etc.',
      'INVALID_API_VERSION'
    ));
  }
  
  // Attach version to request
  req.apiVersion = apiVersion;
  res.setHeader('X-API-Version', apiVersion);
  
  // Check if version is supported
  const supportedVersions = ['v1', 'v2'];
  if (!supportedVersions.includes(apiVersion)) {
    return res.status(400).json(ResponseFormatter.error(
      `API version ${apiVersion} is not supported. Supported versions: ${supportedVersions.join(', ')}`,
      'UNSUPPORTED_API_VERSION',
      { supportedVersions }
    ));
  }
  
  next();
}

/**
 * Version-specific route handler
 */
function versionedRoute(versions) {
  return (req, res, next) => {
    const version = req.apiVersion || 'v1';
    const handler = versions[version] || versions['v1'];
    
    if (!handler) {
      return res.status(400).json(ResponseFormatter.error(
        `No handler found for API version ${version}`,
        'VERSION_HANDLER_NOT_FOUND'
      ));
    }
    
    return handler(req, res, next);
  };
}

module.exports = {
  apiVersionMiddleware,
  versionedRoute
};

