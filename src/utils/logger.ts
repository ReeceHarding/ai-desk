import fs from 'fs';
import path from 'path';

// Log levels
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

// Log entry interface
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: any;
}

class Logger {
  private logDir: string;
  private logFile: string;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, 'app.log');
    this.ensureLogDirectory();
  }

  private ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatLogEntry(level: LogLevel, message: string, metadata?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata
    };
  }

  private writeToFile(entry: LogEntry) {
    const logLine = `${entry.timestamp} [${entry.level}] ${entry.message}${
      entry.metadata ? ' ' + JSON.stringify(entry.metadata) : ''
    }\n`;

    fs.appendFileSync(this.logFile, logLine);
  }

  private log(level: LogLevel, message: string, metadata?: any) {
    const entry = this.formatLogEntry(level, message, metadata);
    
    // Always log to console in development
    if (process.env.NODE_ENV === 'development') {
      const emoji = {
        DEBUG: '🔍',
        INFO: '🔵',
        WARN: '⚠️',
        ERROR: '🔴'
      }[level];

      console.log(
        `${emoji} [${entry.level}] - ${entry.timestamp}\nMessage: ${entry.message}${
          entry.metadata ? '\nMetadata: ' + JSON.stringify(entry.metadata, null, 2) : ''
        }\n${'='.repeat(40)}\n`
      );
    }

    // Write to file in production or if explicitly configured
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
      this.writeToFile(entry);
    }
  }

  debug(message: string, metadata?: any) {
    this.log('DEBUG', message, metadata);
  }

  info(message: string, metadata?: any) {
    this.log('INFO', message, metadata);
  }

  warn(message: string, metadata?: any) {
    this.log('WARN', message, metadata);
  }

  error(message: string, metadata?: any) {
    this.log('ERROR', message, metadata);
  }
}

// Create a singleton instance
export const logger = new Logger();

// Export as default for backward compatibility
export default logger; 
