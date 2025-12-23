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

      const socialLinks = [
        { platform: 'twitter', url: process.env.SOCIAL_TWITTER || 'https://twitter.com/bavaxe', label: 'Twitter' },
        { platform: 'linkedin', url: process.env.SOCIAL_LINKEDIN || 'https://linkedin.com/company/bavaxe', label: 'LinkedIn' },
        { platform: 'github', url: process.env.SOCIAL_GITHUB || 'https://github.com/bavaxe', label: 'GitHub' },
        { platform: 'email', url: process.env.SOCIAL_EMAIL || 'mailto:support@bavaxe.com', label: 'Email' }
      ];

      const footerLinks = {
        product: [
          { label: 'Özellikler', href: '/(tabs)' },
          { label: 'Fiyatlandırma', href: '/upgrade' },
          { label: 'Güvenlik', href: '/blog?category=Güvenlik' },
          { label: 'API', href: '/blog?category=Teknoloji' }
        ],
        company: [
          { label: 'Hakkımızda', href: '/blog?category=Genel' },
          { label: 'Blog', href: '/blog' },
          { label: 'Kariyer', href: '/blog?category=İş Dünyası' },
          { label: 'İletişim', href: '/(tabs)/profile' }
        ],
        resources: [
          { label: 'Dokümantasyon', href: '/blog?category=Kullanım' },
          { label: 'Rehberler', href: '/blog?category=Kullanım' },
          { label: 'API Referansı', href: '/blog?category=Teknoloji' },
          { label: 'Yardım Merkezi', href: '/help' }
        ],
        legal: [
          { label: 'Gizlilik Politikası', href: '/blog?category=Gizlilik' },
          { label: 'Kullanım Şartları', href: '/blog?category=Gizlilik' },
          { label: 'KVKK', href: '/blog?category=Güvenlik' },
          { label: 'Çerez Politikası', href: '/blog?category=Gizlilik' }
        ]
      };

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
          splashBackground: '#0f172a',
          tagline: process.env.BRAND_TAGLINE || 'Profesyonel GPS Takip ve İş Yönetim Platformu'
        },
        footer: {
          socialLinks,
          links: footerLinks,
          copyright: `© ${new Date().getFullYear()} ${brandName}. Tüm hakları saklıdır.`
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

