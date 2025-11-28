import AppError from "@/utils/error_handling/AppError";

export class SpawningError extends AppError {
  constructor(actor_type: string, actor_id: string) {
    super({
      message: `Failed to spawn ${actor_type} (id=${actor_id})`,
    });
  }
}

export class InvalidId extends AppError {
  constructor(actor_type: string, actor_id: string) {
    super({
      message: `Invalid ID to ${actor_type} (test id=${actor_id})`,
    });
  }
}

export class AskTimeout extends AppError {
  constructor() {
    super({
      message: `Ask Request Timed out`,
    });
  }
}

export class ContextInitializationError extends AppError {
  constructor() {
    super({
      message: "ContextInitializationError: Failed to initialize context",
    });
  }
}
