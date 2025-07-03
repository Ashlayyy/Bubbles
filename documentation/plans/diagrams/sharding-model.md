# Discord Bot Sharding Model

This diagram illustrates how the bot handles Discord's sharding requirements for large-scale deployments.

```mermaid
graph TB
    A[PM2 Process Manager] --> B[Shard Manager]

    B --> C[Shard 0<br/>Guilds 0-249]
    B --> D[Shard 1<br/>Guilds 250-499]
    B --> E[Shard 2<br/>Guilds 500-749]
    B --> F[Shard N<br/>Guilds N*250...]

    C --> G[Discord Gateway 0]
    D --> H[Discord Gateway 1]
    E --> I[Discord Gateway 2]
    F --> J[Discord Gateway N]

    C --> K[Shared Redis Cache]
    D --> K
    E --> K
    F --> K

    C --> L[Shared Database]
    D --> L
    E --> L
    F --> L

    C --> M[Unified Queue Service]
    D --> M
    E --> M
    F --> M

    K --> N[Cross-Shard Communication]
    N --> O[Global Commands]
    N --> P[User Data Sync]
    N --> Q[Guild Statistics]

    M --> R[API WebSocket]
    R --> S[Frontend Dashboard]

    style A fill:#e3f2fd
    style B fill:#fff3e0
    style K fill:#f3e5f5
    style L fill:#e8f5e8
    style M fill:#fff8e1
    style S fill:#fce4ec
```

## Sharding Strategy

### Automatic Shard Calculation

- Discord recommends 1 shard per 2,500 guilds
- Bot automatically calculates required shards based on guild count
- Shards are distributed evenly across available processes

### Shard Responsibilities

- **Gateway Connection**: Each shard maintains its own WebSocket connection
- **Event Processing**: Events are processed locally on the responsible shard
- **Guild Management**: Guilds are distributed across shards by ID hash

### Cross-Shard Communication

- **Redis Cache**: Shared state and temporary data across shards
- **Database**: Persistent data accessible by all shards
- **Queue Service**: Centralized job processing and coordination

### Scaling Considerations

- **Horizontal Scaling**: Add more PM2 processes as guild count grows
- **Load Balancing**: PM2 handles process distribution and restarts
- **Memory Management**: Each shard operates independently with isolated memory
- **Fault Tolerance**: Individual shard failures don't affect other shards

### Development vs Production

- **Development**: Single shard for testing and debugging
- **Production**: Multiple shards based on guild count and load requirements
