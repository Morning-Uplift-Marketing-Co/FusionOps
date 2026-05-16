module.exports = {
  apps: [{
    name: 'fbis-mcp',
    script: 'server.py',
    interpreter: 'python3',
    cwd: __dirname,
    watch: false,
    env: { MCP_PORT: '8765' },
  }],
};
