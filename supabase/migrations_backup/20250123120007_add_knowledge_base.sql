-- Create knowledge base articles table
CREATE TABLE IF NOT EXISTS knowledge_base_articles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  article_category text,
  article_type text,
  published boolean DEFAULT false,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metadata jsonb DEFAULT '{}'::jsonb,
  flagged_internal boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE knowledge_base_articles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public can view published articles" ON knowledge_base_articles
  FOR SELECT
  USING (published = true AND deleted_at IS NULL);

CREATE POLICY "Admins can manage all articles" ON knowledge_base_articles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.org_id = knowledge_base_articles.org_id
      AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update updated_at
CREATE TRIGGER update_knowledge_base_articles_updated_at
  BEFORE UPDATE ON knowledge_base_articles
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- Create indexes for faster searches
CREATE INDEX IF NOT EXISTS idx_knowledge_base_articles_title ON knowledge_base_articles USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_knowledge_base_articles_category ON knowledge_base_articles(article_category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_articles_type ON knowledge_base_articles(article_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_articles_published ON knowledge_base_articles(published);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_articles_org_id ON knowledge_base_articles(org_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_articles_deleted_at ON knowledge_base_articles(deleted_at);

-- Grant access to authenticated users
GRANT SELECT ON knowledge_base_articles TO authenticated;
GRANT ALL ON knowledge_base_articles TO service_role; 