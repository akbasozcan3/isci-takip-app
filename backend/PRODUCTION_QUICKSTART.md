# ============================================
# PRODUCTION DEPLOYMENT QUICK START
# ============================================

## Prerequisites
- Node.js 18+ installed
- PM2 installed globally: `npm install -g pm2`
- PostgreSQL installed and running
- Domain configured with DNS pointing to server
- SSL certificate ready (Let's Encrypt recommended)

## Step 1: Environment Setup (5 minutes)

```bash
# Copy environment template
cp .env.example .env

# Edit with your production values
nano .env

# Required values to change:
# - JWT_SECRET (generate with: openssl rand -base64 64)
# - DATABASE_URL
# - SHOPIER_* (all Shopier credentials)
# - ONESIGNAL_* (production keys)
# - SMTP_* (email configuration)
# - GOOGLE_CLIENT_ID
# - ALLOWED_ORIGINS
```

## Step 2: Install Dependencies (2 minutes)

```bash
npm install --production
```

## Step 3: Database Setup (5 minutes)

```bash
# Create PostgreSQL database
sudo -u postgres psql
CREATE DATABASE bavaxe_prod;
CREATE USER bavaxe_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE bavaxe_prod TO bavaxe_user;
\\q

# Update DATABASE_URL in .env
DATABASE_URL=postgresql://bavaxe_user:your_password@localhost:5432/bavaxe_prod
```

## Step 4: Start with PM2 (1 minute)

```bash
# Start in production mode
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the command it outputs
```

## Step 5: Configure Nginx (10 minutes)

```bash
# Install Nginx
sudo apt install nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/bavaxe-api

# Paste this configuration:
```

```nginx
server {
    listen 80;
    server_name api.bavaxe.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.bavaxe.com;
    
    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.bavaxe.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.bavaxe.com/privkey.pem;
    
    # SSL Security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Proxy to Node.js backend
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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # WebSocket support for Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/bavaxe-api /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## Step 6: SSL Certificate (5 minutes)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d api.bavaxe.com

# Test auto-renewal
sudo certbot renew --dry-run
```

## Step 7: Firewall Configuration (2 minutes)

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

## Step 8: Verify Deployment (5 minutes)

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs bavaxe-backend --lines 50

# Test API
curl https://api.bavaxe.com/api/health

# Test WebSocket
# Use a WebSocket client to connect to wss://api.bavaxe.com
```

## Monitoring Commands

```bash
# View real-time logs
pm2 logs bavaxe-backend

# Monitor resources
pm2 monit

# Restart application
pm2 restart bavaxe-backend

# Reload with zero downtime
pm2 reload bavaxe-backend

# Stop application
pm2 stop bavaxe-backend

# Delete from PM2
pm2 delete bavaxe-backend
```

## Backup & Maintenance

```bash
# Database backup (daily cron job)
0 2 * * * /usr/bin/pg_dump bavaxe_prod > /backups/bavaxe_$(date +\%Y\%m\%d).sql

# Keep last 30 days of backups
find /backups -name "bavaxe_*.sql" -mtime +30 -delete

# PM2 log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## Troubleshooting

### Application won't start
```bash
pm2 logs bavaxe-backend --err --lines 100
```

### Database connection issues
```bash
# Test PostgreSQL
psql -U bavaxe_user -d bavaxe_prod -h localhost

# Check PostgreSQL status
sudo systemctl status postgresql
```

### SSL certificate issues
```bash
# Renew certificate manually
sudo certbot renew

# Check certificate expiry
sudo certbot certificates
```

### High memory usage
```bash
# Check PM2 memory
pm2 list

# Restart if needed
pm2 restart bavaxe-backend
```

## Production Checklist

- [x] Helmet.js security enabled
- [x] .env file configured
- [x] PM2 ecosystem.config.js created
- [ ] PostgreSQL database created
- [ ] Environment variables set
- [ ] PM2 started and saved
- [ ] Nginx configured
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] DNS configured
- [ ] Backups configured
- [ ] Monitoring active

## Total Time: ~35 minutes

Your application is now production-ready! 🚀
