import { FastifyInstance } from 'fastify';

export interface Logger {
  info: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

// Create a simple logger wrapper that can be used consistently
export class AppLogger {
  private static instance: AppLogger;
  private logger: FastifyInstance['log'];

  private constructor(fastifyInstance?: FastifyInstance) {
    if (fastifyInstance) {
      this.logger = fastifyInstance.log;
    } else {
      // Fallback logger if no fastify instance is provided
      this.logger = console as any;
    }
  }

  public static getInstance(fastifyInstance?: FastifyInstance): AppLogger {
    if (!AppLogger.instance) {
      AppLogger.instance = new AppLogger(fastifyInstance);
    }
    return AppLogger.instance;
  }

  public info(message: string, meta?: any) {
    if (meta) {
      this.logger.info(meta, message);
    } else {
      this.logger.info(message);
    }
  }

  public error(message: string, meta?: any) {
    if (meta) {
      this.logger.error(meta, message);
    } else {
      this.logger.error(message);
    }
  }

  public warn(message: string, meta?: any) {
    if (meta) {
      this.logger.warn(meta, message);
    } else {
      this.logger.warn(message);
    }
  }

  public debug(message: string, meta?: any) {
    if (meta) {
      this.logger.debug(meta, message);
    } else {
      this.logger.debug(message);
    }
  }
}

export default AppLogger;