Crucix MCP Server — User Guide
What is MCP Server?
MCP Server (Model Context Protocol) is an interface that allows AI agents (Claude, Cursor, and others) to directly access Crucix data. It enables AI to query analytics, country risks, market data, and early warnings without manual intervention.

How It Works
AI agent sends a request to the MCP server

The server processes the request and returns data from Crucix's basket

AI uses this data for analysis and responding to users

Location
File: apis/sources/mcp-server.mjs

Endpoint: http://localhost:3117/api/mcp/

Tools documentation: http://localhost:3117/api/mcp/tools

Available Tools
1. get_country_risk — Country Risk
Get the risk level for any country.

Parameters:

country	string	Country name (in English or Russian)
Example request:

json
{
  "tool": "get_country_risk",
  "arguments": { "country": "Russia" }
}
Example response:

json
{
  "result": {
    "country": "Russia",
    "risk": "pre-war",
    "score": 78.5
  }
}
2. get_world_brief — Global Brief
Get a brief summary of the global situation.

Parameters: none

Example request:

json
{
  "tool": "get_world_brief",
  "arguments": {}
}
Example response:

json
{
  "result": {
    "timestamp": "2026-08-30T13:00:00Z",
    "status": "HIGH_ALERT",
    "critical_events": 3,
    "high_events": 8,
    "summary": "3 critical and 8 high events detected"
  }
}
3. get_market_data — Market Data
Get market indicators (VIX, Gold/Oil, BDI, etc.)

Parameters:

indicators	array	List of indicators (optional)
Available indicators: vix, gold-oil-ratio, bdi, copper-gold, uranium, inflation, unemployment, pmi, recession, dxy, tips, ovx, hy-spread, consumer-confidence

Example request:

json
{
  "tool": "get_market_data",
  "arguments": { "indicators": ["vix", "gold-oil-ratio", "bdi"] }
}
Example response:

json
{
  "result": {
    "vix": 16.73,
    "gold-oil-ratio": 27.56,
    "bdi": 2070
  }
}
4. get_conflicts — Active Conflicts
Get a list of active conflicts.

Parameters:

limit	number	Maximum number (default: 10)
Example request:

json
{
  "tool": "get_conflicts",
  "arguments": { "limit": 5 }
}
Example response:

json
{
  "result": [
    { "location": "Donbas", "severity": "critical", "date": "2026-08-30" },
    { "location": "Gaza", "severity": "critical", "date": "2026-08-30" },
    { "location": "Sudan", "severity": "critical", "date": "2026-08-29" }
  ]
}
5. get_early_warnings — Early Warnings
Get all active early warnings.

Parameters: none

Example request:

json
{
  "tool": "get_early_warnings",
  "arguments": {}
}
Example response:

json
{
  "result": [
    {
      "region": "Middle East",
      "severity": "critical",
      "reason": "Increased military activity",
      "timestamp": "2026-08-30T10:00:00Z"
    }
  ]
}
Connecting to Claude Desktop
Add to claude_desktop_config.json:

json
{
  "mcpServers": {
    "crucix": {
      "url": "http://localhost:3117/api/mcp"
    }
  }
}
After this, Claude can use Crucix tools directly.

Testing
Check available tools:

bash
curl http://localhost:3117/api/mcp/tools | jq .
Test global brief:

bash
curl -X POST http://localhost:3117/api/mcp/call \
  -H "Content-Type: application/json" \
  -d '{"tool":"get_world_brief","arguments":{}}' | jq .
Requirements
Crucix server must be running on port 3117

Basket must contain data (files in data/basket/)

For full functionality, collectors should be configured

Related Modules
/api/early-warning/ — early warning system

/api/global-index/ — global tension index

/api/correlation/ — cross-correlation analyzer

/dashboard-5in1 — central dashboard with indicators