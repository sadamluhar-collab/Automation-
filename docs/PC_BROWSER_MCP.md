# PC Browser + Phone Control

This project keeps Chrome DevTools MCP on the user's PC. Render remains the API/control plane and Supabase remains the durable data store.

## Architecture

Phone browser → Automation dashboard/API → Supabase/jobs

PC → Chrome → Chrome DevTools MCP → local browser automation

The phone does not need to run Chrome DevTools MCP itself.

## PC requirements

- Node.js LTS
- Current stable Google Chrome
- An MCP client such as Codex, Cursor, Gemini CLI, Claude Code, or VS Code

Chrome DevTools MCP officially requires Node.js LTS, npm, and current stable Chrome or newer. See the official documentation: https://github.com/ChromeDevTools/chrome-devtools-mcp

## MCP configuration

The repository already contains `.mcp.json` with the official server configuration:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

For an agent that supports local MCP configuration, start it from the repository and reload MCP servers.

## Auto-connect to the PC's running Chrome

The included launchers use the official `--autoConnect` mode:

Windows PowerShell:

```powershell
./scripts/start-chrome-mcp.ps1
```

macOS/Linux:

```bash
chmod +x scripts/start-chrome-mcp.sh
./scripts/start-chrome-mcp.sh
```

With Chrome 144+, `--autoConnect` requires Remote Debugging to be enabled in `chrome://inspect/#remote-debugging`. Chrome will ask for permission before the MCP server connects.

## Phone control

Open the deployed Automation dashboard from the phone and use its existing authenticated project/job controls. The phone remains a control surface; the browser-control runtime stays on the PC.

Do **not** expose Chrome's debugging port (9222) directly to the public internet. Chrome DevTools MCP can read and modify the connected browser session, including authenticated pages. Use a private network/VPN/tunnel only if remote access is required.

## Important boundary

The MCP server is intentionally not installed as a Render dependency. Render is not used as a remote Chrome host. This keeps browser credentials, cookies, and the interactive Chrome session on the PC.

This change is additive: it does not alter Supabase schema/data or Render environment variables.
