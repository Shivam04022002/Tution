# 🚀 Production Deployment Guide

## Tuition Marketplace API - AWS EC2 + CloudFront + MongoDB Atlas

This guide covers deploying the Tuition Marketplace backend to AWS EC2 with CloudFront CDN and MongoDB Atlas.

---

## 📋 Prerequisites

### Required
- **AWS Account** with EC2 access
- **Domain Name** (e.g., api.yourdomain.com)
- **SSL Certificate** (Let's Encrypt recommended)
- **MongoDB Atlas** cluster
- **Node.js 18+** on EC2 instance

### Recommended
- **Ubuntu 22.04 LTS** on EC2
- **t3.medium** instance or higher
- **Nginx** as reverse proxy
- **PM2** for process management

---

## 🏗️ Architecture Overview

```
┌─────────────────┐
│   CloudFront    │  CDN + SSL Termination
│   (Frontend)    │
└────────┬────────┘
         │
         │ HTTPS
         ▼
┌─────────────────┐
│   Nginx         │  Reverse Proxy
│   (Port 443)    │  SSL + Load Balancing
└────────┬────────┘
         │
         │ HTTP/WS
         ▼
┌─────────────────┐
│   PM2           │  Process Manager
│   (Node.js)     │  Multiple Instances
│   (Port 5000)   │
└────────┬────────┘
         │
         │ MongoDB Protocol
         ▼
┌─────────────────┐
│  MongoDB Atlas  │  Database
│   (Cluster)     │
└─────────────────┘
```

---

## 🔧 Step-by-Step Deployment

### Step 1: EC2 Instance Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # v18.x.x
npm --version   # 9.x.x

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install build tools (for native modules)
sudo apt install -y build-essential git
```

### Step 2: MongoDB Atlas Configuration

1. **Whitelist EC2 IP**: In MongoDB Atlas, add your EC2 instance IP to the IP whitelist
   - Go to Network Access → Add IP Address
   - Add your EC2 public IP or use `0.0.0.0/0` (less secure, for testing only)

2. **Get Connection String**: Copy your MongoDB Atlas connection string
   - Replace `<password>` with your actual password
   - Ensure proper URL encoding for special characters

### Step 3: Application Deployment

```bash
# Create application directory
sudo mkdir -p /var/www/tuition-api
sudo chown ubuntu:ubuntu /var/www/tuition-api
cd /var/www/tuition-api

# Clone repository (or upload files)
git clone https://github.com/yourusername/tuition-marketplace.git .
# OR upload via SCP: scp -r ./backend ubuntu@your-ec2-ip:/var/www/tuition-api

# Install dependencies
npm ci --production

# Copy environment file
cp .env.production .env

# Edit environment variables
nano .env
```

### Step 4: Environment Configuration

Edit `.env` with your actual values:

```bash
# Server
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

# MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/tuition?retryWrites=true&w=majority

# Security
JWT_SECRET=your-super-strong-32-char-minimum-secret-key

# Frontend URL (CloudFront)
FRONTEND_URL=https://your-cloudfront-domain.cloudfront.net
ALLOWED_ORIGINS=https://your-cloudfront-domain.cloudfront.net

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Razorpay (Live Keys)
RAZORPAY_KEY_ID=rzp_live_your_key
RAZORPAY_KEY_SECRET=your_secret

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### Step 5: PM2 Configuration

```bash
# Start application with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

# Setup PM2 startup script
pm2 startup systemd
# Run the command output by PM2 (requires sudo)

# Check status
pm2 status
pm2 logs
```

### Step 6: Nginx Configuration

```bash
# Copy Nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/tuition-api

# Enable site
sudo ln -s /etc/nginx/sites-available/tuition-api /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### Step 7: SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal test
sudo certbot renew --dry-run
```

### Step 8: AWS Security Group Configuration

In AWS Console → EC2 → Security Groups:

**Inbound Rules:**
| Type | Protocol | Port Range | Source | Description |
|------|----------|------------|--------|-------------|
| SSH | TCP | 22 | Your IP | Admin access |
| HTTP | TCP | 80 | 0.0.0.0/0 | Nginx HTTP |
| HTTPS | TCP | 443 | 0.0.0.0/0 | Nginx HTTPS |
| Custom TCP | TCP | 5000 | 127.0.0.1/32 | PM2 (localhost only) |

**Outbound Rules:** Allow all traffic

### Step 9: CloudFront Configuration

1. **Create CloudFront Distribution**:
   - Origin Domain: `api.yourdomain.com` (your EC2/Nginx)
   - Protocol: HTTPS only
   - Allowed HTTP Methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
   - Cache Policy: CachingOptimized (or custom for API)
   - Origin Request Policy: AllViewer

2. **Configure Behaviors**:
   - `/api/*` → Cache based on query string
   - `/socket.io/*` → No cache, WebSocket support
   - `/health` → Cache for 60 seconds

3. **SSL/TLS**:
   - Use custom SSL certificate or CloudFront default

4. **Update Frontend**:
   - Use CloudFront URL as API base URL

---

## 🔄 Automated Deployment

### Using Deploy Script

```bash
# Make script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

The script will:
1. Validate environment
2. Install dependencies
3. Configure PM2
4. Start/reload application
5. Run health checks

---

## 📊 Monitoring & Logging

### PM2 Commands

```bash
# View logs
pm2 logs tuition-api

# Monitor in real-time
pm2 monit

# View status
pm2 status

# Restart application
pm2 restart tuition-api

# Reload (zero-downtime)
pm2 reload tuition-api

# Scale instances
pm2 scale tuition-api 4
```

### Log Files

```bash
# PM2 logs
~/.pm2/logs/tuition-api-out.log
~/.pm2/logs/tuition-api-error.log

# Application logs
/var/www/tuition-api/logs/

# Nginx logs
/var/log/nginx/tuition-api-access.log
/var/log/nginx/tuition-api-error.log

# System logs
sudo journalctl -u pm2-ubuntu
```

---

## 🔒 Security Checklist

- [ ] Strong JWT_SECRET (min 32 chars)
- [ ] NODE_ENV=production
- [ ] MongoDB Atlas IP whitelist configured
- [ ] AWS Security Group restricts port 5000 to localhost
- [ ] SSL certificate installed (HTTPS only)
- [ ] Nginx rate limiting enabled
- [ ] PM2 running as non-root user
- [ ] Environment variables secured (not in git)
- [ ] CloudFront origin access restricted
- [ ] Regular security updates: `sudo apt update && sudo apt upgrade`

---

## 🐛 Troubleshooting

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs

# Verify environment variables
cat .env | grep -E "^(MONGODB_URI|JWT_SECRET|PORT)"

# Test MongoDB connection
node -e "require('mongoose').connect(process.env.MONGODB_URI).then(() => console.log('OK')).catch(e => console.error(e))"

# Check port availability
sudo lsof -i :5000
```

### MongoDB Connection Issues

```bash
# Test connection from EC2
mongo "mongodb+srv://username:password@cluster.mongodb.net" --eval "db.adminCommand('ping')"

# Check IP whitelist in Atlas
# Verify credentials are URL-encoded if special characters present
```

### Nginx 502 Bad Gateway

```bash
# Check if Node.js is running
curl http://localhost:5000/api/health

# Verify Nginx configuration
sudo nginx -t

# Check Nginx error logs
sudo tail -f /var/log/nginx/tuition-api-error.log
```

### SSL Certificate Issues

```bash
# Renew certificate
sudo certbot renew

# Check certificate status
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal
```

---

## 📈 Performance Optimization

### Database
- Enable MongoDB connection pooling
- Use indexes on frequently queried fields
- Implement caching for expensive queries

### Application
- Enable Gzip compression (already in server.js)
- Use PM2 cluster mode for multiple CPU cores
- Implement request caching for static data

### CDN
- Configure CloudFront cache behaviors
- Use signed URLs for private content
- Enable compression at edge

---

## 🚀 CI/CD Pipeline (Optional)

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to EC2

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to EC2
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.EC2_HOST }}
        username: ubuntu
        key: ${{ secrets.EC2_SSH_KEY }}
        script: |
          cd /var/www/tuition-api
          git pull origin main
          npm ci --production
          pm2 reload ecosystem.config.js
```

---

## 📞 Support

**Resources:**
- PM2 Docs: https://pm2.keymetrics.io/
- Nginx Docs: https://nginx.org/en/docs/
- MongoDB Atlas Docs: https://docs.atlas.mongodb.com/
- AWS EC2 Docs: https://docs.aws.amazon.com/ec2/

---

**Last Updated:** 2026-05-25  
**Version:** 1.0.0
