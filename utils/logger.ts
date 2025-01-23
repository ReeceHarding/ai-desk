import { createClient } from '@supabase/supabase-js';

interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export class Logger {
  private supabase;
  private initialized: boolean = false;

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.initialized = true;
    }
  }

  private async logToSupabase(level: LogEntry['level'], message: string, metadata?: Record<string, unknown>): Promise<void> {
    // Always log to console first
    const consoleMessage = `[${level.toUpperCase()}] ${message}`;
    
    // Type-safe console logging
    switch (level) {
      case 'info':
        metadata ? console.info(consoleMessage, metadata) : console.info(consoleMessage);
        break;
      case 'warn':
        metadata ? console.warn(consoleMessage, metadata) : console.warn(consoleMessage);
        break;
      case 'error':
        metadata ? console.error(consoleMessage, metadata) : console.error(consoleMessage);
        break;
    }

    // If Supabase is not initialized, return after console logging
    if (!this.initialized) {
      console.warn('Logger not properly initialized with Supabase credentials');
      return;
    }

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
        console.error('Error logging to Supabase:', {
          error,
          level,
          message,
          metadata
        });
      }
    } catch (error) {
      console.error('Failed to log to Supabase:', {
        error,
        level,
        message,
        metadata
      });
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

// Export an instantiated logger
export const logger = new Logger(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
); 