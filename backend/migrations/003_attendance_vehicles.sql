-- Attendance, Vehicle Tracking, and Reporting Schema
-- World-class GPS tracking system - Professional features
-- Created: 2025-01-27

-- Ensure UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Attendance/Work Hours table
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  group_id UUID, -- Reference to groups if exists
  check_in_time TIMESTAMP NOT NULL,
  check_out_time TIMESTAMP,
  check_in_location JSONB, -- {lat, lng, accuracy, address}
  check_out_location JSONB,
  work_duration INTEGER, -- seconds
  total_distance DOUBLE PRECISION DEFAULT 0, -- km
  is_active BOOLEAN DEFAULT true,
  status VARCHAR(50) DEFAULT 'checked_in', -- checked_in, checked_out, break, overtime
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, check_in_time DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_group_date ON attendance(group_id, check_in_time DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_active ON attendance(is_active, check_in_time DESC);

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID, -- Company/group that owns the vehicle
  name VARCHAR(255) NOT NULL,
  plate_number VARCHAR(50) UNIQUE,
  vehicle_type VARCHAR(50), -- car, truck, motorcycle, etc.
  max_speed DOUBLE PRECISION, -- km/h
  fuel_type VARCHAR(50), -- petrol, diesel, electric, hybrid
  fuel_capacity DOUBLE PRECISION, -- liters
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_group ON vehicles(group_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_active ON vehicles(is_active);

-- Vehicle tracking sessions
CREATE TABLE IF NOT EXISTS vehicle_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  start_location JSONB,
  end_location JSONB,
  total_distance DOUBLE PRECISION DEFAULT 0, -- km
  total_duration INTEGER DEFAULT 0, -- seconds
  average_speed DOUBLE PRECISION, -- km/h
  max_speed DOUBLE PRECISION, -- km/h
  fuel_consumed DOUBLE PRECISION, -- liters
  speed_violations INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_sessions_vehicle ON vehicle_sessions(vehicle_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_sessions_user ON vehicle_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_sessions_active ON vehicle_sessions(is_active, started_at DESC);

-- Speed violations log
CREATE TABLE IF NOT EXISTS speed_violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  vehicle_session_id UUID REFERENCES vehicle_sessions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  speed DOUBLE PRECISION NOT NULL, -- km/h
  speed_limit DOUBLE PRECISION NOT NULL, -- km/h
  location JSONB, -- {lat, lng, address}
  timestamp TIMESTAMP NOT NULL,
  duration INTEGER, -- seconds
  severity VARCHAR(50), -- minor, moderate, severe
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speed_violations_vehicle ON speed_violations(vehicle_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_speed_violations_user ON speed_violations(user_id, timestamp DESC);

-- Daily reports table
CREATE TABLE IF NOT EXISTS daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID,
  report_date DATE NOT NULL,
  report_type VARCHAR(50) NOT NULL, -- attendance, location, vehicle, combined
  total_work_hours INTEGER, -- seconds
  total_distance DOUBLE PRECISION DEFAULT 0, -- km
  check_in_count INTEGER DEFAULT 0,
  check_out_count INTEGER DEFAULT 0,
  location_points_count INTEGER DEFAULT 0,
  vehicle_sessions_count INTEGER DEFAULT 0,
  speed_violations_count INTEGER DEFAULT 0,
  report_data JSONB, -- Detailed report data
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, report_date, report_type)
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_user_date ON daily_reports(user_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_group_date ON daily_reports(group_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_type ON daily_reports(report_type, report_date DESC);

-- Management dashboard stats cache
CREATE TABLE IF NOT EXISTS dashboard_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID,
  stat_date DATE NOT NULL,
  stat_type VARCHAR(50) NOT NULL, -- daily, weekly, monthly
  total_users INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  total_attendance INTEGER DEFAULT 0,
  total_work_hours INTEGER DEFAULT 0, -- seconds
  total_distance DOUBLE PRECISION DEFAULT 0, -- km
  total_vehicles INTEGER DEFAULT 0,
  active_vehicles INTEGER DEFAULT 0,
  speed_violations INTEGER DEFAULT 0,
  stats_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, stat_date, stat_type)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_stats_group_date ON dashboard_stats(group_id, stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_stats_type ON dashboard_stats(stat_type, stat_date DESC);

