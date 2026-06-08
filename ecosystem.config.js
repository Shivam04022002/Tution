/**
 * PM2 Ecosystem Configuration
 * Production deployment for AWS EC2
 * 
 * Usage:
 * - Start: pm2 start ecosystem.config.js
 * - Stop: pm2 stop ecosystem.config.js
 * - Restart: pm2 restart ecosystem.config.js
 * - Reload: pm2 reload ecosystem.config.js
 * - Delete: pm2 delete ecosystem.config.js
 * - Monitor: pm2 monit
 * - Logs: pm2 logs
 */

module.exports = {
  apps: [
    {
      name: 'tuition-api',
      script: './server.js',
      instances: 1, // Single instance for fork mode
      exec_mode: 'fork', // Fork mode for simpler deployment
      
      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
        HOST: '0.0.0.0'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        HOST: '0.0.0.0'
      },
      
      // Logging configuration
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      
      // Memory management
      max_memory_restart: '400M', // Memory limit as specified
      
      // Auto-restart settings
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Monitoring
      monitoring: true,
      
      // Advanced settings
      watch: false, // Don't watch files in production
      ignore_watch: ['node_modules', 'logs', '.git'],
      merge_logs: true,
      
      // Kill timeout
      kill_timeout: 5000,
      
      // Wait ready
      wait_ready: true,
      listen_timeout: 10000,
      
      // PM2 Plus (optional monitoring)
      // pmx: false,
      // automation: false,
      
      // Instance variances
      instance_var: 'INSTANCE_ID',
      
      // Source map support
      source_map_support: true,
    }
  ]
};
