module.exports = {
  apps: [{
    name: 'fbis-mcp',
    script: 'server.py',
    interpreter: 'python',
    cwd: __dirname,
    watch: false,
    env: { MCP_PORT: '8765' },
  }],
};
