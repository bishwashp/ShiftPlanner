-- Migration: 20250804000000_add_calendar_layer_preferences.sql
-- Create calendar layer preferences table

CREATE TABLE calendar_layer_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  layer_id VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  opacity DECIMAL(3,2) DEFAULT 1.0,
  color VARCHAR(7) DEFAULT '#3B82F6',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, layer_id)
);

-- Index for performance
CREATE INDEX idx_calendar_layer_preferences_user_id ON calendar_layer_preferences(user_id);
CREATE INDEX idx_calendar_layer_preferences_layer_id ON calendar_layer_preferences(layer_id); 