# 🚀 Backend Deployment Guide

Professional deployment guide for BAVAXE GPS Tracking Backend API.

## 📋 Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Database initialized and accessible
- [ ] OneSignal API keys configured
- [ ] SMTP credentials configured
- [ ] SSL certificate configured (for production)
- [ ] Firewall rules configured
- [ ] Domain/DNS configured
- [ ] Backup strategy in place

## 🔧 Environment Setup

### 1. Copy Environment File

```bash
cp env.example .env
```

### 2. Required Environment Variables

#### Critical (Must Have)
```env
NODE_ENV=production
PORT=4000
JWT_SECRET=<generate-strong-secret>
ONESIGNAL_APP_ID=<your-onesignal-app-id>
ONESIGNAL_REST_API_KEY=<your-onesignal-rest-api-key>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=<your-email>
SMTP_PASS=<your-app-password>
SMTP_FROM=<your-email>
```

#### Security
```env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
ADMIN_RESET_TOKEN=<generate-strong-token>
```

#### Production URLs
```env
FRONTEND_URL=https://yourdomain.com
API_BASE_URL=https://api.yourdomain.com
IYZICO_CALLBACK_URL=https://api.yourdomain.com/api/payment/callback
IYZICO_WEBHOOK_URL=https://api.yourdomain.com/api/webhook/payment
```

### 3. Generate Secrets

```bash
# Generate JWT_SECRET (64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ADMIN_RESET_TOKEN (64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🐳 Docker Deployment

### Build Image
```bash
docker build -t bavaxe-backend:latest .
```

### Run Container
```bash
docker run -d \
  --name bavaxe-backend \
  -p 4000:4000 \
  --env-file .env \
  --restart unless-stopped \
  bavaxe-backend:latest
```

### Docker Compose
```yaml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "4000:4000"
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

## ☁️ Cloud Platform Deployment

### Railway
1. Connect your GitHub repository
2. Set environment variables in Railway dashboard
3. Railway will automatically build and deploy using `railway.json`

### Heroku
```bash
heroku create your-app-name
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=<your-secret>
# ... set all other env vars
git push heroku main
```

### DigitalOcean App Platform
1. Connect GitHub repository
2. Configure build settings:
   - Build Command: `npm ci --only=production`
   - Run Command: `node server.js`
3. Set environment variables
4. Deploy

### AWS EC2 / VPS
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone repository
git clone <your-repo>
cd backend

# Install dependencies
npm ci --only=production

# Use PM2 for process management
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## 🔒 Security Best Practices

### 1. SSL/TLS
- Always use HTTPS in production
- Configure reverse proxy (Nginx/Apache) with SSL
- Use Let's Encrypt for free SSL certificates

### 2. Firewall
```bash
# Allow only necessary ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 3. Reverse Proxy (Nginx)
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. Environment Variables
- Never commit `.env` file
- Use secure secret management (AWS Secrets Manager, HashiCorp Vault)
- Rotate secrets regularly

### 5. Rate Limiting
- Already configured in code
- Adjust `RATE_LIMIT_MAX_REQUESTS` based on your needs
- Monitor and adjust based on traffic

## 📊 Monitoring

### Health Checks
```bash
# Basic health check
curl http://localhost:4000/api/health

# System status (requires auth)
curl -H "Authorization: Bearer <token>" http://localhost:4000/api/system/status
```

### Logs
```bash
# PM2 logs
pm2 logs isci-takip-api

# Docker logs
docker logs bavaxe-backend

# Application logs
tail -f logs/api-combined.log
```

### Metrics
- Monitor `/api/metrics` endpoint
- Set up alerts for:
  - High error rates
  - Slow response times
  - Memory usage
  - CPU usage

## 🔄 Updates & Maintenance

### Update Application
```bash
git pull origin main
npm ci --only=production
pm2 restart isci-takip-api
```

### Database Backup
```bash
# Backup script runs automatically
# Manual backup:
node scripts/backup-database.js
```

### Rollback
```bash
git checkout <previous-commit>
npm ci --only=production
pm2 restart isci-takip-api
```

## 🐛 Troubleshooting

### Server Won't Start
1. Check environment variables: `node deploy-check.js`
2. Check logs: `pm2 logs` or `docker logs`
3. Verify port is not in use: `lsof -i :4000`
4. Check database connection

### High Memory Usage
- Adjust `max_memory_restart` in `ecosystem.config.js`
- Enable memory optimizer service
- Review caching strategies

### Slow Performance
- Check database indexes
- Review query optimization
- Enable response caching
- Scale horizontally if needed

## 📞 Support

For issues or questions:
- Check logs first
- Review error messages
- Check health endpoint
- Review this documentation

## ✅ Post-Deployment Verification

1. Health check: `curl https://api.yourdomain.com/api/health`
2. API docs: `https://api.yourdomain.com/api-docs`
3. Test authentication endpoints
4. Test real-time features (Socket.IO)
5. Monitor logs for errors
6. Check metrics endpoint

---

**Last Updated**: 2025-12-11
**Version**: 2.0.0

