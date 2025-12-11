# 🚀 Production Quick Start Guide

Quick deployment guide for BAVAXE Backend API.

## ⚡ Quick Deploy (5 minutes)

### 1. Environment Setup
```bash
# Copy environment template
cp env.example .env

# Edit .env with your values
nano .env  # or use your preferred editor
```

### 2. Required Variables (Minimum)
```env
NODE_ENV=production
JWT_SECRET=<generate-strong-secret>
ONESIGNAL_APP_ID=<your-app-id>
ONESIGNAL_REST_API_KEY=<your-api-key>
ALLOWED_ORIGINS=https://yourdomain.com
```

### 3. Generate Secrets
```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ADMIN_RESET_TOKEN
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Deploy

#### Option A: PM2 (Recommended)
```bash
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

#### Option B: Docker
```bash
docker build -t bavaxe-backend .
docker run -d --name bavaxe-backend -p 4000:4000 --env-file .env bavaxe-backend
```

#### Option C: Direct
```bash
npm ci --only=production
NODE_ENV=production node server.js
```

### 5. Verify
```bash
curl http://localhost:4000/api/health
```

## 🔒 Security Checklist

- [ ] `JWT_SECRET` is at least 32 characters
- [ ] `ALLOWED_ORIGINS` is set (not `*`)
- [ ] `NODE_ENV=production` is set
- [ ] SSL/TLS is configured (HTTPS)
- [ ] Firewall rules are configured
- [ ] `.env` file is not committed to git
- [ ] Database is secured
- [ ] Rate limiting is enabled (default: enabled)

## 📊 Monitoring

### Health Check
```bash
curl https://api.yourdomain.com/api/health
```

### System Status
```bash
curl -H "Authorization: Bearer <token>" \
  https://api.yourdomain.com/api/system/status
```

### Logs
```bash
# PM2
pm2 logs isci-takip-api

# Docker
docker logs bavaxe-backend

# Direct
tail -f logs/api-combined.log
```

## 🔄 Updates

```bash
git pull
npm ci --only=production
pm2 restart isci-takip-api
```

## 🆘 Troubleshooting

### Server won't start
1. Check environment: `node deploy-check.js`
2. Check logs: `pm2 logs` or `docker logs`
3. Verify port: `lsof -i :4000`

### High memory
- Adjust `max_memory_restart` in `ecosystem.config.js`
- Enable memory optimizer

### Slow performance
- Check database indexes
- Enable caching
- Scale horizontally

## 📚 Full Documentation

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment guide.

---

**Version**: 2.0.0  
**Last Updated**: 2025-12-11

