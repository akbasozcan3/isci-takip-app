// Demo groups storage
let groups = {}; // { groupId: { id, code, name, address, lat, lng, createdBy, createdAt, visibility } }
let groupMembers = {}; // { groupId: [ { userId, role, joinedAt } ] }
let groupRequests = {}; // { groupId: [ { id, userId, displayName, status, requestedAt } ] }

function generateGroupCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { groupId, code } = req.query;

  if (req.method === 'POST' && !groupId && !code) {
    // Create new group
    const { name, address, lat, lng, createdBy, visibility = 'private' } = req.body;
    
    if (!name || !createdBy) {
      return res.status(400).json({ error: 'Name and createdBy required' });
    }

    const id = generateId();
    const groupCode = generateGroupCode();
    
    const group = {
      id,
      code: groupCode,
      name,
      address: address || '',
      lat: lat || 0,
      lng: lng || 0,
      createdBy,
      createdAt: Date.now(),
      visibility,
      workRadius: 100 // meters
    };

    groups[id] = group;
    groupMembers[id] = [{ userId: createdBy, role: 'admin', joinedAt: Date.now() }];
    groupRequests[id] = [];

    res.json(group);

  } else if (req.method === 'GET' && code) {
    // Get group info by code
    const group = Object.values(groups).find(g => g.code === code);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const memberCount = (groupMembers[group.id] || []).length;
    res.json({
      id: group.id,
      code: group.code,
      name: group.name,
      address: group.address,
      memberCount,
      visibility: group.visibility
    });

  } else if (req.method === 'GET' && groupId) {
    // Get group members
    const members = groupMembers[groupId] || [];
    res.json(members);

  } else if (req.method === 'POST' && code) {
    // Join request
    const { userId, displayName } = req.body;
    const group = Object.values(groups).find(g => g.code === code);
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if already member
    const members = groupMembers[group.id] || [];
    if (members.some(m => m.userId === userId)) {
      return res.status(400).json({ error: 'Already a member' });
    }

    // Check if request already exists
    const requests = groupRequests[group.id] || [];
    if (requests.some(r => r.userId === userId && r.status === 'pending')) {
      return res.status(400).json({ error: 'Request already pending' });
    }

    const request = {
      id: generateId(),
      userId,
      displayName: displayName || userId,
      status: 'pending',
      requestedAt: Date.now()
    };

    if (!groupRequests[group.id]) groupRequests[group.id] = [];
    groupRequests[group.id].push(request);

    res.json(request);

  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
