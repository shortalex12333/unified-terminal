Getting started
First things first: if you haven’t downloaded Codex CLI or the Codex extension, you should start with that.
Here’s the NPM command for the CLI:

npm install -g /codex
You should be able to find the extension in the respective IDE marketplace, if not you can follow the links from OpenAI’s developer pages here: https://developers.openai.com/codex/ide

Getting into your config.toml file is pretty easy:

In the extension, you can right-click the gear icon and it’ll take you straight to the TOML file.

Or you can do it via terminal (first create .codex in your root and then the config.toml).

Either way, it’s simple.

TOML conversion
It’s really easy, it all comes down to rearranging the name, command, arguments, and env variable. IMO TOML looks better than JSON, but yeah it’s annoying that there isn’t a unified approach.
Here’s the example blank format OpenAI shows in the docs:

[mcp_servers.server-name]
command = "npx"
args = ["-y", "mcp-server"]
env = { "API_KEY" = "value" }
So let’s make this practical and look at the first MCP I add to all agentic coding tools: Context7.

Here’s the standard JSON format we’re used to:

"Context7": {
  "command": "npx",
  "args": [
    "-y",
    "@upstash/context7-mcp@latest"
  ]
}
So it just comes down to a bit of rearranging. Final result in TOML:

[mcp_servers.Context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp@latest"]
Adding environment variables is easy too (covered in Youtube video).

Other MCPs I’ve been using in Codex
Web MCP by Bright Data

Playwright by Microsoft

Supabase for DB management (keep read-only for prod)

Basic Memory for unified memory

What’s still missing
Besides the missing remote MCP support, the next feature I want is the ability to toggle on/off both individual servers and individual tools (Claude Code is also missing this).