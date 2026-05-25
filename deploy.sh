#!/bin/bash

# =============================================================================
# TUITION MARKETPLACE API - PRODUCTION DEPLOYMENT SCRIPT
# AWS EC2 + CloudFront + MongoDB Atlas
# =============================================================================

set -e  # Exit on any error

echo "🚀 Starting Tuition Marketplace API Production Deployment"
echo "============================================================"

# Configuration
APP_NAME="tuition-api"
NODE_VERSION="18"
PM2_INSTANCES="2"
LOG_DIR="./logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root (not recommended)
if [ "$EUID" -eq 0 ]; then
    log_warn "Running as root is not recommended for Node.js applications"
fi

# Step 1: Environment Validation
echo ""
echo "📋 Step 1: Validating Environment"
echo "-----------------------------------"

# Check Node.js version
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed"
    exit 1
fi

NODE_CURRENT=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_CURRENT" -lt "$NODE_VERSION" ]; then
    log_error "Node.js version $NODE_VERSION or higher is required (current: $(node --version))"
    exit 1
fi
log_info "✅ Node.js version: $(node --version)"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    log_warn "PM2 not found. Installing..."
    npm install -g pm2
fi
log_info "✅ PM2 version: $(pm2 --version)"

# Check if Nginx is installed (optional)
if command -v nginx &> /dev/null; then
    log_info "✅ Nginx found: $(nginx -v 2>&1 | head -n1)"
else
    log_warn "Nginx not found. Install with: sudo apt install nginx"
fi

# Step 2: Environment File Setup
echo ""
echo "📋 Step 2: Setting up Environment File"
echo "--------------------------------------"

if [ ! -f ".env.production" ]; then
    log_error ".env.production file not found!"
    log_info "Please create .env.production based on the template"
    exit 1
fi

# Copy production environment file
cp .env.production .env
log_info "✅ Environment file configured"

# Validate required environment variables
REQUIRED_VARS=("MONGODB_URI" "JWT_SECRET" "PORT")
MISSING_VARS=()

for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "$(grep "^${VAR}=" .env | cut -d'=' -f2)" ]; then
        MISSING_VARS+=("$VAR")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    log_error "Missing required environment variables: ${MISSING_VARS[*]}"
    exit 1
fi

log_info "✅ All required environment variables present"

# Step 3: Create Log Directory
echo ""
echo "📋 Step 3: Creating Log Directory"
echo "----------------------------------"

mkdir -p "$LOG_DIR"
log_info "✅ Log directory created: $LOG_DIR"

# Step 4: Clean Install Dependencies
echo ""
echo "📋 Step 4: Installing Dependencies"
echo "------------------------------------"

# Clean node_modules and lock files for fresh install
rm -rf node_modules package-lock.json

# Install dependencies
npm ci --production
log_info "✅ Dependencies installed"

# Step 5: Application Build (if needed)
echo ""
echo "📋 Step 5: Building Application"
echo "-------------------------------"

# If you have a build step, add it here
# npm run build

log_info "✅ Application ready"

# Step 6: PM2 Process Management
echo ""
echo "📋 Step 6: Configuring PM2"
echo "-------------------------"

# Check if PM2 process already exists
if pm2 list | grep -q "$APP_NAME"; then
    log_info "🔄 Updating existing PM2 process..."
    pm2 reload ecosystem.config.js --env production
else
    log_info "🆕 Starting new PM2 process..."
    pm2 start ecosystem.config.js --env production
fi

# Save PM2 process list
pm2 save

# Setup PM2 startup script (if not already done)
if [ ! -f /etc/systemd/system/pm2-${USER}.service ]; then
    log_info "🔧 Setting up PM2 startup script..."
    pm2 startup systemd -u $USER --hp $HOME
    log_warn "⚠️  You may need to run the displayed command with sudo"
fi

log_info "✅ PM2 process configured"

# Step 7: Health Check
echo ""
echo "📋 Step 7: Health Check"
echo "-----------------------"

# Wait for server to start
sleep 3

# Check if the application is running
if pm2 list | grep -q "$APP_NAME"; then
    STATUS=$(pm2 jlist | grep -o '"status":"online"' | wc -l)
    if [ "$STATUS" -gt 0 ]; then
        log_info "✅ Application is running"
        
        # Test health endpoint
        HEALTH_URL="http://localhost:5000/api/health"
        if command -v curl &> /dev/null; then
            HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")
            if [ "$HTTP_STATUS" = "200" ]; then
                log_info "✅ Health check passed (HTTP $HTTP_STATUS)"
            else
                log_warn "⚠️  Health check returned HTTP $HTTP_STATUS"
            fi
        fi
    else
        log_error "❌ Application is not online"
        pm2 logs "$APP_NAME" --lines 20
        exit 1
    fi
else
    log_error "❌ PM2 process not found"
    exit 1
fi

# Step 8: Nginx Configuration (Optional)
echo ""
echo "📋 Step 8: Nginx Configuration"
echo "--------------------------------"

if command -v nginx &> /dev/null; then
    if [ -f "nginx.conf" ]; then
        log_info "📄 Nginx configuration file found"
        log_info "To enable Nginx:"
        log_info "  1. sudo cp nginx.conf /etc/nginx/sites-available/tuition-api"
        log_info "  2. sudo ln -s /etc/nginx/sites-available/tuition-api /etc/nginx/sites-enabled/"
        log_info "  3. sudo nginx -t"
        log_info "  4. sudo systemctl restart nginx"
    fi
else
    log_warn "Nginx not installed. Skipping Nginx configuration."
fi

# Step 9: Security Check
echo ""
echo "📋 Step 9: Security Check"
echo "-------------------------"

# Check if running on port 80/443 (requires sudo)
if [ "$PORT" = "80" ] || [ "$PORT" = "443" ]; then
    log_warn "⚠️  Ports 80/443 require root privileges"
    log_info "💡 Use Nginx as reverse proxy instead"
fi

# Check JWT secret length
JWT_SECRET=$(grep "^JWT_SECRET=" .env | cut -d'=' -f2-)
JWT_LENGTH=${#JWT_SECRET}
if [ "$JWT_LENGTH" -lt 32 ]; then
    log_error "❌ JWT_SECRET should be at least 32 characters (current: $JWT_LENGTH)"
else
    log_info "✅ JWT_SECRET length: $JWT_LENGTH characters"
fi

# Check Node_ENV
NODE_ENV=$(grep "^NODE_ENV=" .env | cut -d'=' -f2)
if [ "$NODE_ENV" != "production" ]; then
    log_warn "⚠️  NODE_ENV is not set to 'production'"
else
    log_info "✅ NODE_ENV: production"
fi

# Final Summary
echo ""
echo "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "======================================="
echo ""
echo "📊 Application Status:"
pm2 list | grep "$APP_NAME"
echo ""
echo "🔗 Useful Commands:"
echo "  • View logs:        pm2 logs $APP_NAME"
echo "  • Monitor:          pm2 monit"
echo "  • Restart:          pm2 restart $APP_NAME"
echo "  • Stop:             pm2 stop $APP_NAME"
echo "  • Status:           pm2 status"
echo ""
echo "🌐 API Endpoints:"
echo "  • Health Check:     http://your-ec2-ip:5000/api/health"
echo "  • API Base:         http://your-ec2-ip:5000/api"
echo ""
echo "📚 Next Steps:"
echo "  1. Configure your domain DNS to point to this EC2 instance"
echo "  2. Set up SSL with Let's Encrypt: sudo certbot --nginx"
echo "  3. Update .env.production with your actual domain names"
echo "  4. Configure AWS Security Group to allow inbound traffic on port 5000 (or 80/443)"
echo "  5. Update CloudFront origin to point to your EC2 instance"
echo ""
echo "🚀 Tuition Marketplace API is now live!"
echo "============================================================"
