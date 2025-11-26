// Location Tracking Controller
const db = require('../config/database');

const DEFAULT_ACTIVE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

class LocationController {
  // Store location data
  async storeLocation(req, res) {
    try {
      const { deviceId, coords, timestamp } = req.body || {};
      
      if (!deviceId || !coords) {
        return res.status(400).json({ error: 'Device ID and coordinates required' });
      }

      const locationData = {
        timestamp: timestamp || Date.now(),
        coords: {
          latitude: parseFloat(coords.latitude),
          longitude: parseFloat(coords.longitude),
          accuracy: coords.accuracy ? parseFloat(coords.accuracy) : null,
          heading: coords.heading ? parseFloat(coords.heading) : null,
          speed: coords.speed ? parseFloat(coords.speed) : null
        }
      };

      db.addToStore(deviceId, locationData);

      return res.json({ 
        success: true, 
        message: 'Location stored successfully',
        timestamp: locationData.timestamp
      });
    } catch (error) {
      console.error('Store location error:', error);
      return res.status(500).json({ error: 'Failed to store location' });
    }
  }

  // Get location history for a device
  async getLocationHistory(req, res) {
    try {
      const { deviceId } = req.params;
      const { limit = 100, offset = 0 } = req.query;
      
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const locations = db.getStore(deviceId);
      const total = locations.length;
      
      // Apply pagination
      const startIndex = parseInt(offset);
      const endIndex = startIndex + parseInt(limit);
      const paginatedLocations = locations.slice(startIndex, endIndex);

      return res.json({
        locations: paginatedLocations,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: endIndex < total
        }
      });
    } catch (error) {
      console.error('Get location history error:', error);
      return res.status(500).json({ error: 'Failed to get location history' });
    }
  }

  // Get recent locations (last N entries) for a device
  async getRecentLocations(req, res) {
    try {
      const { deviceId } = req.params;
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const limit = Math.max(1, Math.min(2000, parseInt(req.query.limit || '100', 10)));
      const locations = db.getStore(deviceId);
      if (!Array.isArray(locations) || locations.length === 0) {
        return res.json([]);
      }

      const startIndex = Math.max(0, locations.length - limit);
      const recent = locations.slice(startIndex);
      return res.json(recent);
    } catch (error) {
      console.error('Get recent locations error:', error);
      return res.status(500).json({ error: 'Failed to get recent locations' });
    }
  }

  // Get latest location for a device
  async getLatestLocation(req, res) {
    try {
      const { deviceId } = req.params;
      
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const locations = db.getStore(deviceId);
      if (locations.length === 0) {
        return res.status(404).json({ error: 'No location data found' });
      }

      const latestLocation = locations[locations.length - 1];
      return res.json(latestLocation);
    } catch (error) {
      console.error('Get latest location error:', error);
      return res.status(500).json({ error: 'Failed to get latest location' });
    }
  }

  // Get all devices with their latest locations
  async getAllDevices(req, res) {
    try {
      const devices = [];
      const store = db.data.store;
      
      for (const deviceId in store) {
        const locations = store[deviceId];
        if (locations.length > 0) {
          const latestLocation = locations[locations.length - 1];
          devices.push({
            deviceId,
            latestLocation,
            totalLocations: locations.length,
            lastUpdate: latestLocation.timestamp
          });
        }
      }

      return res.json({ devices });
    } catch (error) {
      console.error('Get all devices error:', error);
      return res.status(500).json({ error: 'Failed to get devices' });
    }
  }

  // Get latest snapshot for every device (used by mobile dashboards)
  async getLatestLocations(req, res) {
    try {
      const store = db.data.store || {};
      const items = Object.entries(store)
        .map(([workerId, locations]) => {
          if (!Array.isArray(locations) || locations.length === 0) {
            return null;
          }
          const last = locations[locations.length - 1];
          return { workerId, last };
        })
        .filter(Boolean);

      return res.json({
        count: items.length,
        items
      });
    } catch (error) {
      console.error('Get latest locations error:', error);
      return res.status(500).json({ error: 'Failed to get latest locations' });
    }
  }

  // Delete location data for a device
  async deleteLocationData(req, res) {
    try {
      const { deviceId } = req.params;
      
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      delete db.data.store[deviceId];
      db.scheduleSave();

      return res.json({ 
        success: true, 
        message: 'Location data deleted successfully' 
      });
    } catch (error) {
      console.error('Delete location data error:', error);
      return res.status(500).json({ error: 'Failed to delete location data' });
    }
  }

  // Active devices within time window (searchable)
  async getActiveDevices(req, res) {
    try {
      const sinceMsParam = parseInt(req.query.sinceMs || '', 10);
      const windowMs = Number.isFinite(sinceMsParam) && sinceMsParam > 0 ? sinceMsParam : DEFAULT_ACTIVE_WINDOW_MS;
      const cutoff = Date.now() - windowMs;
      const query = String(req.query.q || '').trim().toLowerCase();

      const items = [];
      const store = db.data.store || {};

      for (const [workerId, locations] of Object.entries(store)) {
        if (!Array.isArray(locations) || locations.length === 0) continue;
        const last = locations[locations.length - 1];
        if (!last || typeof last.timestamp !== 'number' || last.timestamp < cutoff) continue;

        const user = db.findUserById(workerId);
        const name = user?.displayName || user?.name || null;
        const phone = user?.phone || null;

        const matchesQuery =
          !query ||
          workerId.toLowerCase().includes(query) ||
          (name && name.toLowerCase().includes(query)) ||
          (phone && phone.toLowerCase().includes(query));

        if (!matchesQuery) continue;

        items.push({
          workerId,
          name,
          phone,
          lastSeen: last.timestamp,
          coords: {
            latitude: last.coords?.latitude ?? null,
            longitude: last.coords?.longitude ?? null,
            accuracy: last.coords?.accuracy ?? null,
            heading: last.coords?.heading ?? null,
            speed: last.coords?.speed ?? null,
          },
        });
      }

      return res.json({
        count: items.length,
        items,
      });
    } catch (error) {
      console.error('Get active devices error:', error);
      return res.status(500).json({ error: 'Failed to get active devices' });
    }
  }

  // Get location statistics
  async getLocationStats(req, res) {
    try {
      const { deviceId } = req.params;
      
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const locations = db.getStore(deviceId);
      
      if (locations.length === 0) {
        return res.json({
          deviceId,
          totalLocations: 0,
          firstLocation: null,
          lastLocation: null,
          timeSpan: 0
        });
      }

      const firstLocation = locations[0];
      const lastLocation = locations[locations.length - 1];
      const timeSpan = lastLocation.timestamp - firstLocation.timestamp;

      return res.json({
        deviceId,
        totalLocations: locations.length,
        firstLocation,
        lastLocation,
        timeSpan,
        averageAccuracy: locations.reduce((sum, loc) => 
          sum + (loc.coords.accuracy || 0), 0) / locations.length
      });
    } catch (error) {
      console.error('Get location stats error:', error);
      return res.status(500).json({ error: 'Failed to get location statistics' });
    }
  }
}

module.exports = new LocationController();
