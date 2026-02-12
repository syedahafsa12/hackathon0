/**
 * Structured JSON logger for Mini Hafsa
 * Provides consistent logging format across all components
 */

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  action: string;
  approvalId?: string;
  userId?: string;
  actionType?: string;
  success?: boolean;
  durationMs?: number;
  error?: string;
  data?: any;
  [key: string]: any;
}

export class StructuredLogger {
  constructor(private component: string) {}

  private log(level: LogLevel, action: string, data?: Partial<LogEntry>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      action,
      ...data,
    };

    const message = JSON.stringify(entry);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(message);
        break;
      case LogLevel.INFO:
        console.info(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      case LogLevel.ERROR:
        console.error(message);
        break;
    }
  }

  debug(action: string, data?: Partial<LogEntry>): void {
    this.log(LogLevel.DEBUG, action, data);
  }

  info(action: string, data?: Partial<LogEntry>): void {
    this.log(LogLevel.INFO, action, data);
  }

  warn(action: string, data?: Partial<LogEntry>): void {
    this.log(LogLevel.WARN, action, data);
  }

  error(action: string, error: Error | string, data?: Partial<LogEntry>): void {
    this.log(LogLevel.ERROR, action, {
      ...data,
      error: typeof error === "string" ? error : error.message,
    });
  }

  startTimer(): () => number {
    const start = Date.now();
    return () => Date.now() - start;
  }
}
