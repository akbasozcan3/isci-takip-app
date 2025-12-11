const db = require('../config/database');
const ResponseFormatter = require('../core/utils/responseFormatter');
const { getUserIdFromToken } = require('../core/middleware/auth.middleware');
const createError = require('../core/utils/errorHandler').createError;

class AppConfigController {
  async getAppConfig(req, res) {
    try {
      const logoUrl = process.env.APP_LOGO_URL || 'https://via.placeholder.com/200x200/06b6d4/ffffff?text=BAVAXE';
      const brandName = process.env.BRAND_NAME || 'Bavaxe';
      const brandColor = process.env.BRAND_COLOR_PRIMARY || '#06b6d4';
      const brandColorSecondary = process.env.BRAND_COLOR_SECONDARY || '#7c3aed';

      return res.json(ResponseFormatter.success({
        logo: {
          url: logoUrl,
          width: 200,
          height: 200
        },
        branding: {
          name: brandName,
          primaryColor: brandColor,
          secondaryColor: brandColorSecondary,
          splashBackground: '#0f172a'
        },
        version: '1.0.0',
        features: {
          analytics: true,
          locationTracking: true,
          groups: true,
          payments: true
        }
      }));

    } catch (error) {
      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code));
      }
      console.error('Get app config error:', error);
      return res.status(500).json(ResponseFormatter.error('Uygulama yapılandırması alınamadı', 'CONFIG_ERROR'));
    }
  }

  async getSplashConfig(req, res) {
    try {
      const logoUrl = process.env.APP_LOGO_URL || null;
      const brandName = process.env.BRAND_NAME || 'Bavaxe';
      const brandColor = process.env.BRAND_COLOR_PRIMARY || '#06b6d4';
      const splashBackground = process.env.SPLASH_BACKGROUND || '#0f172a';
      const splashMinTime = parseInt(process.env.SPLASH_MIN_TIME || '400', 10);

      return res.json(ResponseFormatter.success({
        logo: logoUrl ? {
          url: logoUrl,
          width: 240,
          height: 240,
          borderRadius: 36
        } : {
          text: 'B',
          fontSize: 120,
          color: '#fff',
          backgroundColor: brandColor,
          width: 240,
          height: 240,
          borderRadius: 36
        },
        background: splashBackground,
        minDisplayTime: splashMinTime,
        animation: {
          type: 'spring',
          duration: 400
        }
      }));

    } catch (error) {
      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code));
      }
      console.error('Get splash config error:', error);
      return res.status(500).json(ResponseFormatter.error('Splash yapılandırması alınamadı', 'SPLASH_CONFIG_ERROR'));
    }
  }
}

module.exports = new AppConfigController();

