$ErrorActionPreference = 'Stop'
if (-not $env:AUTOMATION_API_URL) { $env:AUTOMATION_API_URL = 'https://automation-api-m16m.onrender.com' }
if (-not $env:WORKER_SECRET) { throw 'Set WORKER_SECRET before starting the PC browser bridge.' }
if (-not $env:BROWSER_WORKER_ID) { $env:BROWSER_WORKER_ID = 'pc-browser-windows' }
Write-Host "Starting Automation PC Browser Bridge: $env:BROWSER_WORKER_ID"
node "$PSScriptRoot/pc-browser-bridge.mjs"
