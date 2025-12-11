// Database Configuration
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data.json');

class Database {
  constructor() {
    this.data = this.loadData();
    this.saveTimeout = null;
    this.saving = false;
    this.saveQueue = [];
  }

  getDefaultData() {
    return {
      users: {},
      tokens: {},
      emailPasswords: {},
      emailVerifications: {},
      emailResets: {},
      passwordResetTokens: {},
      resendMeta: {},
      store: {},
      articles: {},
      notifications: {},
      billingEvents: {},
      receipts: {},
      groups: {},
      groupMembers: {},
      groupRequests: {},
      locationShares: {},
      liveLocations: {},
      familyMembers: {},
      deliveries: {},
      routes: {},
      pageShares: {},
      steps: {},
      activities: []
    };
  }

  loadData() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const stats = fs.statSync(DATA_FILE);
        if (stats.size > 100 * 1024 * 1024) {
          console.warn(`[DB] Large database file detected: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
        }
        
        if (stats.size === 0) {
          console.warn('[DB] Database file is empty, using default data');
          return this.getDefaultData();
        }
        
        const content = fs.readFileSync(DATA_FILE, 'utf8');
        if (!content || content.trim().length === 0) {
          console.warn('[DB] Database file content is empty, using default data');
          return this.getDefaultData();
        }
        
        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch (parseError) {
          console.error('[DB] JSON parse error:', parseError.message);
          if (fs.existsSync(DATA_FILE + '.backup')) {
            console.log('[DB] Attempting to load from backup...');
            try {
              const backupContent = fs.readFileSync(DATA_FILE + '.backup', 'utf8');
              parsed = JSON.parse(backupContent);
              console.log('[DB] Successfully loaded from backup');
            } catch (backupError) {
              console.error('[DB] Backup load also failed:', backupError.message);
              return this.getDefaultData();
            }
          } else {
            return this.getDefaultData();
          }
        }
        
        if (!parsed || typeof parsed !== 'object') {
          console.warn('[DB] Invalid database structure, using default data');
          return this.getDefaultData();
        }
        
        const defaultData = this.getDefaultData();
        
        const requiredFields = [
          'billingEvents', 'receipts', 'notifications', 'groups', 
          'groupMembers', 'groupRequests', 'articles', 'store',
          'emailVerifications', 'emailResets', 'passwordResetTokens',
          'resendMeta', 'locationShares', 'liveLocations',
          'familyMembers', 'deliveries', 'routes', 'pageShares', 'steps'
        ];
        
        for (const field of requiredFields) {
          if (!parsed[field] || typeof parsed[field] !== 'object') {
            parsed[field] = {};
          }
        }
        
        return { ...defaultData, ...parsed };
      }
    } catch (error) {
      console.error('[DB] Error loading database:', error.message);
      if (fs.existsSync(DATA_FILE + '.backup')) {
        console.log('[DB] Attempting to load from backup...');
        try {
          const backupContent = fs.readFileSync(DATA_FILE + '.backup', 'utf8');
          const parsed = JSON.parse(backupContent);
          console.log('[DB] Successfully loaded from backup');
          return { ...this.getDefaultData(), ...parsed };
        } catch (backupError) {
          console.error('[DB] Backup load also failed:', backupError.message);
        }
      }
    }
    
    console.log('[DB] Using default database structure');
    return this.getDefaultData();
  }

  async save() {
    if (this.saving) {
      return new Promise((resolve) => {
        this.saveQueue.push(resolve);
      });
    }
    
    this.saving = true;
    const tempFile = DATA_FILE + '.tmp';
    const backupFile = DATA_FILE + '.backup';
    
    try {
      const dataToSave = JSON.stringify(this.data, null, 2);
      if (!dataToSave || dataToSave.length === 0) {
        throw new Error('Cannot save empty database');
      }
      
      if (fs.existsSync(DATA_FILE)) {
        try {
          await fsPromises.copyFile(DATA_FILE, backupFile);
        } catch (err) {
          console.warn('[DB] Could not create backup:', err.message);
        }
      }
      
      await fsPromises.writeFile(tempFile, dataToSave, 'utf8');
      await fsPromises.rename(tempFile, DATA_FILE);
      
      if (process.env.NODE_ENV === 'production') {
        const stats = await fsPromises.stat(DATA_FILE);
        console.log(`[DB] Saved at ${new Date().toISOString()} (${(stats.size / 1024).toFixed(2)}KB)`);
      }
      
      this.saving = false;
      
      while (this.saveQueue.length > 0) {
        const resolve = this.saveQueue.shift();
        if (resolve) resolve();
      }
      
      return Promise.resolve();
    } catch (error) {
      this.saving = false;
      console.error('[DB] Error saving database:', error);
      try {
        if (fs.existsSync(tempFile)) {
          await fsPromises.unlink(tempFile);
        }
      } catch (unlinkErr) {
        console.error('[DB] Error removing temp file:', unlinkErr);
      }
      
      while (this.saveQueue.length > 0) {
        const resolve = this.saveQueue.shift();
        if (resolve) resolve();
      }
      
      throw error;
    }
  }

  scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.save().catch(err => {
        console.error('[DB] Scheduled save error:', err);
      });
    }, 1000);
  }

  // User operations
  createUser(userData) {
    const id = this.generateId();
    const user = {
      id,
      ...userData,
      createdAt: Date.now(),
      email_verified: '0', // Email verification required - starts as unverified
      phone_verified: '1',
      onesignalPlayerId: userData.onesignalPlayerId || null,
      subscription: this.getDefaultSubscription()
    };
    this.data.users[id] = user;
    this.scheduleSave();
    return user;
  }

  updateUserOnesignalPlayerId(userId, playerId) {
    const user = this.findUserById(userId);
    if (user) {
      user.onesignalPlayerId = playerId;
      if (user.updatedAt !== undefined) {
        user.updatedAt = new Date().toISOString();
      }
      this.scheduleSave();
      return user;
    }
    return null;
  }

  getUserOnesignalPlayerId(userId) {
    const user = this.findUserById(userId);
    return user?.onesignalPlayerId || null;
  }

  getDefaultSubscription() {
    return {
      planId: 'free',
      planName: 'Free',
      price: 0,
      currency: 'USD',
      interval: 'monthly',
      status: 'active',
      renewsAt: null,
      updatedAt: Date.now()
    };
  }
  
  // Mark email as verified
  verifyUserEmail(email) {
    const user = this.findUserByEmail(email);
    if (user) {
      user.email_verified = '1';
      this.scheduleSave();
      return true;
    }
    return false;
  }
  
  // Check if email is verified
  isEmailVerified(email) {
    const user = this.findUserByEmail(email);
    return user && user.email_verified === '1';
  }

  findUserByEmail(email) {
    return Object.values(this.data.users).find(u => 
      String(u.email).toLowerCase() === String(email).toLowerCase()
    );
  }

  findUserByUsername(username) {
    const norm = String(username).toLowerCase();
    return Object.values(this.data.users).find(u => 
      String(u.username || '').toLowerCase() === norm
    );
  }

  findUserById(id) {
    return this.data.users[id];
  }

  // Password operations
  setPassword(email, hash) {
    this.data.emailPasswords[email] = hash;
    this.scheduleSave();
  }

  getPassword(email) {
    return this.data.emailPasswords[email];
  }

  // Token operations
  setToken(token, data) {
    this.data.tokens[token] = data;
    this.scheduleSave();
  }

  getToken(token) {
    return this.data.tokens[token];
  }

  removeToken(token) {
    delete this.data.tokens[token];
    this.scheduleSave();
  }

  // Delete user by ID (and cleanup related records)
  deleteUser(userId) {
    const user = this.data.users[userId];
    if (!user) return false;
    
    const email = user.email;
    
    // remove user
    delete this.data.users[userId];
    
    // remove password
    if (this.data.emailPasswords && this.data.emailPasswords[email]) {
      delete this.data.emailPasswords[email];
    }
    
    // remove verifications
    if (this.data.emailVerifications && this.data.emailVerifications[email]) {
      delete this.data.emailVerifications[email];
    }
    
    // remove resend meta
    if (this.data.resendMeta && this.data.resendMeta[email]) {
      delete this.data.resendMeta[email];
    }
    
    // remove tokens belonging to the user
    for (const [token, info] of Object.entries(this.data.tokens || {})) {
      if (info && info.userId === userId) {
        delete this.data.tokens[token];
      }
    }
    
    this.scheduleSave();
    return true;
  }

  // Delete user by email (and cleanup related records)
  deleteUserByEmail(email) {
    const user = this.findUserByEmail(email);
    if (!user) return false;
    return this.deleteUser(user.id);
  }

  // Delete password
  deletePassword(email) {
    if (this.data.emailPasswords && this.data.emailPasswords[email]) {
      delete this.data.emailPasswords[email];
      this.scheduleSave();
      return true;
    }
    return false;
  }

  // Delete email verifications
  deleteEmailVerifications(email) {
    if (this.data.emailVerifications && this.data.emailVerifications[email]) {
      delete this.data.emailVerifications[email];
      this.scheduleSave();
      return true;
    }
    return false;
  }

  // Email verification operations
  addEmailVerification(email, verification) {
    if (!this.data.emailVerifications[email]) {
      this.data.emailVerifications[email] = [];
    }
    this.data.emailVerifications[email].push(verification);
    this.scheduleSave();
  }

  getEmailVerifications(email) {
    return this.data.emailVerifications[email] || [];
  }

  // Password reset operations
  addPasswordReset(email, reset) {
    // Ensure emailResets exists (for backward compatibility with old data.json)
    if (!this.data.emailResets) {
      this.data.emailResets = {};
    }
    if (!this.data.emailResets[email]) {
      this.data.emailResets[email] = [];
    }
    this.data.emailResets[email].push(reset);
    this.scheduleSave();
  }

  getPasswordResets(email) {
    // Ensure emailResets exists (for backward compatibility)
    if (!this.data.emailResets) {
      this.data.emailResets = {};
    }
    return this.data.emailResets[email] || [];
  }

  deletePasswordResets(email) {
    if (this.data.emailResets && this.data.emailResets[email]) {
      delete this.data.emailResets[email];
      this.scheduleSave();
      return true;
    }
    return false;
  }

  // Token-based password reset operations
  addPasswordResetToken(token, data) {
    if (!this.data.passwordResetTokens) {
      this.data.passwordResetTokens = {};
    }
    this.data.passwordResetTokens[token] = {
      ...data,
      createdAt: Date.now()
    };
    this.scheduleSave();
  }

  getPasswordResetToken(token) {
    if (!this.data.passwordResetTokens) {
      return null;
    }
    return this.data.passwordResetTokens[token] || null;
  }

  deletePasswordResetToken(token) {
    if (this.data.passwordResetTokens && this.data.passwordResetTokens[token]) {
      delete this.data.passwordResetTokens[token];
      this.scheduleSave();
      return true;
    }
    return false;
  }

  // Resend meta operations
  getResendMeta(email) {
    return this.data.resendMeta[email];
  }

  setResendMeta(email, meta) {
    this.data.resendMeta[email] = meta;
    this.scheduleSave();
  }

  // Store operations (for location tracking)
  getStore(deviceId) {
    try {
      if (!deviceId || typeof deviceId !== 'string') {
        console.warn('[DB] Invalid deviceId in getStore:', deviceId);
        return [];
      }
      
      if (!this.data.store) {
        this.data.store = {};
      }
      
      const store = this.data.store[deviceId];
      if (!Array.isArray(store)) {
        return [];
      }
      
      return store;
    } catch (error) {
      console.error('[DB] Error in getStore:', error);
      return [];
    }
  }

  addToStore(deviceId, locationData) {
    try {
      if (!deviceId || typeof deviceId !== 'string') {
        throw new Error('Invalid deviceId');
      }
      
      if (!locationData || typeof locationData !== 'object') {
        throw new Error('Invalid locationData');
      }
      
      if (!this.data.store) {
        this.data.store = {};
      }
      
      if (!this.data.store[deviceId]) {
        this.data.store[deviceId] = [];
      }
      
      if (!Array.isArray(this.data.store[deviceId])) {
        this.data.store[deviceId] = [];
      }
      
      const validatedLocation = {
        timestamp: locationData.timestamp || Date.now(),
        coords: {
          latitude: typeof locationData.coords?.latitude === 'number' ? locationData.coords.latitude : null,
          longitude: typeof locationData.coords?.longitude === 'number' ? locationData.coords.longitude : null,
          accuracy: typeof locationData.coords?.accuracy === 'number' ? locationData.coords.accuracy : null,
          heading: typeof locationData.coords?.heading === 'number' ? locationData.coords.heading : null,
          speed: typeof locationData.coords?.speed === 'number' ? locationData.coords.speed : null
        },
        metadata: locationData.metadata || {},
        geocode: locationData.geocode || null,
        ip: locationData.ip || null,
        userAgent: locationData.userAgent || null
      };
      
      this.data.store[deviceId].push(validatedLocation);
      this.scheduleSave();
    } catch (error) {
      console.error('[DB] Error in addToStore:', error, { deviceId });
      throw error;
    }
  }

  resetAllData() {
    this.data = this.getDefaultData();
    this.save();
    return this.data;
  }

  // Utility functions
  generateId() {
    return Math.random().toString(36).substring(2, 15);
  }

  generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  getDayKey() {
    return new Date().toISOString().split('T')[0];
  }

  // Notifications
  getNotifications(userId) {
    if (!this.data.notifications) {
      this.data.notifications = {};
    }
    const items = (this.data.notifications[userId] || []).slice().sort((a, b) => b.timestamp - a.timestamp);
    return items;
  }
  addNotification(userId, notif) {
    if (!this.data.notifications) {
      this.data.notifications = {};
    }
    if (!this.data.notifications[userId]) {
      this.data.notifications[userId] = [];
    }
    const item = { id: this.generateId(), read: false, timestamp: Date.now(), ...notif };
    this.data.notifications[userId].push(item);
    this.scheduleSave();
    return item;
  }
  markAllNotificationsRead(userId) {
    if (!this.data.notifications) {
      this.data.notifications = {};
    }
    const items = this.data.notifications[userId] || [];
    for (const it of items) it.read = true;
    this.scheduleSave();
  }
  markNotificationRead(userId, id) {
    if (!this.data.notifications) {
      this.data.notifications = {};
    }
    const items = this.data.notifications[userId] || [];
    const it = items.find(n => n.id === id);
    if (it) { it.read = true; this.scheduleSave(); }
  }

  ensureSubscription(user) {
    if (!user.subscription) {
      user.subscription = this.getDefaultSubscription();
    }
    return user.subscription;
  }

  getUserSubscription(userId) {
    const user = this.findUserById(userId);
    if (!user) return null;
    return this.ensureSubscription(user);
  }

  setUserSubscription(userId, updates) {
    const user = this.findUserById(userId);
    if (!user) return null;
    const current = this.ensureSubscription(user);
    user.subscription = {
      ...current,
      ...updates,
      updatedAt: Date.now()
    };
    this.scheduleSave();
    return user.subscription;
  }

  addBillingEvent(userId, event) {
    if (!this.data.billingEvents) {
      this.data.billingEvents = {};
    }
    if (!this.data.billingEvents[userId]) {
      this.data.billingEvents[userId] = [];
    }
    const entry = {
      id: this.generateId(),
      timestamp: Date.now(),
      ...event
    };
    this.data.billingEvents[userId].push(entry);
    this.scheduleSave();
    return entry;
  }

  getBillingHistory(userId) {
    if (!this.data.billingEvents) {
      this.data.billingEvents = {};
    }
    const history = this.data.billingEvents[userId] || [];
    return history.slice().sort((a, b) => b.timestamp - a.timestamp);
  }

  // Article operations
  getAllArticles() {
    if (!this.data.articles) {
      this.data.articles = {};
    }
    if (!this.data.articleViews) {
      this.data.articleViews = {};
    }
    return Object.values(this.data.articles).map(article => ({
      ...article,
      views: this.data.articleViews[article.id] || 0,
      viewCount: this.data.articleViews[article.id] || 0
    })).sort((a, b) => {
      const dateA = new Date(a.createdAt || a.updatedAt).getTime();
      const dateB = new Date(b.createdAt || b.updatedAt).getTime();
      return dateB - dateA;
    });
  }

  getArticleById(id) {
    if (!this.data.articles) {
      this.data.articles = {};
    }
    return this.data.articles[id];
  }

  createArticle(articleData) {
    if (!this.data.articles) {
      this.data.articles = {};
    }
    if (!this.data.articleViews) {
      this.data.articleViews = {};
    }
    const id = this.generateId();
    const article = {
      id,
      ...articleData,
      views: 0,
      viewCount: 0,
      seoTitle: articleData.seoTitle || articleData.title,
      seoDescription: articleData.seoDescription || articleData.excerpt,
      seoKeywords: articleData.seoKeywords || (articleData.tags || []).join(', '),
      slug: articleData.slug || this.generateSlug(articleData.title),
      status: articleData.status || 'published',
      featured: articleData.featured || false,
      createdAt: articleData.createdAt || new Date().toISOString(),
      updatedAt: articleData.updatedAt || new Date().toISOString()
    };
    this.data.articles[id] = article;
    this.data.articleViews[id] = 0;
    this.scheduleSave();
    return article;
  }

  generateSlug(title) {
    return String(title || '')
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  incrementArticleView(id) {
    if (!this.data.articles || !this.data.articles[id]) {
      return false;
    }
    if (!this.data.articleViews) {
      this.data.articleViews = {};
    }
    this.data.articleViews[id] = (this.data.articleViews[id] || 0) + 1;
    this.data.articles[id].views = this.data.articleViews[id];
    this.data.articles[id].viewCount = this.data.articleViews[id];
    this.scheduleSave();
    return true;
  }

  getArticleViews(id) {
    if (!this.data.articleViews) {
      return 0;
    }
    return this.data.articleViews[id] || 0;
  }

  updateArticle(id, updates) {
    if (!this.data.articles || !this.data.articles[id]) {
      return null;
    }
    this.data.articles[id] = {
      ...this.data.articles[id],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.scheduleSave();
    return this.data.articles[id];
  }

  deleteArticle(id) {
    if (!this.data.articles) {
      return false;
    }
    if (this.data.articles[id]) {
      delete this.data.articles[id];
      this.scheduleSave();
      return true;
    }
    return false;
  }

  // ------------------- GROUPS -------------------
  createGroup(groupData) {
    if (!this.data.groups) this.data.groups = {};
    if (!this.data.groupMembers) this.data.groupMembers = {};
    const id = this.generateId();
    const code = (groupData.code || Math.random().toString(36).substring(2, 8)).toUpperCase();
    const group = {
      id,
      code,
      name: groupData.name,
      address: groupData.address || '',
      lat: groupData.lat ?? null,
      lng: groupData.lng ?? null,
      createdBy: groupData.createdBy || null,
      visibility: groupData.visibility || 'private',
      createdAt: Date.now()
    };
    this.data.groups[id] = group;
    this.data.groupMembers[id] = this.data.groupMembers[id] || {};
    if (group.createdBy) {
      this.data.groupMembers[id][group.createdBy] = 'admin';
    }
    this.scheduleSave();
    return group;
  }

  getGroupById(id) {
    try {
      if (!id || typeof id !== 'string') {
        return null;
      }
      
      if (!this.data.groups) {
        this.data.groups = {};
      }
      
      return this.data.groups[id] || null;
    } catch (error) {
      console.error('[DB] Error in getGroupById:', error);
      return null;
    }
  }

  getGroupByCode(code) {
    const norm = String(code).toUpperCase();
    return Object.values(this.data.groups || {}).find(g => String(g.code).toUpperCase() === norm) || null;
  }

  getGroupsByAdmin(userId) {
    const result = [];
    for (const [groupId, members] of Object.entries(this.data.groupMembers || {})) {
      if (members && members[userId] === 'admin') {
        const g = this.getGroupById(groupId);
        if (g) result.push({ ...g, memberCount: this.getMemberCount(groupId) });
      }
    }
    return result;
  }

  getMemberCount(groupId) {
    const members = (this.data.groupMembers || {})[groupId] || {};
    return Object.keys(members).length;
  }

  addMember(groupId, userId, role = 'member') {
    if (!this.data.groupMembers[groupId]) this.data.groupMembers[groupId] = {};
    this.data.groupMembers[groupId][userId] = role;
    this.scheduleSave();
  }

  getMembers(groupId) {
    try {
      if (!groupId || typeof groupId !== 'string') {
        return [];
      }
      
      if (!this.data.groupMembers) {
        this.data.groupMembers = {};
      }
      
      const members = this.data.groupMembers[groupId];
      if (!members || typeof members !== 'object') {
        return [];
      }
      
      return Object.entries(members).map(([userId, role]) => ({ userId, role }));
    } catch (error) {
      console.error('[DB] Error in getMembers:', error);
      return [];
    }
  }

  removeMember(groupId, userId) {
    const members = (this.data.groupMembers || {})[groupId];
    if (!members || !members[userId]) return false;
    delete members[userId];
    this.scheduleSave();
    return true;
  }

  getUserGroups(userId) {
    const result = [];
    for (const [groupId, members] of Object.entries(this.data.groupMembers || {})) {
      if (members && members[userId]) {
        const g = this.getGroupById(groupId);
        if (g) result.push({ ...g, isAdmin: members[userId] === 'admin', memberCount: this.getMemberCount(groupId) });
      }
    }
    return result;
  }

  transferAdmin(groupId, currentAdminId, newAdminId) {
    const members = (this.data.groupMembers || {})[groupId] || {};
    if (members[currentAdminId] !== 'admin' || !members[newAdminId]) return false;
    members[currentAdminId] = 'member';
    members[newAdminId] = 'admin';
    this.scheduleSave();
    return true;
  }

  isLastAdmin(groupId, userId) {
    const members = (this.data.groupMembers || {})[groupId] || {};
    const admins = Object.entries(members).filter(([, role]) => role === 'admin').map(([id]) => id);
    return admins.length === 1 && admins[0] === userId;
  }

  deleteGroup(groupId) {
    if (!this.data.groups[groupId]) return false;
    delete this.data.groups[groupId];
    if (this.data.groupMembers[groupId]) delete this.data.groupMembers[groupId];
    if (this.data.groupRequests[groupId]) delete this.data.groupRequests[groupId];
    this.scheduleSave();
    return true;
  }

  // -------- Requests --------
  addJoinRequest(groupId, request) {
    if (!this.data.groupRequests[groupId]) this.data.groupRequests[groupId] = {};
    const id = this.generateId();
    const req = { id, status: 'pending', requestedAt: Date.now(), ...request };
    this.data.groupRequests[groupId][id] = req;
    this.scheduleSave();
    return req;
  }

  getRequests(groupId) {
    const reqs = Object.values((this.data.groupRequests[groupId] || {}));
    return reqs.filter(r => r.status === 'pending').sort((a, b) => b.requestedAt - a.requestedAt);
  }

  approveRequest(groupId, requestId) {
    const reqs = this.data.groupRequests[groupId] || {};
    const req = reqs[requestId];
    if (!req) return null;
    req.status = 'approved';
    this.addMember(groupId, req.userId, 'member');
    this.scheduleSave();
    return req;
  }

  rejectRequest(groupId, requestId) {
    const reqs = this.data.groupRequests[groupId] || {};
    const req = reqs[requestId];
    if (!req) return null;
    req.status = 'rejected';
    this.scheduleSave();
    return req;
  }
}

module.exports = new Database();
