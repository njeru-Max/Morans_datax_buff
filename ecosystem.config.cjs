module.exports = {
  apps: [
    {
      name: "morans-datax-buff",
      cwd: "/home/server/Apis/morans-datax-buff/current",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: "3010",
      },
    },
  ],
};

