
interface LogData {
  [key: string]: any
}

class Logger {
  private formatMessage(level: string, message: string, data?: LogData): string {
    const timestamp = new Date().toISOString()
    const dataString = data ? ` ${JSON.stringify(data)}` : ''
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${dataString}`
  }

  info(message: string, data?: LogData) {
    console.log(this.formatMessage('info', message, data))
  }

  warn(message: string, data?: LogData) {
    console.warn(this.formatMessage('warn', message, data))
  }

  error(message: string, data?: LogData) {
    console.error(this.formatMessage('error', message, data))
  }

  debug(message: string, data?: LogData) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, data))
    }
  }
}

export const logger = new Logger() 