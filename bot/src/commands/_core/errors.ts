import logger from "../../logger.js";

export class CommandError extends Error {
  public readonly code: string;
  public readonly isUserError: boolean;

  constructor(message: string, code = "UNKNOWN_ERROR", isUserError = false) {
    super(message);
    this.name = "CommandError";
    this.code = code;
    this.isUserError = isUserError;
  }
}

export function createUserError(message: string, code = "USER_ERROR"): CommandError {
  return new CommandError(message, code, true);
}

export function createSystemError(message: string, code = "SYSTEM_ERROR"): CommandError {
  return new CommandError(message, code, false);
}

export function handleCommandError(error: Error, commandName: string): CommandError {
  if (error instanceof CommandError) {
    return error;
  }

  // Log system errors
  logger.error(`Unhandled error in command ${commandName}:`, error);

  // Convert to CommandError
  return createSystemError("An unexpected error occurred while executing the command.", "UNHANDLED_ERROR");
}
