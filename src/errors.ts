import AppError from "@/utils/error_handling/AppError";
import { StatusCodes } from "http-status-codes";

export class DBError extends AppError {
  constructor(message?: string, details?: unknown) {
    super({
      message: `DB error: ${message ?? "Check logging output if there's one"}`,
      status: StatusCodes.INTERNAL_SERVER_ERROR,
      details,
      isOperational: false,
    });
  }
}
