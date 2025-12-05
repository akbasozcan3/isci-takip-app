const ResponseFormatter = require('../utils/responseFormatter');

function responseMiddleware(req, res, next) {
  res.success = (data = null, message = null, statusCode = 200, meta = {}) => {
    return res.status(statusCode).json(ResponseFormatter.success(data, message, meta));
  };

  res.error = (message, code = 'ERROR', statusCode = 400, details = null) => {
    return res.status(statusCode).json(ResponseFormatter.error(message, code, details));
  };

  res.paginated = (data, page, limit, total, meta = {}) => {
    return res.status(200).json(ResponseFormatter.paginated(data, page, limit, total, meta));
  };

  next();
}

module.exports = responseMiddleware;
