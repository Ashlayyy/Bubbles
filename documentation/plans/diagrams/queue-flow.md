# Queue Flow Architecture

This diagram shows how the unified queue service processes jobs across different components.

```mermaid
graph TD
    A[Discord Event] --> B{Event Type}
    B -->|Moderation| C[Moderation Queue]
    B -->|Logging| D[Logging Queue]
    B -->|Scheduled| E[Scheduled Queue]
    B -->|Webhook| F[Webhook Queue]

    C --> G[Circuit Breaker]
    D --> G
    E --> G
    F --> G

    G --> H{Health Check}
    H -->|Healthy| I[Job Processor]
    H -->|Unhealthy| J[Dead Letter Queue]

    I --> K[Database Update]
    I --> L[Discord API Call]
    I --> M[External API Call]

    J --> N[Manual Review]
    N --> O[Retry or Discard]

    K --> P[Success Metrics]
    L --> P
    M --> P

    O --> Q[Retry Queue]
    Q --> G

    style A fill:#e1f5fe
    style G fill:#fff3e0
    style J fill:#ffebee
    style P fill:#e8f5e8
```

## Key Components

### Queue Types

- **Moderation Queue**: Handles bans, kicks, timeouts, and case management
- **Logging Queue**: Processes audit logs and message logging
- **Scheduled Queue**: Manages timed actions like unbans and reminders
- **Webhook Queue**: Handles external webhook deliveries

### Reliability Features

- **Circuit Breaker**: Prevents cascade failures by monitoring success rates
- **Dead Letter Queue**: Captures failed jobs for manual review
- **Retry Logic**: Exponential backoff with configurable retry limits
- **Health Checks**: Monitors queue and processor health

### Processing Flow

1. Discord events are categorized by type
2. Jobs are queued with appropriate priority and metadata
3. Circuit breaker evaluates system health
4. Healthy jobs are processed by dedicated processors
5. Failed jobs are sent to dead letter queue or retry queue
6. Success metrics are collected for monitoring
