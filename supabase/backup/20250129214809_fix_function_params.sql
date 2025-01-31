-- Fix function parameters for agent performance metrics
CREATE OR REPLACE FUNCTION public.fn_get_agent_performance(
  p_org_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
) RETURNS TABLE(
  agent_id uuid,
  agent_name text,
  tickets_assigned bigint,
  tickets_resolved bigint,
  avg_response_time text,
  avg_resolution_time text
) AS $$
BEGIN
  RETURN QUERY
  WITH agent_responses AS (
    SELECT 
      p.id as agent_id,
      p.display_name as agent_name,
      COUNT(DISTINCT t.id) as tickets_assigned,
      COUNT(DISTINCT CASE WHEN t.status = 'solved' THEN t.id END) as tickets_resolved,
      AVG(CASE WHEN c.id IS NOT NULL THEN c.created_at - t.created_at END) as response_time,
      AVG(CASE WHEN t.status = 'solved' THEN t.updated_at - t.created_at END) as resolution_time
    FROM profiles p
    LEFT JOIN tickets t ON t.assigned_agent_id = p.id
    LEFT JOIN comments c ON c.ticket_id = t.id AND c.author_id = p.id
    WHERE p.org_id = p_org_id
      AND p.role = 'agent'
      AND (p_start_date IS NULL OR t.created_at >= p_start_date)
      AND (p_end_date IS NULL OR t.created_at <= p_end_date)
    GROUP BY p.id, p.display_name
  )
  SELECT 
    agent_id,
    agent_name,
    tickets_assigned,
    tickets_resolved,
    COALESCE(
      CASE 
        WHEN EXTRACT(epoch FROM response_time) >= 86400 THEN 
          ROUND(EXTRACT(epoch FROM response_time) / 86400) || 'd'
        WHEN EXTRACT(epoch FROM response_time) >= 3600 THEN 
          ROUND(EXTRACT(epoch FROM response_time) / 3600) || 'h'
        ELSE 
          ROUND(EXTRACT(epoch FROM response_time) / 60) || 'm'
      END,
      '0m'
    ) as avg_response_time,
    COALESCE(
      CASE 
        WHEN EXTRACT(epoch FROM resolution_time) >= 86400 THEN 
          ROUND(EXTRACT(epoch FROM resolution_time) / 86400) || 'd'
        WHEN EXTRACT(epoch FROM resolution_time) >= 3600 THEN 
          ROUND(EXTRACT(epoch FROM resolution_time) / 3600) || 'h'
        ELSE 
          ROUND(EXTRACT(epoch FROM resolution_time) / 60) || 'm'
      END,
      '0m'
    ) as avg_resolution_time
  FROM agent_responses;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.fn_get_agent_performance(uuid, timestamptz, timestamptz) TO authenticated;
