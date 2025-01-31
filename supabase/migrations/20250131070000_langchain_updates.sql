BEGIN;

-- Drop existing table and related objects if they exist
DROP TABLE IF EXISTS public.knowledge_doc_chunks CASCADE;

-- Create knowledge_doc_chunks table
CREATE TABLE public.knowledge_doc_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_id uuid NOT NULL,
  org_id uuid NOT NULL,
  content text NOT NULL,
  chunk_index integer NOT NULL,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}'::jsonb,
  confidence_score float DEFAULT 0.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_knowledge_doc_chunks_org FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

-- Add function to update knowledge doc chunks
CREATE OR REPLACE FUNCTION public.fn_update_knowledge_doc_chunks()
RETURNS trigger AS $$
BEGIN
  -- Update updated_at timestamp
  NEW.updated_at = now();
  
  -- Ensure metadata is not null
  IF NEW.metadata IS NULL THEN
    NEW.metadata = '{}'::jsonb;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for knowledge doc chunks
DROP TRIGGER IF EXISTS tr_knowledge_doc_chunks_update ON public.knowledge_doc_chunks;
CREATE TRIGGER tr_knowledge_doc_chunks_update
  BEFORE UPDATE ON public.knowledge_doc_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_knowledge_doc_chunks();

-- Add indexes for faster lookups
CREATE INDEX idx_knowledge_doc_chunks_doc_id ON public.knowledge_doc_chunks (doc_id);
CREATE INDEX idx_knowledge_doc_chunks_org_id ON public.knowledge_doc_chunks (org_id);
CREATE INDEX idx_knowledge_doc_chunks_metadata ON public.knowledge_doc_chunks USING gin (metadata);
CREATE INDEX idx_knowledge_doc_chunks_confidence ON public.knowledge_doc_chunks (confidence_score DESC);
CREATE INDEX idx_knowledge_doc_chunks_embedding ON public.knowledge_doc_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

COMMIT; 