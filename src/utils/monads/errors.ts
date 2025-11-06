export class UnwrappingError extends Error {
  constructor(message: string) {
    super("Unwrapping Error: " + message);
  }
}
