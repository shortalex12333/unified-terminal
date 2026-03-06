Gemini said
MCP Integration Blueprint: E-Commerce Stack
1. Supported LLMs and Environments
The Model Context Protocol (MCP) acts as a "universal remote" or "USB-C port" for AI applications. Because it is an open standard, it is not restricted to a single provider.

Native CLI Support (Your Primary Orchestrators):

Claude Code (Anthropic): Fully native support. Anthropic created MCP in November 2024, so Claude Code is built entirely around this architecture.

Codex CLI (OpenAI): Natively supports MCP via its config.toml file, allowing direct connection to third-party tools. OpenAI officially adopted the standard across its products in March 2025.

Other Supported Environments:

Desktop / Chat: Claude Desktop, ChatGPT Desktop App.

IDEs & Code Assistants: Cursor, Windsurf, Zed, Replit, Codeium, and Sourcegraph.

Custom Implementations: Any LLM that supports function calling (like GPT-4o or Gemini 1.5/2.0) can use MCP through adapter libraries (like the OpenAI Agents Python SDK or LangChain). Note that reasoning models without function calling capabilities (like deep reasoning models) are generally not compatible.

2. Background Installation Commands (The "One Sweep")
Since your architecture mandates that users never touch a terminal, your Electron app's child_process will run these installations silently during the first launch sequence.

Most MCP servers are distributed as Node packages (NPM) or Python packages (PyPI). To ensure they are always available to the orchestrator, install them globally or invoke them via npx.

The Core E-Commerce MCPs
Run these commands in the background to cache the official servers:

Bash
# Stripe (Payments & Finance)
npm install -g @stripe/mcp

# Slack by Zencoder (Communication)
npm install -g @zencoder/slack-mcp-server

# Composio (The Master Key for HubSpot, ShipStation, Target, Meta Ads)
npm install -g composio-core
composio auth # Note: Your app will need to pipe this auth flow to your UI
Note: For official enterprise servers like Shopify and Klaviyo that may require specific environment configurations, they are often initiated directly via npx during the tool execution phase rather than globally installed.

3. Configuration & Usage Logic
Once installed, the CLI tools need to know these servers exist. You do not need to write custom routing logic for each API; you just declare them in the configuration files of your underlying orchestrators.

Passing to Codex CLI
Codex looks for MCP servers in a configuration file (typically ~/.codex/config.toml). Your app's auto-installer.ts should dynamically write this file:

Ini, TOML
[mcp_servers.stripe]
command = "npx"
args = ["-y", "@stripe/mcp"]
env = ["STRIPE_API_KEY=your_user_provided_key"]

[mcp_servers.slack]
command = "npx"
args = ["-y", "@zencoder/slack-mcp-server"]
env = ["SLACK_BOT_TOKEN=your_user_provided_token"]

[mcp_servers.composio]
command = "npx"
args = ["-y", "@composio/mcp"]
Passing to Claude Code
Claude Code looks for a JSON configuration (typically claude_desktop_config.json or .claude.json). Your app should write the server definitions like this:

JSON
{
  "mcpServers": {
    "stripe": {
      "command": "npx",
      "args": ["-y", "@stripe/mcp"],
      "env": {
        "STRIPE_API_KEY": "your_user_provided_key"
      }
    },
    "composio": {
      "command": "npx",
      "args": ["-y", "@composio/mcp"]
    }
  }
}
How the App "Uses" Them
Intake Phase: The user types, "Check the status of order #1234 on Shopify and Slack the customer a refund link from Stripe."

Execution: Your task router passes this exact prompt to the local CLI orchestrator (e.g., Claude Code).

Autonomous Action: Because the MCPs are listed in the config file, the CLI automatically detects the available tools, queries Shopify via Composio, generates the payment link via the Stripe MCP, and sends the message via the Slack MCP.

Display: Your app parses the stdout stream and displays: ✦ Checking Shopify order → ✦ Generating Stripe refund → ✦ Sending Slack message.

