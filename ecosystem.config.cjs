
module.exports = {
  apps: [
    {
      name: "morans-datax-buff",
      cwd: "/home/server/Apis/morans-datax-buff",
      script: "node_modules/next/dist/bin/next",
      args: "start --hostname 127.0.0.1 --port 3010",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

