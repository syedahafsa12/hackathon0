/**
 * Simple logger wrapper for Mini Hafsa
 * Provides consistent logging format across vault components
 */

export class Logger {
  constructor(private component: string) {}

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] [${this.component}] ${message}${dataStr}`;
  }

  info(message: string, data?: any): void {
    console.info(this.formatMessage('INFO', message, data));
  }

  warn(message: string, data?: any): void {
    console.warn(this.formatMessage('WARN', message, data));
  }

  error(message: string, error?: any): void {
    const errorInfo = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error;
    console.error(this.formatMessage('ERROR', message, errorInfo));
  }

  debug(message: string, data?: any): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatMessage('DEBUG', message, data));
    }
  }
}
