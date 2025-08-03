-- Migration: 20250804000001_add_view_preferences.sql
-- Create view preferences table

CREATE TABLE view_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  view_type VARCHAR(20) NOT NULL, -- 'day', 'week', 'month'
  default_layers TEXT[], -- Array of enabled layer IDs
  zoom_level INTEGER DEFAULT 1,
  show_conflicts BOOLEAN DEFAULT true,
  show_fairness_indicators BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, view_type)
);

-- Index for performance
CREATE INDEX idx_view_preferences_user_id ON view_preferences(user_id);
CREATE INDEX idx_view_preferences_view_type ON view_preferences(view_type); 