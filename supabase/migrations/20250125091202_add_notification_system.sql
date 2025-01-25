-- Create notification preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    email_notifications boolean DEFAULT true,
    push_notifications boolean DEFAULT false,
    daily_summary boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT unique_user_org_pref UNIQUE (user_id, org_id)
);

-- Create notification history table
CREATE TABLE IF NOT EXISTS public.notification_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('email', 'push', 'summary')),
    status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
    subject text NOT NULL,
    body text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    sent_at timestamptz,
    error text
);

-- Add RLS policies
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

-- Policies for notification_preferences
CREATE POLICY "Users can view their own notification preferences"
    ON public.notification_preferences
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
    ON public.notification_preferences
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences"
    ON public.notification_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policies for notification_history
CREATE POLICY "Users can view their own notification history"
    ON public.notification_history
    FOR SELECT
    USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_history TO authenticated;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_org_id ON public.notification_preferences(org_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON public.notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_ticket_id ON public.notification_history(ticket_id);

-- Add notification trigger function
CREATE OR REPLACE FUNCTION public.handle_new_ticket_comment()
RETURNS TRIGGER AS $$
DECLARE
    v_ticket record;
    v_agent record;
    v_watchers record;
    v_org_id uuid;
BEGIN
    -- Get ticket details
    SELECT * INTO v_ticket
    FROM public.tickets
    WHERE id = NEW.ticket_id;

    -- Get org_id
    v_org_id := v_ticket.org_id;

    -- If there's an assigned agent, create notification
    IF v_ticket.assigned_agent_id IS NOT NULL THEN
        -- Get agent's notification preferences
        INSERT INTO public.notification_history
            (user_id, org_id, ticket_id, type, status, subject, body, metadata)
        SELECT 
            v_ticket.assigned_agent_id,
            v_org_id,
            NEW.ticket_id,
            CASE 
                WHEN np.email_notifications THEN 'email'
                WHEN np.push_notifications THEN 'push'
                ELSE 'email' -- Default to email if no preference set
            END,
            'pending',
            'New comment on ticket #' || v_ticket.id,
            NEW.body,
            jsonb_build_object(
                'ticket_number', v_ticket.id,
                'ticket_subject', v_ticket.subject,
                'comment_id', NEW.id,
                'author_id', NEW.author_id
            )
        FROM public.notification_preferences np
        WHERE np.user_id = v_ticket.assigned_agent_id
        AND np.org_id = v_org_id
        AND (np.email_notifications OR np.push_notifications);
    END IF;

    -- Create notifications for watchers
    INSERT INTO public.notification_history
        (user_id, org_id, ticket_id, type, status, subject, body, metadata)
    SELECT 
        tw.user_id,
        v_org_id,
        NEW.ticket_id,
        CASE 
            WHEN np.email_notifications THEN 'email'
            WHEN np.push_notifications THEN 'push'
            ELSE 'email' -- Default to email if no preference set
        END,
        'pending',
        'New comment on watched ticket #' || v_ticket.id,
        NEW.body,
        jsonb_build_object(
            'ticket_number', v_ticket.id,
            'ticket_subject', v_ticket.subject,
            'comment_id', NEW.id,
            'author_id', NEW.author_id
        )
    FROM public.ticket_watchers tw
    LEFT JOIN public.notification_preferences np ON np.user_id = tw.user_id AND np.org_id = v_org_id
    WHERE tw.ticket_id = NEW.ticket_id
    AND tw.user_id != NEW.author_id -- Don't notify the author
    AND (np.email_notifications OR np.push_notifications OR np.id IS NULL); -- Include even if no preferences set

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new comments
DROP TRIGGER IF EXISTS trigger_new_ticket_comment ON public.comments;
CREATE TRIGGER trigger_new_ticket_comment
    AFTER INSERT ON public.comments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_ticket_comment(); 