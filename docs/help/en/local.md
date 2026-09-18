# Local — System Monitoring

**What it is:** Built-in Crucix server monitoring (CPU, RAM, disks, network, processes, uptime, service status). No external keys/internet required.

**How to use:**

1. Starts automatically with Crucix
2. Data updates every 60 seconds
3. API: `http://localhost:3117/api/local`
4. Configure in `/config/local.json`

**Professional use:** Alerts, Prometheus/Grafana integration, load analysis, security monitoring.

**❓ FAQ:**

- **Change frequency?** Yes, `pollInterval` in config.
- **Metrics:** CPU, RAM, disks, network, processes, uptime, statuses.
- **Add new monitoring?** Add plugin to `/scripts/monitors/`.

**🎯 Tutorial:**

```
curl http://localhost:3117/api/local
nano /config/local.json  # set alerts
tail -f /logs/local/system.log
```