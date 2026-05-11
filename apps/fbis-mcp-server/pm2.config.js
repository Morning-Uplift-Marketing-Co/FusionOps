module.exports = {
  apps: [
    {
      name: 'fbis-mcp',
      script: 'python',
      args: 'server.py',
      cwd: __dirname,
      interpreter: 'none',
      env: {
        MCP_PORT: '8765',
      },
      watch: false,
      autorestart: true,
      max_restarts: 5,
    },
  ],
};
