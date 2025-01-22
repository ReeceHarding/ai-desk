import { createClient } from '@supabase/supabase-js';

interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export class Logger {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  private async logToSupabase(level: LogEntry['level'], message: string, metadata?: Record<string, unknown>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('logs')
        .insert([{
          level,
          message,
          metadata,
          timestamp: new Date().toISOString()
        }]);

      if (error) {
        console.error('Error logging to Supabase:', error);
      }
    } catch (error) {
      console.error('Failed to log to Supabase:', error);
    }
  }

  async info(message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.logToSupabase('info', message, metadata);
  }

  async warn(message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.logToSupabase('warn', message, metadata);
  }

  async error(message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.logToSupabase('error', message, metadata);
  }
} 