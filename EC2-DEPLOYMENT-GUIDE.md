# 🚀 Production Deployment Guide

## Tuition Marketplace - Production Domain + Local MongoDB

**Production Domain:** https://hometuitionapp.com  
**Database:** mongodb://127.0.0.1:27017/tuitionAppDB

---

## 📋 Pre-Deployment Checklist

### 1. EC2 Instance Setup
```bash
# Connect to server (update with your actual server IP)
ssh -i your-key.pem ubuntu@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # v18.x.x
npm --version   # 9.x.x
```

### 2. Install MongoDB Locally
```bash
# Import MongoDB public key
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Create list file
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Update and install
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify
sudo systemctl status mongod
mongo --eval "db.adminCommand('ping')"
```

### 3. Install PM2 and Nginx
```bash
# PM2
sudo npm install -g pm2

# Nginx
sudo apt install -y nginx
sudo systemctl enable nginx
```

---

## 📦 Application Deployment

### 1. Upload Application Files
```bash
# From your local machine, upload the backend:
scp -i your-key.pem -r ./backend/* ubuntu@13.126.87.149:/var/www/tuition-app/

# Or use git clone on EC2:
git clone https://github.com/yourrepo/tuition-app.git /var/www/tuition-app
```

### 2. Setup Environment File
```bash
cd /var/www/tuition-app
sudo nano .env
```

Paste this production configuration:
```env
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

# Local MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/tuitionAppDB

# JWT (generate strong secret)
JWT_SECRET=your-32-char-minimum-secret-key-here-change-in-production

# CORS Origins
ALLOWED_ORIGINS=https://hometuitionapp.com,https://www.hometuitionapp.com,http://localhost:3000,http://localhost:19006
FRONTEND_URL=https://hometuitionapp.com

# Security
TRUST_PROXY=true

# File Uploads
UPLOAD_DIR=./uploads
UPLOAD_MAX_SIZE=52428800

# Logging
LOG_LEVEL=info
```

### 3. Install Dependencies and Start
```bash
cd /var/www/tuition-app

# Install dependencies
npm ci --production

# Create required directories
mkdir -p uploads logs

# Use production server file
cp server-production.js server.js

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 config
pm2 save

# Setup PM2 startup script
pm2 startup systemd
# Run the command output by PM2 (requires sudo)
```

---

## 🌐 Nginx Configuration

### 1. Copy Nginx Config
```bash
sudo cp /var/www/tuition-app/nginx-production.conf /etc/nginx/sites-available/tuition-app
sudo ln -s /etc/nginx/sites-available/tuition-app /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
```

### 2. Test and Restart
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### 3. Verify Nginx is Working
```bash
# Check Nginx status
sudo systemctl status nginx

# Test the proxy
curl http://localhost/api/health
```

---

## ☁️ CDN Configuration (Optional)

If using a CDN (CloudFront, Cloudflare, etc.):

### 1. Create Distribution
- **Origin Domain:** hometuitionapp.com (or your server IP)
- **Origin Protocol:** HTTPS (recommended)
- **Allowed HTTP Methods:** GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
- **Cache Policy:** Managed-CachingOptimized (or create custom)

### 2. Behaviors
```
Path Pattern: /api/*
  - Origin: hometuitionapp.com
  - Viewer Protocol: HTTPS
  - Allowed Methods: All
  - Cache: Customize (no caching for API)

Path Pattern: /uploads/*
  - Origin: hometuitionapp.com
  - Cache: Yes (1 day)

Path Pattern: Default (*)
  - Origin: hometuitionapp.com
  - Serve from: /build (React static files)
```

### 3. Security
- **WAF:** Enable if available
- **SSL:** Use CloudFront default or custom certificate
- **Origin Access:** Configure security group

---

## 🔒 Security Group Configuration

In AWS Console → EC2 → Security Groups:

**Inbound Rules:**
| Type | Protocol | Port | Source | Description |
|------|----------|------|--------|-------------|
| SSH | TCP | 22 | Your IP | Admin access |
| HTTP | TCP | 80 | 0.0.0.0/0 | Nginx HTTP |
| Custom TCP | TCP | 5000 | 127.0.0.1/32 | Node.js (localhost only) |

**Note:** Port 5000 should ONLY be accessible from localhost (127.0.0.1). Nginx proxies requests from port 80 to 5000.

---

## 📊 Monitoring Commands

### PM2
```bash
pm2 status              # View running processes
pm2 logs                # View logs
pm2 logs --lines 100    # View last 100 lines
pm2 monit               # Real-time monitoring
pm2 restart tuition-api # Restart app
pm2 reload tuition-api  # Zero-downtime reload
```

### MongoDB
```bash
# Check MongoDB status
sudo systemctl status mongod

# View MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log

# MongoDB shell
mongo
db.adminCommand('ping')  # Test connection
show dbs                   # Show databases
use tuitionAppDB           # Switch to app DB
show collections           # Show collections
```

### Nginx
```bash
# Check Nginx status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# View logs
sudo tail -f /var/log/nginx/tuition-access.log
sudo tail -f /var/log/nginx/tuition-error.log

# Restart
sudo systemctl restart nginx
```

### System
```bash
# Check disk space
df -h

# Check memory
free -h

# Check CPU
htop

# Check running processes
ps aux | grep node
ps aux | grep nginx
```

---

## 🧪 Testing After Deployment

### 1. Test Health Endpoint
```bash
# Test via EC2 localhost
curl http://localhost:5000/api/health

# Test via Nginx
curl http://localhost/api/health

# Test via Production Domain
curl https://hometuitionapp.com/api/health
```

### 2. Test API Endpoints
```bash
# Test API root
curl https://hometuitionapp.com/api

# Test CORS (should return 200 with proper headers)
curl -H "Origin: https://hometuitionapp.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://hometuitionapp.com/api/auth/send-otp
```

### 3. Test Frontend
Open browser:
```
https://hometuitionapp.com
```

---

## 🔧 Common Issues & Fixes

### MongoDB Connection Failed
```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Start MongoDB
sudo systemctl start mongod

# Check logs
sudo tail -f /var/log/mongodb/mongod.log

# If data directory issue:
sudo mkdir -p /data/db
sudo chown -R mongodb:mongodb /data/db
sudo systemctl restart mongod
```

### Port 5000 Already in Use
```bash
# Find process using port 5000
sudo lsof -i :5000

# Kill process if needed
sudo kill -9 <PID>

# Restart PM2
pm2 restart tuition-api
```

### Nginx 502 Bad Gateway
```bash
# Check if Node.js is running
pm2 status

# Check Nginx error logs
sudo tail -f /var/log/nginx/tuition-error.log

# Test connection to backend
curl http://127.0.0.1:5000/api/health
```

### CORS Errors
```bash
# Verify allowed origins in .env
cat .env | grep ALLOWED_ORIGINS

# Check server logs for CORS blocks
pm2 logs
```

---

## 🔄 Updates & Maintenance

### Update Application
```bash
cd /var/www/tuition-app

# Pull latest code
git pull origin main

# Install dependencies
npm ci --production

# Reload PM2 (zero-downtime)
pm2 reload ecosystem.config.js
```

### Restart Services
```bash
# Restart all
pm2 restart all
sudo systemctl restart nginx
sudo systemctl restart mongod

# Or use deploy script
./deploy.sh
```

### Backup MongoDB
```bash
# Create backup directory
mkdir -p /var/backups/mongodb

# Backup database
mongodump --db tuitionAppDB --out /var/backups/mongodb/$(date +%Y%m%d)

# Restore from backup
mongorestore --db tuitionAppDB /var/backups/mongodb/20240101/tuitionAppDB
```

---

## 📞 Quick Reference

**Start Everything:**
```bash
sudo systemctl start mongod
pm2 start ecosystem.config.js
sudo systemctl start nginx
```

**Stop Everything:**
```bash
pm2 stop all
sudo systemctl stop nginx
sudo systemctl stop mongod
```

**Check Status:**
```bash
pm2 status
sudo systemctl status nginx
sudo systemctl status mongod
```

**View Logs:**
```bash
pm2 logs
tail -f /var/log/nginx/tuition-error.log
sudo tail -f /var/log/mongodb/mongod.log
```

---

## ✅ Post-Deployment Verification

- [ ] MongoDB is running: `sudo systemctl status mongod`
- [ ] Node.js is running: `pm2 status`
- [ ] Nginx is running: `sudo systemctl status nginx`
- [ ] Health check passes: `curl https://hometuitionapp.com/api/health`
- [ ] CORS works from production domain
- [ ] React app loads correctly
- [ ] API endpoints respond
- [ ] File uploads work (if configured)
- [ ] WebSocket connections work (if using Socket.IO)

---

**Last Updated:** 2026-05-25  
**Deployment Version:** 1.0.0
