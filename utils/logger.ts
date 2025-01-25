import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Check environments
const isServer = typeof window === 'undefined';
const isDev = process.env.NODE_ENV === 'development';
const isEdgeRuntime = typeof process.env.NEXT_RUNTIME === 'string' && process.env.NEXT_RUNTIME === 'edge';

// Initialize Supabase client lazily only when needed
let supabaseClient: ReturnType<typeof createClientComponentClient> | null = null;

const getSupabaseClient = () => {
  if (!isDev || isServer) return null;
  if (!supabaseClient) {
    supabaseClient = createClientComponentClient();
  }
  return supabaseClient;
};

// Only import fs and path if we're on the server and not in edge runtime
let fs: typeof import('fs');
let path: typeof import('path');
let logStream: import('fs').WriteStream | null = null;

if (isServer && !isEdgeRuntime) {
  try {
    fs = require('fs');
    path = require('path');
    
    // Setup file logging on server
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const logFile = path.join(logsDir, 'server.log');
    logStream = fs.createWriteStream(logFile, { flags: 'a' });
  } catch (error) {
    console.warn('Failed to initialize file logging:', error);
  }
}

type LogLevel = 'info' | 'warn' | 'error' | 'log';

// Browser-specific log formatting
const browserStyles: Record<LogLevel, string> = {
  info: 'color: #00bcd4; font-weight: bold; font-size: 12px;',
  warn: 'color: #ff9800; font-weight: bold; font-size: 12px;',
  error: 'color: #f44336; font-weight: bold; font-size: 12px;',
  log: 'color: #4caf50; font-weight: bold; font-size: 12px;'
};

const emojis: Record<LogLevel, string> = {
  info: '🔵',
  warn: '🟡',
  error: '🔴',
  log: '⚪'
};

function formatMessage(args: unknown[]): string {
  return args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return arg.stack || arg.message;
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'object') return JSON.stringify(arg, null, 2);
    return String(arg);
  }).join(' ');
}

function formatBrowserLog(level: LogLevel, message: string, metadata?: unknown) {
  const timestamp = new Date().toISOString();
  const style = browserStyles[level];
  const emoji = emojis[level];

  console.group(`%c${emoji} ${level.toUpperCase()} - ${timestamp}`, style);
  console.log('%cMessage:', style, message);
  if (metadata) console.log('%cMetadata:', style, metadata);
  console.groupEnd();
}

function formatTerminalLog(level: LogLevel, message: string, metadata?: unknown) {
  const timestamp = new Date().toISOString();
  const emoji = emojis[level];
  
  const colors: Record<LogLevel, string> = {
    info: '\x1b[36m',    // Cyan
    warn: '\x1b[33m',    // Yellow
    error: '\x1b[31m',   // Red
    log: '\x1b[32m'      // Green
  };
  
  const color = colors[level];
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';
  
  const header = `${bold}${color}${emoji} [${level.toUpperCase()}] - ${timestamp}${reset}`;
  const body = `\n${color}Message: ${reset}${message}`;
  const metadataStr = metadata ? `\n${color}Metadata: ${reset}${JSON.stringify(metadata, null, 2)}` : '';
  const separator = '\n========================================\n';
  
  const output = `${separator}${header}${body}${metadataStr}${separator}`;
  
  // Write to stdout/stderr
  if (level === 'error') {
    console.error(output);
  } else {
    console.log(output);
  }

  // Also write to file if we're on the server and not in edge runtime
  if (logStream && !isEdgeRuntime) {
    const fileOutput = `[${level.toUpperCase()}] ${timestamp} - ${message}${metadata ? ` - ${JSON.stringify(metadata)}` : ''}\n`;
    logStream.write(fileOutput);
  }
}

async function writeToSupabase(level: string, message: string, metadata?: Record<string, unknown>) {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const logEntry = {
      level,
      message,
      metadata: metadata || {},
      timestamp: new Date().toISOString(),
      is_client: !isServer,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      runtime: isEdgeRuntime ? 'edge' : isServer ? 'server' : 'client'
    };

    await supabase.from('logs').insert([logEntry]).throwOnError();
  } catch (error) {
    // Only log errors in development
    if (isDev) {
      console.error('Failed to write to Supabase logs:', error);
    }
  }
}

function writeLog(level: LogLevel, message: string, metadata?: unknown) {
  // Format console output based on environment
  if (isServer) {
    formatTerminalLog(level, message, metadata);
  } else {
    formatBrowserLog(level, message, metadata);
  }

  // Write to file if on server and not in edge runtime
  if (isServer && !isEdgeRuntime && logStream) {
    writeToFile(level, message);
  }

  // Write to Supabase in development
  if (isDev) {
    writeToSupabase(level, message, metadata as Record<string, unknown>).catch(() => {
      // Ignore Supabase write errors in production
      if (isDev) {
        console.warn('Failed to write log to Supabase');
      }
    });
  }
}

function writeToFile(level: string, message: string) {
  if (!isServer || !logStream) return;
  
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${level.toUpperCase()}] - ${timestamp} - ${message}\n`;
  logStream.write(formattedMessage);
}

export const logger = {
  info: (...args: unknown[]) => {
    const metadata = extractMetadata(args);
    const message = formatMessage(metadata ? args.slice(0, -1) : args);
    writeLog('info', message, metadata);
  },

  warn: (...args: unknown[]) => {
    const metadata = extractMetadata(args);
    const message = formatMessage(metadata ? args.slice(0, -1) : args);
    writeLog('warn', message, metadata);
  },

  error: (...args: unknown[]) => {
    const metadata = extractMetadata(args);
    const message = formatMessage(metadata ? args.slice(0, -1) : args);
    writeLog('error', message, metadata);
  },

  log: (...args: unknown[]) => {
    const metadata = extractMetadata(args);
    const message = formatMessage(metadata ? args.slice(0, -1) : args);
    writeLog('log', message, metadata);
  }
};

function extractMetadata(args: unknown[]): Record<string, unknown> | undefined {
  const lastArg = args[args.length - 1];
  if (lastArg && typeof lastArg === 'object' && !Array.isArray(lastArg) && !(lastArg instanceof Error)) {
    return lastArg as Record<string, unknown>;
  }
  return undefined;
}
