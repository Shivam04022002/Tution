#!/bin/bash

# Quick start script for EC2 production deployment
# Usage: ./start-production.sh

echo "🚀 Starting Tuition Marketplace - Production Mode"
echo "================================================"

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found! Creating from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your actual values before running again!"
    exit 1
fi

# Set production mode
export NODE_ENV=production

# Ensure MongoDB is running
echo "🔄 Checking MongoDB..."
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB not running! Starting..."
    sudo systemctl start mongod
    sleep 2
fi

# Check MongoDB connection
if mongo --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo "✅ MongoDB is running"
else
    echo "❌ MongoDB connection failed!"
    echo "💡 Run: sudo systemctl start mongod"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm ci --production
fi

# Create necessary directories
mkdir -p uploads logs

# Start with PM2
echo "🚀 Starting application with PM2..."
pm2 start ecosystem.config.js --env production

# Save PM2 config
echo "💾 Saving PM2 configuration..."
pm2 save

echo ""
echo "✅ Application Started!"
echo "================================================"
echo "🌐 Production API: https://hometuitionapp.com/api"
echo "🌐 Local API: http://localhost:5000/api"
echo "💾 Database: mongodb://127.0.0.1:27017/tuitionAppDB"
echo ""
echo "📝 Useful Commands:"
echo "  pm2 logs          - View logs"
echo "  pm2 monit         - Monitor"
echo "  pm2 status        - Check status"
echo "  pm2 restart all   - Restart"
echo "================================================"
