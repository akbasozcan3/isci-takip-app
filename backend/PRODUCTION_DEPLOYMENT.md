# 🚀 Production Deployment Guide

## 📋 Pre-Deployment Checklist

### 1. Environment Variables
- [ ] Copy `.env.example` to `.env` and configure all variables
- [ ] Set `NODE_ENV=production`
- [ ] Configure `ALLOWED_ORIGINS` with production URLs
- [ ] Set strong `JWT_SECRET` (use crypto.randomBytes(32).toString('hex'))
- [ ] Configure SMTP credentials
- [ ] Set OneSignal API keys
- [ ] Configure Shopier payment gateway credentials
- [ ] Set production `API_BASE_URL` and `EXPO_PUBLIC_API_BASE_URL`

### 2. Security
- [ ] Enable HTTPS in production
- [ ] Set `ENABLE_HSTS=true` for HTTPS
- [ ] Configure firewall rules
- [ ] Set up rate limiting (already configured)
- [ ] Review CORS settings
- [ ] Secure database access
- [ ] Set up backup strategy

### 3. Performance
- [ ] Enable compression (already enabled)
- [ ] Configure caching (already enabled)
- [ ] Set up CDN for static assets
- [ ] Configure database indexes
- [ ] Set up monitoring and logging
- [ ] Configure auto-scaling if needed

### 4. Monitoring
- [ ] Set up error tracking (Sentry, LogRocket, etc.)
- [ ] Configure health check endpoints
- [ ] Set up uptime monitoring
- [ ] Configure log aggregation
- [ ] Set up performance monitoring

### 5. Database
- [ ] Backup existing data
- [ ] Test database migrations
- [ ] Configure database connection pooling
- [ ] Set up database replication (if needed)
- [ ] Configure automatic backups

## 🔧 Deployment Steps

### Option 1: PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start server.js --name bavaxe-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

### Option 2: Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 4000
CMD ["node", "server.js"]
```

### Option 3: Systemd Service

Create `/etc/systemd/system/bavaxe-backend.service`:

```ini
[Unit]
Description=Bavaxe Backend API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable bavaxe-backend
sudo systemctl start bavaxe-backend
```

## 📊 Health Check Endpoints

- `GET /api/health` - Basic health check
- `GET /api/system/status` - Detailed system status
- `GET /api/metrics` - Performance metrics

## 🔍 Monitoring Commands

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs bavaxe-backend

# Monitor resources
pm2 monit

# Restart application
pm2 restart bavaxe-backend
```

## 🛡️ Security Best Practices

1. **Never commit `.env` file** - Use environment variables or secrets management
2. **Use strong JWT secrets** - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. **Enable rate limiting** - Already configured per plan
4. **Use HTTPS** - Always in production
5. **Regular updates** - Keep dependencies updated
6. **Backup regularly** - Automated backups configured

## 📈 Performance Optimization

1. **Caching** - Response caching enabled
2. **Compression** - Gzip compression enabled
3. **Database optimization** - Indexes and query optimization
4. **Connection pooling** - Database connection pooling
5. **Load balancing** - Use nginx or similar for load balancing

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Find process using port 4000
   lsof -i :4000
   # Kill process
   kill -9 <PID>
   ```

2. **Database connection errors**
   - Check database file permissions
   - Verify database path in configuration

3. **Memory issues**
   - Monitor with: `pm2 monit`
   - Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096`

4. **WebSocket connection issues**
   - Check CORS configuration
   - Verify firewall rules
   - Check Socket.IO version compatibility

## 📝 Post-Deployment

1. Test all API endpoints
2. Verify WebSocket connections
3. Check email sending functionality
4. Test payment gateway integration
5. Monitor error logs
6. Set up alerts for critical errors
7. Document any custom configurations

## 🔄 Updates & Maintenance

1. **Regular backups** - Automated daily backups
2. **Log rotation** - Configure log rotation
3. **Dependency updates** - Regular security updates
4. **Performance monitoring** - Track metrics over time
5. **Security audits** - Regular security reviews

## 📞 Support

For issues or questions:
- Check logs: `pm2 logs bavaxe-backend`
- Review error logs in `/logs` directory
- Check system status: `GET /api/system/status`

