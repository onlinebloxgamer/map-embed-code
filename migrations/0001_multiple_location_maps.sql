CREATE TABLE maps (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    configuration TEXT NOT NULL,
    edit_token_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_maps_created_at ON maps(created_at);

CREATE TABLE map_rate_limits (
    key TEXT PRIMARY KEY NOT NULL,
    window INTEGER NOT NULL,
    count INTEGER NOT NULL
);

CREATE INDEX idx_map_rate_limits_window ON map_rate_limits(window);

CREATE TABLE map_geocodes (
    key TEXT PRIMARY KEY NOT NULL,
    result TEXT NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE INDEX idx_map_geocodes_expires_at ON map_geocodes(expires_at);
