interface LoggerOptions {
  level?: string;
  metadata?: Record<string, any>;
}

class Logger {
  private level: string;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || 'info';
  }

  private formatMessage(level: string, message: string, metadata?: Record<string, any>) {
    const timestamp = new Date().toISOString();
    return {
      timestamp,
      level,
      message,
      ...metadata,
    };
  }

  private async log(level: string, message: string, metadata?: Record<string, any>) {
    const formattedMessage = this.formatMessage(level, message, metadata);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(JSON.stringify(formattedMessage, null, 2));
    } else {
      // In production, we could send this to a logging service
      // For now, we'll just use console.log
      console.log(JSON.stringify(formattedMessage));
    }
  }

  async info(message: string, metadata?: Record<string, any>) {
    return this.log('info', message, metadata);
  }

  async error(message: string, metadata?: Record<string, any>) {
    return this.log('error', message, metadata);
  }

  async warn(message: string, metadata?: Record<string, any>) {
    return this.log('warn', message, metadata);
  }

  async debug(message: string, metadata?: Record<string, any>) {
    if (process.env.NODE_ENV === 'development') {
      return this.log('debug', message, metadata);
    }
  }
}

export const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
}); 