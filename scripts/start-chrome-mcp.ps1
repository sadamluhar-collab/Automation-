$ErrorActionPreference = 'Stop'

Write-Host 'Starting Chrome DevTools MCP for the local PC...' -ForegroundColor Cyan
Write-Host 'The phone controls the Automation dashboard; Chrome + MCP stay on this PC.'

npx -y chrome-devtools-mcp@latest --autoConnect
