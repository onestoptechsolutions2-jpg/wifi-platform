// PM2 config — use when running without Docker on a bare VPS
// Start: pm2 start ecosystem.config.cjs
// Save:  pm2 save && pm2 startup

module.exports = {
  apps: [
    {
      name:         'wifi-backend',
      script:       './backend/dist/index.js',
      instances:    'max',      // one per CPU core
      exec_mode:    'cluster',
      env: {
        NODE_ENV: 'production',
        PORT:     3000,
      },
      // Restart on memory leak
      max_memory_restart: '512M',
      // Log files
      out_file:  './logs/backend-out.log',
      error_file:'./logs/backend-err.log',
      merge_logs: true,
    },
  ],
}
