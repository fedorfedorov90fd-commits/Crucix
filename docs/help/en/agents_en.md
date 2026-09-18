# Agents Module

## Description
The **Agents** module manages autonomous AI agents in the Crucix system. Agents perform background tasks: monitoring sources, data analysis, report generation, and automatic reactions to events.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agents` | List all registered agents |
| GET | `/api/agents/:id` | Info about a specific agent |
| POST | `/api/agents/:id/start` | Start an agent |
| POST | `/api/agents/:id/stop` | Stop an agent |
| GET | `/api/agents/:id/status` | Current agent status |
| GET | `/api/agents/:id/logs` | Agent execution logs |

## Example Request
```bash
curl -X GET http://localhost:3117/api/agents
Response Format
json
{
  "agents": [
    {
      "id": "monitor-agent-01",
      "name": "GDELT Monitor",
      "status": "running",
      "type": "collector",
      "lastRun": "2026-09-01T22:30:00Z",
      "interval": 300
    }
  ]
}
Configuration
Agents are configured in /config/agents.json. Supported parameters:

cron — schedule

collectors — list of collectors to monitor

actions — actions to trigger on events

Logging
Agent logs are stored in /logs/agents/<agent-id>.log

Version: 1.0
Updated: 2026-09-02
