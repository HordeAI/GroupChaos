-- Create AI interactions table
CREATE TABLE IF NOT EXISTS ai_interactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  user_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  context JSONB
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_ai_interactions_user_id ON ai_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_created_at ON ai_interactions(created_at);

-- Add RLS policies
ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own interactions
CREATE POLICY "Users can view their own interactions"
  ON ai_interactions FOR SELECT
  USING (auth.uid()::text = user_id);

-- Allow users to create their own interactions
CREATE POLICY "Users can create their own interactions"
  ON ai_interactions FOR INSERT
  WITH CHECK (auth.uid()::text = user_id); 