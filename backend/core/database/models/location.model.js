const db = require('../../../config/database');

class LocationModel {
  static getStore(deviceId) {
    return db.getStore(deviceId);
  }

  static addToStore(deviceId, locationData) {
    return db.addToStore(deviceId, locationData);
  }

  static getAllDevices() {
    return Object.keys(db.data.store || {});
  }

  static deleteLocationData(deviceId) {
    if (db.data.store && db.data.store[deviceId]) {
      delete db.data.store[deviceId];
      db.scheduleSave();
      return true;
    }
    return false;
  }
}

module.exports = LocationModel;

