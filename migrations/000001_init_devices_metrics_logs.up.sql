CREATE TABLE devices (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    ip_address INET NOT NULL UNIQUE,
    device_type VARCHAR(50) NOT NULL,
    vendor VARCHAR(80) NOT NULL DEFAULT '',
    model VARCHAR(80) NOT NULL DEFAULT '',
    location VARCHAR(150) NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'unknown',
    data_source VARCHAR(20) NOT NULL DEFAULT 'manual',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT devices_status_check CHECK (status IN ('online', 'warning', 'offline', 'unknown')),
    CONSTRAINT devices_data_source_check CHECK (data_source IN ('manual', 'simulated', 'agent'))
);

CREATE INDEX idx_devices_status ON devices (status);
CREATE INDEX idx_devices_type ON devices (device_type);

CREATE TABLE metrics (
    id BIGSERIAL PRIMARY KEY,
    device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    value NUMERIC(12, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'normal',
    data_source VARCHAR(20) NOT NULL DEFAULT 'manual',
    collected_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT metrics_type_check CHECK (
        metric_type IN ('ping_latency', 'packet_loss', 'cpu_usage', 'memory_usage', 'uptime')
    ),
    CONSTRAINT metrics_status_check CHECK (status IN ('normal', 'warning', 'critical')),
    CONSTRAINT metrics_data_source_check CHECK (data_source IN ('manual', 'simulated', 'collected'))
);

CREATE INDEX idx_metrics_device_id ON metrics (device_id);
CREATE INDEX idx_metrics_type ON metrics (metric_type);
CREATE INDEX idx_metrics_collected_at ON metrics (collected_at DESC);

CREATE TABLE logs (
    id BIGSERIAL PRIMARY KEY,
    device_id BIGINT REFERENCES devices(id) ON DELETE SET NULL,
    level VARCHAR(20) NOT NULL,
    action VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    actor_role VARCHAR(20) NOT NULL DEFAULT 'system',
    actor_name VARCHAR(120) NOT NULL DEFAULT '',
    source VARCHAR(50) NOT NULL DEFAULT 'system',
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT logs_level_check CHECK (level IN ('info', 'warning', 'error', 'audit')),
    CONSTRAINT logs_actor_role_check CHECK (actor_role IN ('system', 'admin'))
);

CREATE INDEX idx_logs_device_id ON logs (device_id);
CREATE INDEX idx_logs_level ON logs (level);
CREATE INDEX idx_logs_created_at ON logs (created_at DESC);
