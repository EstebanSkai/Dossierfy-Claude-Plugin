/**
 * Dossierfy MCP Proxy — server/index.js
 *
 * Runs as a local stdio MCP server inside Claude Desktop.
 * Connects to the remote Dossierfy MCP service over Streamable HTTP, discovers
 * its tools and prompts dynamically, and re-exposes them via stdio.
 *
 * Environment variables (injected by Claude Desktop from user_config):
 *   API_KEY  — AWS API Gateway key  (required)
 *   API_URL  — Remote MCP endpoint  (optional, defaults to production URL)
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRODUCTION_URL =
  "https://su1r02w48a.execute-api.eu-west-1.amazonaws.com/v1/graphApi/mcp/";

const CLIENT_INFO = { name: "dossierfy-proxy-client", version: "1.0.0" };

// ---------------------------------------------------------------------------
// Configuration — read from env vars
// ---------------------------------------------------------------------------

const API_KEY = process.env.API_KEY ?? "";
const API_URL = process.env.API_URL || PRODUCTION_URL;

if (!API_KEY) {
  process.stderr.write(
    "[dossierfy] ERROR: API_KEY environment variable is not set.\n" +
      "  Open Claude Desktop → Settings → Extensions → Dossierfy and enter your API key.\n"
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Remote MCP client (Streamable HTTP → AWS API Gateway)
// ---------------------------------------------------------------------------

const remoteTransport = new StreamableHTTPClientTransport(new URL(API_URL), {
  requestInit: {
    headers: {
      "x-api-key": API_KEY,
    },
  },
});

const remoteClient = new Client(CLIENT_INFO, {
  capabilities: { tools: {}, prompts: {} },
});

// ---------------------------------------------------------------------------
// Bootstrap: connect remote client first, forward its instructions,
//            then create local server and start it on stdio
// ---------------------------------------------------------------------------

async function main() {
  // 1. Connect to the remote MCP server first (so we can forward its instructions)
  process.stderr.write(`[dossierfy] Connecting to remote server: ${API_URL}\n`);

  try {
    await remoteClient.connect(remoteTransport);
    process.stderr.write("[dossierfy] Remote connection established.\n");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (/401|403|unauthorized|forbidden/i.test(message)) {
      process.stderr.write(
        "[dossierfy] ERROR: Authentication failed (HTTP 401/403).\n" +
          "  Check that your API Key is correct in Claude Desktop → Settings → Extensions → Dossierfy.\n"
      );
    } else {
      process.stderr.write(
        `[dossierfy] ERROR: Could not connect to remote server.\n  ${message}\n`
      );
    }
    process.exit(1);
  }

  // 2. Forward instructions from the remote server (falls back to a minimal string)
  const remoteInstructions =
    remoteClient.getInstructions() ??
    "Dossierfy — EMA post-authorisation variation classification (EC Regulation 1234/2008).";

  process.stderr.write(
    `[dossierfy] Forwarding remote instructions (${remoteInstructions.length} chars).\n`
  );

  // 3. Create the local MCP server with forwarded instructions
  const localServer = new Server(
    {
      name: "dossierfy-proxy",
      version: "1.0.0",
      instructions: remoteInstructions,
    },
    { capabilities: { tools: {}, prompts: {} } }
  );

  // 4. Register handlers on the local server

  // --- tools/list: proxy to remote -----------------------------------------
  localServer.setRequestHandler(ListToolsRequestSchema, async (_request) => {
    process.stderr.write("[dossierfy] tools/list requested\n");
    const result = await remoteClient.listTools();
    process.stderr.write(
      `[dossierfy] tools/list returned ${result.tools.length} tool(s)\n`
    );
    return result;
  });

  // --- tools/call: proxy to remote -----------------------------------------
  localServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    process.stderr.write(`[dossierfy] tools/call → ${name}\n`);
    const result = await remoteClient.callTool({ name, arguments: args ?? {} });
    return result;
  });

  // --- prompts/list: proxy to remote ---------------------------------------
  localServer.setRequestHandler(ListPromptsRequestSchema, async (_request) => {
    process.stderr.write("[dossierfy] prompts/list requested\n");
    const result = await remoteClient.listPrompts();
    process.stderr.write(
      `[dossierfy] prompts/list returned ${result.prompts.length} prompt(s)\n`
    );
    return result;
  });

  // --- prompts/get: proxy to remote ----------------------------------------
  localServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    process.stderr.write(`[dossierfy] prompts/get → ${name}\n`);
    const result = await remoteClient.getPrompt({ name, arguments: args ?? {} });
    return result;
  });

  // 5. Start the local stdio server (this blocks until Claude Desktop closes the process)
  const stdioTransport = new StdioServerTransport();

  process.stderr.write("[dossierfy] Starting local stdio server…\n");

  try {
    await localServer.connect(stdioTransport);
    process.stderr.write("[dossierfy] Local stdio server running.\n");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `[dossierfy] ERROR: Failed to start local server.\n  ${message}\n`
    );
    process.exit(1);
  }
}

main();
