import http from "http";
import { collectDefaultMetrics, Counter, Gauge } from "prom-client";
import { metricsRegistry } from "./metrics/registry.js";
import type { UnifiedQueueService } from "./services/unifiedQueueService.js";
import type Client from "./structures/Client.js";

export function startMetricsServer(client: Client, queueService: UnifiedQueueService | null, port = 9321) {
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
      try {
        const metrics = queueService.getMetrics();
        const workers = metrics.workers;
        queueActive.set(workers.activeWorkers || 0);
        const completed = (workers as any).completedJobs ?? 0;
        if (completed > lastCompleted) {
          jobsProcessed.inc(completed - lastCompleted);
          lastCompleted = completed;
        }
      } catch (err) {
        console.error("[Metrics] Update error", err);
      }
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
      const overall = "ok";
      const payload = {
        overall,
        timestamp: Date.now(),
        components: {
          discord: client.isReady(),
          queue: !!queueService,
        },
      };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, () => {
    console.log(`[Metrics] Bot metrics server listening on ${port}`);
  });
}
