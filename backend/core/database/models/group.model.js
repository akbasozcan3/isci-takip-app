const db = require('../../../config/database');

class GroupModel {
  static create(groupData) {
    return db.createGroup(groupData);
  }

  static findById(id) {
    return db.getGroupById(id);
  }

  static findByCode(code) {
    return db.getGroupByCode(code);
  }

  static getByAdmin(userId) {
    return db.getGroupsByAdmin(userId);
  }

  static getUserGroups(userId) {
    return db.getUserGroups(userId);
  }

  static getMemberCount(groupId) {
    return db.getMemberCount(groupId);
  }

  static getMembers(groupId) {
    return db.getMembers(groupId);
  }

  static addMember(groupId, userId, role = 'member') {
    return db.addMember(groupId, userId, role);
  }

  static removeMember(groupId, userId) {
    return db.removeMember(groupId, userId);
  }

  static transferAdmin(groupId, currentAdminId, newAdminId) {
    return db.transferAdmin(groupId, currentAdminId, newAdminId);
  }

  static isLastAdmin(groupId, userId) {
    return db.isLastAdmin(groupId, userId);
  }

  static delete(groupId) {
    return db.deleteGroup(groupId);
  }

  static addJoinRequest(groupId, request) {
    return db.addJoinRequest(groupId, request);
  }

  static getRequests(groupId) {
    return db.getRequests(groupId);
  }

  static approveRequest(groupId, requestId) {
    return db.approveRequest(groupId, requestId);
  }

  static rejectRequest(groupId, requestId) {
    return db.rejectRequest(groupId, requestId);
  }
}

module.exports = GroupModel;

