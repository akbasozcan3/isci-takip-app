-- Location Points Partitioning
-- Partition location_points table by month for better performance
-- Created: 2025-01-27

-- Note: This migration assumes location_points table exists from migration 001
-- We'll create monthly partitions going forward

-- Function to create monthly partitions
CREATE OR REPLACE FUNCTION create_location_partition(year_month DATE)
RETURNS VOID AS $$
DECLARE
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  -- Calculate partition boundaries
  start_date := DATE_TRUNC('month', year_month);
  end_date := start_date + INTERVAL '1 month';
  
  -- Generate partition name (e.g., location_points_2025_01)
  partition_name := 'location_points_' || TO_CHAR(start_date, 'YYYY_MM');
  
  -- Create partition if it doesn't exist
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I PARTITION OF location_points
    FOR VALUES FROM (%L) TO (%L)',
    partition_name,
    start_date,
    end_date
  );
  
  -- Create index on timestamp for this partition
  EXECUTE format('
    CREATE INDEX IF NOT EXISTS idx_%I_timestamp ON %I(timestamp DESC)',
    partition_name,
    partition_name
  );
  
  RAISE NOTICE 'Created partition % for period % to %', partition_name, start_date, end_date;
END;
$$ LANGUAGE plpgsql;

-- Create partitions for current and next 3 months
SELECT create_location_partition(CURRENT_DATE);
SELECT create_location_partition(CURRENT_DATE + INTERVAL '1 month');
SELECT create_location_partition(CURRENT_DATE + INTERVAL '2 months');
SELECT create_location_partition(CURRENT_DATE + INTERVAL '3 months');

-- Function to automatically create partitions (can be called by cron job)
CREATE OR REPLACE FUNCTION ensure_location_partitions()
RETURNS VOID AS $$
DECLARE
  months_ahead INTEGER := 3;
  i INTEGER;
  target_date DATE;
BEGIN
  FOR i IN 0..months_ahead LOOP
    target_date := DATE_TRUNC('month', CURRENT_DATE) + (i || ' months')::INTERVAL;
    PERFORM create_location_partition(target_date);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

