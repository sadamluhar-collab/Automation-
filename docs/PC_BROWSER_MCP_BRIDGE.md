# PC Browser Control Bridge

This bridge lets the existing authenticated dashboard enqueue Chrome DevTools MCP tool calls for a trusted PC. Render never connects to Chrome directly and Chrome port 9222 must stay bound to localhost.

## PC setup

1. Install Node.js 20+ and Chrome.
2. Start Chrome with remote debugging enabled on localhost only. Chrome's DevTools MCP documentation warns that an exposed debugging port can let any application control the browser, so do not expose port 9222 to the internet.
3. Set the same `WORKER_SECRET` configured on Render.
4. Run the Windows launcher:

```powershell
$env:WORKER_SECRET='YOUR_WORKER_SECRET'
.\scripts\start-pc-browser-bridge.ps1
```

For macOS/Linux:

```bash
export WORKER_SECRET='YOUR_WORKER_SECRET'
node scripts/pc-browser-bridge.mjs
```

The bridge starts `chrome-devtools-mcp@latest` against `http://127.0.0.1:9222`, initializes MCP, polls the Automation API, executes queued `mcp_call` commands, and reports results.

## API contract

Authenticated dashboard/client:

`POST /api/browser/commands`

```json
{"command":"mcp_call","args":{"tool":"<MCP tool name>","arguments":{}}}
```

PC worker:

- `POST /api/browser/commands/claim` with `x-worker-secret`
- `POST /api/browser/commands/:id/complete` with `x-worker-secret`

The queue is stored in Supabase and uses an atomic `claim_browser_command()` RPC, so two PC workers do not claim the same queued command.

## Security

- Never publish or tunnel Chrome's 9222 port.
- Use a dedicated Chrome profile for automation when possible.
- Treat authenticated browser sessions as sensitive.
- Keep `WORKER_SECRET` out of GitHub and client-side code.
- The bridge only accepts worker-authenticated claim/complete operations; end users enqueue commands through the normal authenticated API.

Chrome DevTools MCP is a local stdio MCP server; the official project documents `--browser-url=http://127.0.0.1:9222` for attaching to a running debuggable Chrome instance.
