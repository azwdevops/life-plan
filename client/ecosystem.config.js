// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "life-plan",
      script: "npm",
      args: "start",
      cwd: "/home/ubuntu/life_plan/client",
      env: {
        NODE_ENV: "production",
        PORT: 5005,
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      out_file: "/home/ubuntu/life_plan_conf/var/log/out.log",
      error_file: "/home/ubuntu/life_plan_conf/var/log/error.log",
    },
  ],
};
