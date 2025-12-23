-- Geofences Schema
-- World-class GPS tracking system - Geofence management
-- Created: 2025-01-27

-- Ensure UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Geofences table
CREATE TABLE IF NOT EXISTS geofences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID, -- Optional: group-level geofences
  name VARCHAR(255) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius DOUBLE PRECISION NOT NULL, -- meters
  type VARCHAR(50) DEFAULT 'custom', -- home, work, custom
  enabled BOOLEAN DEFAULT true,
  notify_on_enter BOOLEAN DEFAULT true,
  notify_on_exit BOOLEAN DEFAULT true,
  enter_message TEXT,
  exit_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geofences_user ON geofences(user_id);
CREATE INDEX IF NOT EXISTS idx_geofences_group ON geofences(group_id);
CREATE INDEX IF NOT EXISTS idx_geofences_enabled ON geofences(enabled);
CREATE INDEX IF NOT EXISTS idx_geofences_location ON geofences USING GIST (
  ll_to_earth(latitude, longitude)
);

-- Geofence events log
CREATE TABLE IF NOT EXISTS geofence_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  geofence_id UUID REFERENCES geofences(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL, -- enter, exit
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geofence_events_geofence ON geofence_events(geofence_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_geofence_events_user ON geofence_events(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_geofence_events_type ON geofence_events(event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_geofence_events_timestamp ON geofence_events(timestamp DESC);

-- Function to check if point is inside geofence (for efficient queries)
CREATE OR REPLACE FUNCTION is_point_in_geofence(
  point_lat DOUBLE PRECISION,
  point_lng DOUBLE PRECISION,
  geofence_lat DOUBLE PRECISION,
  geofence_lng DOUBLE PRECISION,
  geofence_radius DOUBLE PRECISION
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    6371000 * acos(
      LEAST(1.0,
        cos(radians(point_lat)) * 
        cos(radians(geofence_lat)) * 
        cos(radians(geofence_lng) - radians(point_lng)) + 
        sin(radians(point_lat)) * 
        sin(radians(geofence_lat))
      )
    )
  ) <= geofence_radius;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

