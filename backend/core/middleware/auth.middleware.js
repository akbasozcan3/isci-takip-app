const TokenModel = require('../database/models/token.model');
const UserModel = require('../database/models/user.model');

const ResponseFormatter = require('../utils/responseFormatter');

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json(
      ResponseFormatter.error('Token gereklidir', 'AUTH_REQUIRED')
    );
  }

  const tokenData = TokenModel.get(token);
  if (!tokenData) {
    return res.status(401).json(
      ResponseFormatter.error('Geçersiz veya süresi dolmuş token', 'INVALID_TOKEN')
    );
  }

  const user = UserModel.findById(tokenData.userId);
  if (!user) {
    return res.status(404).json(
      ResponseFormatter.error('Kullanıcı bulunamadı', 'USER_NOT_FOUND')
    );
  }

  req.user = user;
  req.token = token;
  next();
}

function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const tokenData = TokenModel.get(token);
    if (tokenData) {
      const user = UserModel.findById(tokenData.userId);
      if (user) {
        req.user = user;
        req.token = token;
      }
    }
  }
  next();
}

function getUserIdFromToken(req) {
  if (req.user && req.user.id) {
    return req.user.id;
  }
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const tokenData = TokenModel.get(token);
    return tokenData ? tokenData.userId : null;
  } catch (error) {
    return null;
  }
}

module.exports = { requireAuth, optionalAuth, getUserIdFromToken };

