import AppError from "@/utils/error_handling/AppError";
import { StatusCodes } from "http-status-codes";

export class DBError extends AppError {
  constructor(message: string) {
    super({
      message: `DB error ${message}`,
      status: StatusCodes.INTERNAL_SERVER_ERROR,
      isOperational: false,
    });
  }
}
