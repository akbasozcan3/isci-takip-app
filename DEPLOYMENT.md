# Production Deployment Guide

## 🚀 Pre-Deployment Checklist

### Backend

- [ ] All environment variables configured in `.env`
- [ ] Database connection tested
- [ ] SMTP email service working
- [ ] OneSignal configured
- [ ] PM2 installed globally
- [ ] SSL certificate ready (for HTTPS)
- [ ] Domain/subdomain configured
- [ ] Firewall rules set

### Frontend

- [ ] API base URL updated for production
- [ ] Google OAuth client ID configured
- [ ] OneSignal App ID configured
- [ ] App icons and splash screen ready
- [ ] App store accounts created
- [ ] Privacy policy and terms ready

---

## 🖥️ Backend Deployment

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install PostgreSQL (if using)
sudo apt install -y postgresql postgresql-contrib
```

### Step 2: Deploy Backend

```bash
# Clone repository
git clone <your-repo-url>
cd my-app/backend

# Install dependencies
npm install --production

# Configure environment
cp .env.example .env
nano .env  # Edit with production values

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup  # Follow instructions
```

### Step 3: Configure Nginx (Reverse Proxy)

```nginx
server {
    listen 80;
    server_name api.bavaxe.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Step 4: SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d api.bavaxe.com

# Auto-renewal
sudo certbot renew --dry-run
```

---

## 📱 Mobile App Deployment

### Android (Google Play Store)

#### Step 1: Configure EAS

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure project
eas build:configure
```

#### Step 2: Update app.json

```json
{
  "expo": {
    "name": "BAVAXE",
    "slug": "bavaxe",
    "version": "1.0.0",
    "android": {
      "package": "com.bavaxe.app",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0f172a"
      },
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    }
  }
}
```

#### Step 3: Build AAB

```bash
# Build for Play Store
eas build --platform android --profile production

# Download and test APK first
eas build --platform android --profile preview
```

#### Step 4: Submit to Play Store

```bash
# Submit
eas submit --platform android

# Or manually upload AAB to Play Console
```

---

### iOS (App Store)

#### Step 1: Apple Developer Setup

1. Enroll in Apple Developer Program ($99/year)
2. Create App ID in Apple Developer Portal
3. Create provisioning profiles

#### Step 2: Build for iOS

```bash
# Build for App Store
eas build --platform ios --profile production
```

#### Step 3: Submit to App Store

```bash
# Submit
eas submit --platform ios

# Or use Xcode to upload
```

---

## 🔧 Environment Configuration

### Production .env (Backend)

```env
# Server
NODE_ENV=production
PORT=4000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/bavaxe_prod

# JWT
JWT_SECRET=<generate-strong-secret>
JWT_EXPIRES_IN=24h

# Google OAuth
GOOGLE_CLIENT_ID=<production-client-id>

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=<your-email>
SMTP_PASS=<app-password>
SMTP_FROM=noreply@bavaxe.com

# OneSignal
ONESIGNAL_APP_ID=<production-app-id>
ONESIGNAL_REST_API_KEY=<production-api-key>

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
ALLOWED_ORIGINS=https://bavaxe.com,https://www.bavaxe.com
```

### Production Environment (Frontend)

```env
EXPO_PUBLIC_API_BASE_URL=https://api.bavaxe.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID=<production-client-id>
EXPO_PUBLIC_ONESIGNAL_APP_ID=<production-app-id>
```

---

## 📊 Monitoring Setup

### PM2 Monitoring

```bash
# View logs
pm2 logs bavaxe-backend

# Monitor resources
pm2 monit

# Web dashboard
pm2 plus
```

### Database Backups

```bash
# PostgreSQL backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump bavaxe_prod > /backups/bavaxe_$DATE.sql
```

### Log Rotation

```bash
# Install logrotate
sudo apt install -y logrotate

# Configure in /etc/logrotate.d/bavaxe
/var/log/bavaxe/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
}
```

---

## 🔒 Security Hardening

### Firewall (UFW)

```bash
# Enable firewall
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow backend port (if needed)
sudo ufw allow 4000/tcp
```

### Fail2Ban

```bash
# Install
sudo apt install -y fail2ban

# Configure
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 🆘 Troubleshooting

### Backend Not Starting

```bash
# Check PM2 logs
pm2 logs bavaxe-backend --lines 100

# Check port availability
sudo netstat -tulpn | grep 4000

# Restart backend
pm2 restart bavaxe-backend
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql -U user -d bavaxe_prod -h localhost

# Check PostgreSQL status
sudo systemctl status postgresql
```

### Email Not Sending

```bash
# Test SMTP connection
telnet smtp.gmail.com 465

# Check logs
pm2 logs bavaxe-backend | grep Email
```

---

## 📈 Performance Optimization

### Backend

- Enable gzip compression
- Use CDN for static assets
- Implement Redis caching
- Database query optimization
- Connection pooling

### Frontend

- Image optimization
- Code splitting
- Lazy loading
- Bundle size reduction

---

## 🔄 Update Process

### Backend Updates

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Restart with PM2
pm2 restart bavaxe-backend
```

### App Updates

```bash
# Increment version in app.json
# Build new version
eas build --platform all --profile production

# Submit to stores
eas submit --platform all
```

---

## ✅ Post-Deployment Verification

- [ ] Backend API responding
- [ ] Database connected
- [ ] Email sending working
- [ ] Push notifications working
- [ ] SSL certificate valid
- [ ] Monitoring active
- [ ] Backups configured
- [ ] Mobile app installable
- [ ] All features working

---

**Deployment Date**: _____________  
**Deployed By**: _____________  
**Version**: 1.0.0
