module.exports = {
  apps: [
    {
      name: "zalo-cskh-server",
      cwd: "./server",
      script: "dist/app.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 5001,
      },
    },
  ],
};
