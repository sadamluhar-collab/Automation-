# YouTube Automation Cloudflare MCP

Remote MCP gateway for the existing YouTube Automation backend.

Architecture:

`ChatGPT -> Cloudflare MCP -> Render automation-api -> Supabase / Google Drive / YouTube`

The Worker exposes authenticated automation tools and a generic `/api/*` read/write tool. Backend tenant ownership and authorization remain enforced by Render.

## Cloudflare setup

1. In Cloudflare Dashboard open **Workers & Pages**.
2. Create a KV namespace named `youtube-automation-mcp-oauth`.
3. Copy the KV namespace ID.
4. On the `cloudflare-mcp` branch, replace `REPLACE_WITH_CLOUDFLARE_KV_ID` in `cloudflare-mcp/wrangler.jsonc` with that ID.
5. Create/import the Worker from this repository, using:
   - root directory: `cloudflare-mcp`
   - build/deploy command: `npm install && npm run deploy`
6. Add these Worker secrets in **Settings -> Variables and Secrets**:
   - `SUPABASE_ANON_KEY` = the existing Supabase anon/publishable key
7. Deploy.

The Worker uses the existing Supabase account login only to authorize the MCP connection. It does not use the Supabase service-role key and does not receive YouTube or Google Drive OAuth secrets.

## MCP endpoint

After deployment, connect ChatGPT to:

`https://<your-worker-subdomain>.workers.dev/mcp`

The MCP authorization flow will ask for the YouTube Automation account email/password and verifies that the account has a connected YouTube channel before granting access.

## Exposed tools

- `whoami`
- `list_channels`
- `list_projects`
- `create_project`
- `delete_project`
- `create_short`
- `start_project`
- `automation_execute` — authenticated GET/POST/PUT/PATCH/DELETE for permitted `/api/*` routes

`/api/auth`, `/api/oauth`, `/api/mcp/admin`, and `/api/secrets` are blocked from the generic tool.

## Important

The Worker is a control gateway. Long-running video work stays on Render; Supabase remains the state/checkpoint database and Google Drive remains file storage.
