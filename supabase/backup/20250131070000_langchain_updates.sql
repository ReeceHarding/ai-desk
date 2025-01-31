BEGIN;

-- Drop existing tables and related objects if they exist
DROP TABLE IF EXISTS public.knowledge_doc_chunks CASCADE;
DROP TABLE IF EXISTS public.knowledge_docs CASCADE;

-- Create knowledge_docs table
CREATE TABLE public.knowledge_docs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  file_path text,
  source_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create knowledge_doc_chunks table
CREATE TABLE public.knowledge_doc_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_id uuid NOT NULL REFERENCES public.knowledge_docs(id) ON DELETE CASCADE,
  content text NOT NULL,
  chunk_index integer NOT NULL,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}'::jsonb,
  confidence_score float DEFAULT 0.0,
  token_length integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add function to update timestamps
CREATE OR REPLACE FUNCTION public.fn_update_knowledge_timestamps()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  
  -- Ensure metadata is not null
  IF NEW.metadata IS NULL THEN
    NEW.metadata = '{}'::jsonb;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for both tables
DROP TRIGGER IF EXISTS tr_knowledge_docs_update ON public.knowledge_docs;
CREATE TRIGGER tr_knowledge_docs_update
  BEFORE UPDATE ON public.knowledge_docs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_knowledge_timestamps();

DROP TRIGGER IF EXISTS tr_knowledge_doc_chunks_update ON public.knowledge_doc_chunks;
CREATE TRIGGER tr_knowledge_doc_chunks_update
  BEFORE UPDATE ON public.knowledge_doc_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_knowledge_timestamps();

-- Add indexes for faster lookups
CREATE INDEX idx_knowledge_docs_org_id ON public.knowledge_docs (org_id);
CREATE INDEX idx_knowledge_docs_metadata ON public.knowledge_docs USING gin (metadata);

CREATE INDEX idx_knowledge_doc_chunks_doc_id ON public.knowledge_doc_chunks (doc_id);
CREATE INDEX idx_knowledge_doc_chunks_metadata ON public.knowledge_doc_chunks USING gin (metadata);
CREATE INDEX idx_knowledge_doc_chunks_confidence ON public.knowledge_doc_chunks (confidence_score DESC);
CREATE INDEX idx_knowledge_doc_chunks_embedding ON public.knowledge_doc_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

COMMIT; 