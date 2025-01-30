CREATE INDEX IF NOT EXISTS ticket_email_chats_message_thread_idx 
ON ticket_email_chats(message_id, thread_id); 