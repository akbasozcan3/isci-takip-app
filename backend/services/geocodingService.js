const fetch = require('node-fetch');
const db = require('../config/database');
const activityLogService = require('./activityLogService');

class GeocodingService {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 24 * 60 * 60 * 1000;
    this.rateLimitDelay = 1100;
    this.lastRequestTime = 0;
    this.requestQueue = [];
    this.processing = false;
  }

  async getCityProvince(lat, lng) {
    const latNum = typeof lat === 'number' ? lat : parseFloat(lat);
    const lngNum = typeof lng === 'number' ? lng : parseFloat(lng);
    
    if (!isFinite(latNum) || !isFinite(lngNum)) {
      console.error('[GeocodingService] Invalid coordinates:', { lat, lng, latNum, lngNum });
      return {
        city: 'Bilinmeyen Şehir',
        province: 'Bilinmeyen İl',
        district: null,
        fullAddress: `${lat}, ${lng}`,
        country: 'Türkiye',
        timestamp: Date.now(),
        error: 'Invalid coordinates'
      };
    }
    
    const cacheKey = `${latNum.toFixed(4)}_${lngNum.toFixed(4)}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        activityLogService.logActivity('system', 'geocoding', 'reverse_geocode', {
          lat: latNum,
          lng: lngNum,
          cached: true
        });
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();

    try {
      const email = process.env.NOMINATIM_EMAIL || 'gps-tracking@example.com';
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latNum}&lon=${lngNum}&addressdetails=1&accept-language=tr&zoom=18&layer=address&email=${encodeURIComponent(email)}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'GPS-Tracking-App/1.0',
          'Accept': 'application/json',
          'Accept-Language': 'tr'
        },
        timeout: 5000
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('[GeocodingService] Rate limit hit, waiting longer...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          throw new Error('Rate limit exceeded, please wait');
        }
        throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format from Nominatim API');
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Nominatim API error: ${data.error.message || 'Unknown error'}`);
      }
      
      if (!data || !data.address) {
        throw new Error('No address data returned from Nominatim API');
      }
      
      let city = null;
      let province = null;
      let district = null;
      let fullAddress = null;

      const addr = data.address;
      
      city = addr.city || addr.town || addr.municipality || addr.village || addr.county || addr.city_district || null;
      province = addr.state || addr.province || addr.region || addr.state_district || null;
      district = addr.suburb || addr.neighbourhood || addr.quarter || addr.borough || null;
      
      const parts = [];
      if (addr.house_number) parts.push(addr.house_number);
      if (addr.road) parts.push(addr.road);
      if (district) parts.push(district);
      if (city) parts.push(city);
      if (province) parts.push(province);
      if (addr.postcode) parts.push(addr.postcode);
      if (addr.country) parts.push(addr.country);
      fullAddress = parts.length > 0 ? parts.join(', ') : (data.display_name || null);

      const result = {
        city: city || 'Bilinmeyen Şehir',
        province: province || 'Bilinmeyen İl',
        district: district || null,
        fullAddress: fullAddress || `${latNum.toFixed(6)}, ${lngNum.toFixed(6)}`,
        country: data.address?.country || 'Türkiye',
        timestamp: Date.now()
      };

      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      
      activityLogService.logActivity('system', 'geocoding', 'reverse_geocode', {
        lat: latNum,
        lng: lngNum,
        city: result.city,
        province: result.province,
        cached: false
      });
      
      if (this.cache.size > 10000) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      return result;
    } catch (error) {
      const logger = require('../core/utils/loggerHelper').getLogger('GeocodingService');
      logger.error('Reverse geocoding error', {
        error: error.message,
        lat: latNum,
        lng: lngNum,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
      
      return {
        city: 'Bilinmeyen Şehir',
        province: 'Bilinmeyen İl',
        district: null,
        fullAddress: `${latNum.toFixed(6)}, ${lngNum.toFixed(6)}`,
        country: 'Türkiye',
        timestamp: Date.now(),
        error: error.message,
        cached: false
      };
    }
  }

  async batchGeocode(locations) {
    const results = [];
    for (const loc of locations) {
      const lat = loc.latitude || loc.coords?.latitude || loc.lat;
      const lng = loc.longitude || loc.coords?.longitude || loc.lng;
      
      if (lat && lng) {
        const geocode = await this.getCityProvince(lat, lng);
        results.push({ ...loc, geocode });
        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      } else {
        results.push({ ...loc, geocode: null });
      }
    }
    return results;
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: 10000,
      ttl: this.cacheTTL
    };
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = new GeocodingService();
