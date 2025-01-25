import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Check environments
const isServer = typeof window === 'undefined';
const isDev = process.env.NODE_ENV === 'development';
const isEdgeRuntime = typeof process.env.NEXT_RUNTIME === 'string' && process.env.NEXT_RUNTIME === 'edge';

// Initialize Supabase client lazily only when needed
let supabaseClient: ReturnType<typeof createClientComponentClient> | null = null;

const getSupabaseClient = () => {
  if (isServer || !isDev) return null;
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

function writeLog(level: LogLevel, message: string, metadata?: unknown) {
  // Always write to console in development
  if (isDev) {
    writeToConsole(level, message, metadata as Record<string, unknown>);
  }

  // Write to file if on server and not in edge runtime
  if (isServer && !isEdgeRuntime) {
    writeToFile(level, message);
  }

  // Only write to Supabase in development and when on client
  if (isDev && !isServer) {
    writeToSupabase(level, message, metadata as Record<string, unknown>);
  }
}

async function writeToSupabase(level: string, message: string, metadata?: Record<string, unknown>) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  try {
    const logEntry = {
      level,
      message,
      metadata: metadata || {},
      timestamp: new Date().toISOString(),
      is_client: true,
      url: window.location.href,
      runtime: 'client'
    };

    const { error } = await supabase.from('logs').insert([logEntry]);
    if (error && isDev) {
      console.error('Failed to write to Supabase logs:', error);
    }

    // Add test log
    if (isDev && !isServer) {
      console.log('Test log entry:', { level, message, metadata });
      await supabase.from('logs').insert([{ 
        level: 'info', 
        message: 'Test log entry after schema fix', 
        metadata: { test: true }, 
        timestamp: new Date().toISOString(),
        is_client: true,
        url: window.location.href,
        runtime: 'client'
      }]);
    }
  } catch (error) {
    if (isDev) {
      console.error('Failed to write to Supabase logs:', error);
    }
  }
}

function writeToConsole(level: string, message: string, metadata?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  let emoji = '';
  let color = '';
  
  switch (level) {
    case 'error':
      emoji = '🚨 🚨 🚨';
      color = '\x1b[1;31m'; // Bright Red
      break;
    case 'warn':
      emoji = '⚠️ ⚠️ ⚠️';
      color = '\x1b[1;33m'; // Bright Yellow
      break;
    case 'info':
      emoji = 'ℹ️ ℹ️ ℹ️';
      color = '\x1b[1;36m'; // Bright Cyan
      break;
    default:
      emoji = '📝 📝 📝';
      color = '\x1b[1;37m'; // Bright White
  }
  
  const reset = '\x1b[0m';
  const prefix = isServer ? '[SERVER]' : '[CLIENT]';
  const separator = '\n========================================\n';
  
  // Format the output with multiple lines for better visibility
  const output = `${separator}${color}${emoji}
${prefix} [${level.toUpperCase()}]
TIME: ${timestamp}
MSG: ${message}
${metadata ? `DATA: ${JSON.stringify(metadata, null, 2)}` : ''}${reset}${separator}`;

  // Use console methods directly
  console.log(output);
}

function writeToFile(level: string, message: string) {
  if (!isServer || !logStream) {
    return;
  }
  
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${level.toUpperCase()}] - ${timestamp} - ${message}\n`;
  logStream.write(formattedMessage);
}

function extractMetadata(args: unknown[]): Record<string, unknown> | undefined {
  const lastArg = args[args.length - 1];
  if (lastArg && typeof lastArg === 'object' && !Array.isArray(lastArg) && !(lastArg instanceof Error)) {
    return lastArg as Record<string, unknown>;
  }
  return undefined;
}

export const logger = {
  log: (...args: unknown[]) => {
    const message = formatMessage(args.slice(0, -1));
    const metadata = args[args.length - 1];
    writeLog('log', message, metadata);
  },

  warn: (...args: unknown[]) => {
    const message = formatMessage(args.slice(0, -1));
    const metadata = args[args.length - 1];
    writeLog('warn', message, metadata);
  },

  error: (...args: unknown[]) => {
    const message = formatMessage(args.slice(0, -1));
    const metadata = args[args.length - 1];
    writeLog('error', message, metadata);
  },

  info: (...args: unknown[]) => {
    const message = formatMessage(args.slice(0, -1));
    const metadata = args[args.length - 1];
    writeLog('info', message, metadata);
  }
};
