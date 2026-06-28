// /opt/hostflow-ecosystem/axonetis-ssh-bridge/ecosystem.config.cjs
module.exports = {
  apps: [{
    name: "axonetis-ssh-bridge",
    script: "dist/index.js",
    cwd: "/opt/hostflow-ecosystem/axonetis-ssh-bridge",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    max_memory_restart: "200M",
    env: {
      NODE_ENV: "production",
      SSH_BRIDGE_PORT: "8092",
      SSH_BRIDGE_SHELL: "/bin/bash",
      SSH_BRIDGE_ORIGINS: "https://founderbuilder.axonetis.com",
    },
  }],
};
