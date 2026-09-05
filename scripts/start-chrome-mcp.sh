#!/usr/bin/env bash
set -euo pipefail

echo 'Starting Chrome DevTools MCP for the local PC...'
echo 'The phone controls the Automation dashboard; Chrome + MCP stay on this PC.'

npx -y chrome-devtools-mcp@latest --autoConnect
