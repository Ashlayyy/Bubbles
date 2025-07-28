import http from "http";
import { collectDefaultMetrics, Counter, Gauge } from "prom-client";
import { metricsRegistry } from "./metrics/registry.js";
import type { BotQueueService } from "./services/botQueueService.js";
import type Client from "./structures/Client.js";

export function startMetricsServer(client: Client, queueService: BotQueueService | null, port = 9321) {
  const register = metricsRegistry;
  collectDefaultMetrics({ register });

  // Gauges / Counters
  const gatewayLatency = new Gauge({
    name: "discord_gateway_latency_ms",
    help: "Discord gateway latency in milliseconds",
    registers: [register],
  });
  const shardCount = new Gauge({
    name: "discord_shard_count",
    help: "Number of shards this process is handling",
    registers: [register],
  });
  const queueActive = new Gauge({
    name: "bot_queue_active_jobs",
    help: "Active jobs processed by this bot instance",
    registers: [register],
  });
  const jobsProcessed = new Counter({
    name: "bot_jobs_processed_total",
    help: "Total jobs processed by this bot instance",
    registers: [register],
  });
  let lastCompleted = 0;

  // Update gauges every 15s
  setInterval(() => {
    gatewayLatency.set(client.ws.ping);
    shardCount.set(client.shard?.count ?? 1);

    if (queueService) {
      queueService
        .getAllQueueMetrics()
        .then((metrics) => {
          let totalActive = 0;
          let totalCompleted = 0;

          for (const queueMetrics of Object.values(metrics)) {
            if (queueMetrics && typeof queueMetrics === "object" && !queueMetrics.error) {
              totalActive += Number(queueMetrics.active) || 0;
              totalCompleted += Number(queueMetrics.completed) || 0;
            }
          }

          queueActive.set(totalActive);
          if (totalCompleted > lastCompleted) {
            jobsProcessed.inc(totalCompleted - lastCompleted);
            lastCompleted = totalCompleted;
          }
        })
        .catch((err: unknown) => {
          console.error("[Metrics] Update error", err);
        });
    }
  }, 15000).unref();

  // Basic HTTP server
  const server = http.createServer((req, res) => {
    if (req.url === "/metrics") {
      register
        .metrics()
        .then((metrics) => {
          res.writeHead(200, { "Content-Type": register.contentType });
          res.end(metrics);
        })
        .catch(() => {
          res.writeHead(500);
          res.end("failed to collect metrics");
        });
    } else if (req.url === "/health") {
      // Basic health information; extend as needed
      if (queueService) {
        queueService
          .getSystemHealth()
          .then((health) => {
            const overall = client.isReady() && health.overall ? "ok" : "degraded";
            const payload = {
              overall,
              timestamp: Date.now(),
              components: {
                discord: client.isReady(),
                queue: health.overall,
              },
            };
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(payload));
          })
          .catch((err: unknown) => {
            console.error("[Health] Queue health check error", err);
            const payload = {
              overall: "degraded",
              timestamp: Date.now(),
              components: {
                discord: client.isReady(),
                queue: false,
              },
            };
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(payload));
          });
      } else {
        const overall = client.isReady() ? "ok" : "degraded";
        const payload = {
          overall,
          timestamp: Date.now(),
          components: {
            discord: client.isReady(),
            queue: false,
          },
        };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
      }
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, () => {
    console.log(`[Metrics] Bot metrics server listening on ${port}`);
  });
}
