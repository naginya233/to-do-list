module.exports = {
  apps: [
    {
      name: 'todolist-api',
      script: 'server.js',
      cwd: '/srv/todolist',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: '3000'
      }
    }
  ]
};
