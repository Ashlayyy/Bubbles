export interface Logger {
  info(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  verbose(message: string, ...args: any[]): void;
}

export const createConsoleLogger = (serviceName: string): Logger => {
  const log = (level: string, message: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${serviceName}] [${level.toUpperCase()}] ${message}`, ...args);
  };

  return {
    info: (message: string, ...args: any[]) => log('info', message, ...args),
    error: (message: string, ...args: any[]) => log('error', message, ...args),
    warn: (message: string, ...args: any[]) => log('warn', message, ...args),
    debug: (message: string, ...args: any[]) => log('debug', message, ...args),
    verbose: (message: string, ...args: any[]) => log('verbose', message, ...args),
  };
}; 